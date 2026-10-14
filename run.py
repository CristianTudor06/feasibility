"""Production entry point: serves the app with Waitress (works on Windows and Linux).

    python run.py                      # listens on 0.0.0.0:5007
    python run.py --port 8080          # custom port
    set FEASIBILITY_DB=D:\\data\\cmt.db  # optional: custom SQLite location
"""

import argparse
import logging
import os

from waitress import serve

from feasibility import create_app


def main():
    parser = argparse.ArgumentParser(description="Run the CMT feasibility tool server.")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"),
                        help="Interface to bind (default 0.0.0.0 = reachable from the network)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "5007")))
    parser.add_argument("--threads", type=int, default=int(os.environ.get("THREADS", "8")))
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app = create_app()
    logging.getLogger(__name__).info(
        "Serving on http://%s:%d (database: %s)", args.host, args.port, app.config["DATABASE"]
    )
    serve(app, host=args.host, port=args.port, threads=args.threads)


if __name__ == "__main__":
    main()
