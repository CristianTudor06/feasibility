"""SQLite storage for the state shared by every user of the server.

Only two things are shared: the capability lookup database (uploaded CSV) and the
saved scenario options. Working specs and UI preferences stay in each browser.
"""

import json
import sqlite3
from datetime import datetime, timezone

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS capability_upload (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    filename    TEXT,
    uploaded_at TEXT NOT NULL,
    row_count   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_rows (
    position INTEGER PRIMARY KEY,
    market   TEXT,
    target   TEXT,
    data     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_options (
    seq        INTEGER PRIMARY KEY AUTOINCREMENT,
    id         TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    timestamp  TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(current_app.config["DATABASE"], timeout=30)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


def close_db(_exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db(path):
    conn = sqlite3.connect(path)
    try:
        # WAL lets readers proceed while another request is writing.
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


# --- Capability lookup database ---------------------------------------------

def get_capability_database_meta():
    meta = get_db().execute(
        "SELECT filename, uploaded_at, row_count FROM capability_upload WHERE id = 1"
    ).fetchone()
    if meta is None:
        return None
    return {"filename": meta["filename"], "uploadedAt": meta["uploaded_at"], "rowCount": meta["row_count"]}


def get_capability_database_json():
    """The whole database as a UTF-8 JSON document, assembled from the stored row JSON
    without decoding it (a large database is tens of MB). None when nothing is uploaded."""
    meta = get_capability_database_meta()
    if meta is None:
        return None
    rows = get_db().execute("SELECT data FROM capability_rows ORDER BY position")
    body = ",".join(r["data"] for r in rows)
    return (
        '{"rows":[' + body + '],"filename":' + json.dumps(meta["filename"])
        + ',"uploadedAt":' + json.dumps(meta["uploadedAt"]) + "}"
    ).encode("utf-8")


def replace_capability_database(rows, filename):
    db = get_db()
    uploaded_at = _now()
    with db:
        db.execute("DELETE FROM capability_rows")
        db.executemany(
            "INSERT INTO capability_rows (position, market, target, data) VALUES (?, ?, ?, ?)",
            [
                (i, str(r.get("market") or ""), str(r.get("target") or ""), json.dumps(r))
                for i, r in enumerate(rows)
            ],
        )
        db.execute(
            "INSERT OR REPLACE INTO capability_upload (id, filename, uploaded_at, row_count) VALUES (1, ?, ?, ?)",
            (filename, uploaded_at, len(rows)),
        )
    return {"filename": filename, "uploadedAt": uploaded_at, "rowCount": len(rows)}


def delete_capability_database():
    db = get_db()
    with db:
        db.execute("DELETE FROM capability_rows")
        db.execute("DELETE FROM capability_upload")


# --- Saved options ------------------------------------------------------------

def _option_from_row(row):
    return {"id": row["id"], "name": row["name"], "timestamp": row["timestamp"], "data": json.loads(row["data"])}


def list_saved_options():
    rows = get_db().execute("SELECT id, name, timestamp, data FROM saved_options ORDER BY seq")
    return [_option_from_row(r) for r in rows]


def saved_option_name_taken(name, exclude_id=None):
    row = get_db().execute(
        "SELECT 1 FROM saved_options WHERE lower(name) = lower(?) AND id IS NOT ?",
        (name, exclude_id),
    ).fetchone()
    return row is not None


def create_saved_option(option):
    db = get_db()
    now = _now()
    with db:
        db.execute(
            "INSERT INTO saved_options (id, name, timestamp, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (option["id"], option["name"], option["timestamp"], json.dumps(option["data"]), now, now),
        )
    return option


def update_saved_option(option_id, option):
    db = get_db()
    with db:
        cur = db.execute(
            "UPDATE saved_options SET name = ?, timestamp = ?, data = ?, updated_at = ? WHERE id = ?",
            (option["name"], option["timestamp"], json.dumps(option["data"]), _now(), option_id),
        )
    return cur.rowcount > 0


def delete_saved_option(option_id):
    db = get_db()
    with db:
        cur = db.execute("DELETE FROM saved_options WHERE id = ?", (option_id,))
    return cur.rowcount > 0
