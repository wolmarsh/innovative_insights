@echo off
title PDF Q&A Navigator Launcher
echo ===================================================
echo   Starting PDF Q&A Navigator API Server...
echo ===================================================
echo.

:: Check for python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3.12+ and try again.
    pause
    exit /b 1
)

:: Verify/install packages
echo Checking and installing required packages...
python -m pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo [WARNING] Failed to verify/install python packages. The server will try to run anyway.
)

:: Open the browser in 3 seconds asynchronously
echo Launching your browser to http://127.0.0.1:8000 ...
start "" "http://127.0.0.1:8000"

:: Start uvicorn
echo Starting FastAPI application...
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
pause
