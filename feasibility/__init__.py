"""CMT - Cost Management Tool (Pitch Feasibility & Cost Optimizer), served by Flask.

The UI is the original React app, prebuilt into ``feasibility/static`` (see
``frontend/``). Flask serves it, exposes the JSON API under ``/api`` and keeps the
shared state in SQLite.
"""

import gzip
import logging
import os
import sqlite3
import threading
from datetime import datetime

from flask import Flask, Response, abort, jsonify, request, send_file
from werkzeug.exceptions import HTTPException

from . import db
from .chat_engine import process_rule_based_query
from .excel_export import build_feasibility_workbook
from .xlsx_import import xlsx_to_csv

log = logging.getLogger(__name__)


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True, static_folder="static", static_url_path="")

    app.config.from_mapping(
        DATABASE=os.environ.get("FEASIBILITY_DB") or os.path.join(app.instance_path, "feasibility.db"),
        # The parsed capability database is sent as JSON with every vendor column on every row:
        # "Database V2.xlsx" (8.3k rows x 166 vendors) is ~45 MB, so leave plenty of headroom.
        MAX_CONTENT_LENGTH=int(os.environ.get("FEASIBILITY_MAX_UPLOAD_MB", "256")) * 1024 * 1024,
    )
    if test_config:
        app.config.update(test_config)

    os.makedirs(os.path.dirname(os.path.abspath(app.config["DATABASE"])), exist_ok=True)
    db.init_db(app.config["DATABASE"])
    app.teardown_appcontext(db.close_db)

    register_routes(app)
    return app


def _json_body():
    body = request.get_json(silent=True)
    if body is None:
        abort(400, description="Request body must be JSON.")
    return body


def _validate_option(body):
    if not isinstance(body, dict):
        abort(400, description="Saved option must be a JSON object.")
    name = str(body.get("name") or "").strip()
    if not name:
        abort(400, description="Saved option needs a name.")
    if not isinstance(body.get("data"), list):
        abort(400, description="Saved option 'data' must be a list of specification rows.")
    return {
        "id": str(body.get("id") or ""),
        "name": name,
        "timestamp": str(body.get("timestamp") or datetime.now().strftime("%H:%M %d/%m/%Y")),
        "data": body["data"],
    }


def register_routes(app):
    @app.get("/")
    def index():
        index_path = os.path.join(app.static_folder, "index.html")
        if not os.path.exists(index_path):
            return (
                "The frontend has not been built yet. Run `npm install && npm run build` in the "
                "`frontend` folder (see README.md).",
                503,
            )
        response = send_file(index_path)
        # Always pick up a new build; the hashed JS/CSS assets can be cached normally.
        response.headers["Cache-Control"] = "no-cache"
        return response

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    # --- Shared capability lookup database ---------------------------------

    # Every page load downloads the whole database (tens of MB for a full export), so the
    # gzipped document is built once per upload and served from memory.
    database_cache = {"key": None, "gz": None}
    database_cache_lock = threading.Lock()

    def clear_database_cache():
        with database_cache_lock:
            database_cache.update(key=None, gz=None)

    @app.get("/api/database")
    def get_database():
        meta = db.get_capability_database_meta()
        if meta is None:
            return jsonify(None)
        key = (meta["uploadedAt"], meta["rowCount"], meta["filename"])
        with database_cache_lock:
            if database_cache["key"] != key:
                database_cache.update(key=key, gz=gzip.compress(db.get_capability_database_json(), 6))
            payload = database_cache["gz"]

        if request.accept_encodings["gzip"]:
            response = Response(payload, mimetype="application/json")
            response.headers["Content-Encoding"] = "gzip"
        else:
            response = Response(gzip.decompress(payload), mimetype="application/json")
        response.headers["Vary"] = "Accept-Encoding"
        return response

    @app.put("/api/database")
    def put_database():
        body = _json_body()
        rows = body.get("rows")
        if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
            abort(400, description="'rows' must be a list of database records.")
        filename = body.get("filename")
        meta = db.replace_capability_database(rows, str(filename) if filename else None)
        clear_database_cache()
        return jsonify(meta)

    @app.delete("/api/database")
    def delete_database():
        db.delete_capability_database()
        clear_database_cache()
        return "", 204

    @app.post("/api/database/import-xlsx")
    def import_database_xlsx():
        """Turn an uploaded .xlsx into CSV text; the browser then parses and saves it as usual."""
        upload = request.files.get("file")
        if upload is None or not upload.filename:
            abort(400, description="Upload an .xlsx file in the 'file' field.")
        try:
            csv_text, sheet, rows = xlsx_to_csv(upload.stream)
        except Exception as exc:
            log.warning("Could not read uploaded workbook %r: %s", upload.filename, exc)
            abort(400, description="Could not read this file as an Excel workbook (.xlsx).")
        return jsonify(csv=csv_text, sheet=sheet, rows=rows)

    # --- Shared saved options ------------------------------------------------

    @app.get("/api/saved-options")
    def list_saved_options():
        return jsonify(db.list_saved_options())

    @app.post("/api/saved-options")
    def create_saved_option():
        option = _validate_option(_json_body())
        if not option["id"]:
            abort(400, description="Saved option needs an id.")
        if db.saved_option_name_taken(option["name"]):
            abort(409, description=f'An option named "{option["name"]}" already exists.')
        try:
            db.create_saved_option(option)
        except sqlite3.IntegrityError:
            abort(409, description="A saved option with this id already exists.")
        return jsonify(option), 201

    @app.put("/api/saved-options/<option_id>")
    def update_saved_option(option_id):
        option = _validate_option(_json_body())
        option["id"] = option_id
        if db.saved_option_name_taken(option["name"], exclude_id=option_id):
            abort(409, description=f'An option named "{option["name"]}" already exists.')
        if not db.update_saved_option(option_id, option):
            abort(404, description="Saved option not found (it may have been deleted by another user).")
        return jsonify(option)

    @app.delete("/api/saved-options/<option_id>")
    def delete_saved_option(option_id):
        db.delete_saved_option(option_id)
        return "", 204

    # --- Rule-based assistant -----------------------------------------------

    @app.post("/api/chat")
    def chat():
        body = request.get_json(silent=True) or {}
        messages = body.get("messages")
        if not isinstance(messages, list):
            return jsonify(error="Messages array is required."), 400
        try:
            return jsonify(process_rule_based_query(messages, body.get("dataState"), body.get("activeStrategy")))
        except Exception:
            log.exception("Local rule-based engine error")
            return jsonify(
                text="### ⚠️ System Notice\n\nAn unexpected error occurred while processing your request locally.",
                updatedPitches=None,
            ), 500

    # --- Excel export ----------------------------------------------------------

    @app.post("/api/export/xlsx")
    def export_xlsx():
        body = _json_body()
        pitches = body.get("pitches")
        if not isinstance(pitches, list):
            abort(400, description="'pitches' must be a list.")
        buffer = build_feasibility_workbook(pitches, body.get("allocations") or [], body.get("strategyName") or "")
        return send_file(
            buffer,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"feasibility_export_{datetime.now():%Y%m%d_%H%M%S}.xlsx",
        )

    # Avoid HTML error pages leaking into API responses.
    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        if request.path.startswith("/api/"):
            return jsonify(error=err.description), err.code
        return err

    @app.errorhandler(Exception)
    def handle_unexpected_error(err):
        log.exception("Unhandled server error")
        if request.path.startswith("/api/"):
            return jsonify(error="An unexpected server-side error occurred."), 500
        return "Internal Server Error", 500
