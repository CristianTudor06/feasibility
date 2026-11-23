# CMT - Cost Management Tool (Pitch Feasibility & Cost Optimizer)

A Flask app for checking pitch feasibility and optimizing procurement costs. It is meant to be
self-hosted on a workstation and opened by colleagues at `http://<workstation-ip>:5007`.

## How it is put together

| Part | Where | Notes |
| --- | --- | --- |
| Web server + API | [feasibility/](feasibility/) | Flask, served in production by Waitress |
| Shared data | `instance/feasibility.db` | SQLite: the uploaded capability database + saved options |
| User interface | [frontend/](frontend/) (source) → [feasibility/static/](feasibility/static/) (built) | The original React app, prebuilt so the server needs only Python |
| Rule-based assistant | [frontend/src/lib/ruleEngine.ts](frontend/src/lib/ruleEngine.ts) | The original server's chat rules, run in the browser. Deterministic, no AI and no external calls |
| Excel export | [feasibility/excel_export.py](feasibility/excel_export.py) | Generated server-side with openpyxl |

**What is shared and what is personal.** The capability lookup database (*Insert Database*) and the
*Saved Options* are stored on the server, so everyone sees the same ones. The specs you are editing,
the chat history, Partner Mapping edits, the time zone, widget visibility, font size and target
budget stay in each person's own browser.

**Inserting a database.** *Insert Database* accepts a `.csv` or an Excel workbook (`.xlsx`). Prefer
the `.xlsx` (e.g. `Database V2.xlsx`): the server reads it directly, so long audience descriptions
with line breaks or quotes survive intact and Excel's regional CSV settings (`;` separators, `,`
decimals) don't matter. A full database is large (8.3k rows x 166 vendors is ~45 MB once parsed), so
the upload takes a few seconds; afterwards each user downloads it compressed (~1 MB).

The app needs no internet access. Fonts are bundled, and the .docx, .pptx, CSV and Excel exports
are all generated locally.

## Running it on the workstation

Requirements: **Python 3.10+**. Node.js is *not* needed to run the app.

```bat
git clone <this repo>
cd feasibility
serve.bat
```

On the first run, `serve.bat` creates a virtual environment in `.venv` and installs
[requirements.txt](requirements.txt). After that it starts the server on port 5007. Use
`serve.bat --port 8080` for another port.

You can also do this by hand (works on Linux/macOS too):

```bash
python -m venv .venv
.venv\Scripts\activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python run.py --port 5007
```

Then open `http://<workstation-ip>:5007` from any machine on the network.

### Allow colleagues to connect (Windows firewall)

Run once in an **administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "CMT Feasibility Tool" -Direction Inbound -Protocol TCP -LocalPort 5007 -Action Allow
```

### Start automatically when the workstation boots

Create a scheduled task that runs `serve.bat` at startup, again from an **administrator** PowerShell
(adjust the path):

```powershell
$action  = New-ScheduledTaskAction -Execute "C:\path\to\feasibility\serve.bat" -WorkingDirectory "C:\path\to\feasibility"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "CMT Feasibility Tool" -Action $action -Trigger $trigger -User "SYSTEM" -RunLevel Highest
```

### Configuration

| Setting | Default | How to change |
| --- | --- | --- |
| Port | `5007` | `run.py --port 8080` or env var `PORT` |
| Bind address | `0.0.0.0` (all interfaces) | `run.py --host 127.0.0.1` or env var `HOST` |
| Database file | `instance/feasibility.db` | env var `FEASIBILITY_DB=D:\data\cmt.db` |
| Max upload size | 256 MB | env var `FEASIBILITY_MAX_UPLOAD_MB` |

### Backups

All shared data lives in the single SQLite file (`instance/feasibility.db` by default). To back it
up, copy that file while the server is stopped, or use `sqlite3 feasibility.db ".backup backup.db"`
while it is running.

## Changing the user interface

The UI source is in [frontend/](frontend/). After editing it, rebuild it into
`feasibility/static/` and commit the result. This needs [Node.js](https://nodejs.org) 20+ on your
development machine, not on the workstation.

```bash
cd frontend
npm install
npm run build        # writes to ../feasibility/static
```

### Bringing in a new AI Studio export

Put the export next to the repo (folders named `feasibility_initial*` are git-ignored, because they
contain a Firebase config), merge its `src/` changes into `frontend/src/`, keeping the Flask-specific
edits (saved options and database via `lib/api.ts`, no Google code, the *Download Excel* button), and
re-sync the chat rules from its `server.ts`:

```bash
cd frontend
node scripts/sync-rule-engine.mjs ../feasibility_initial_XX/server.ts   # rewrites src/lib/ruleEngine.ts
npm run build
```

For live reloading while you develop, run Flask and the Vite dev server side by side:

```bash
flask --app feasibility run --debug          # API on http://127.0.0.1:5000
cd frontend && npm run dev                   # UI on http://localhost:5173 (proxies /api to Flask)
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` / `PUT` / `DELETE` | `/api/database` | Shared capability lookup database (`{rows, filename}`) |
| `POST` | `/api/database/import-xlsx` | Converts an uploaded `.xlsx` to CSV text for the browser's parser |
| `GET` / `POST` | `/api/saved-options` | List / create saved options |
| `PUT` / `DELETE` | `/api/saved-options/<id>` | Overwrite / delete a saved option |
| `POST` | `/api/export/xlsx` | Feasibility overview as an Excel file |
| `GET` | `/api/health` | Health check |

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## Differences from the AI Studio version

- Express and Node have been replaced by Flask and Python. The chat assistant's rules (the old
  `POST /api/chat` route) run in the browser instead, copied verbatim from the export's `server.ts`
  by `frontend/scripts/sync-rule-engine.mjs`, so they give identical answers and the shared
  database is not uploaded with every chat message.
- The capability database and saved options moved from browser `localStorage` to shared SQLite
  storage. The reset dialog only deletes the shared database if you tick its checkbox.
- The Google sign-in, Sheets, Docs and Slides code was removed. None of it was reachable from the
  UI, and it could not work from an internal IP. A **Download Excel** button next to *Download CSV*
  replaces the Sheets export.
- Fonts are bundled instead of being loaded from Google Fonts.
