@echo off
REM Starts the CMT feasibility tool. First run creates the virtual environment.
REM Usage: serve.bat [--port 5007]
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv || goto :error
    ".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto :error
)

".venv\Scripts\python.exe" run.py %*
goto :eof

:error
echo.
echo Setup failed. Make sure Python 3.10+ is installed and on PATH.
pause
exit /b 1
