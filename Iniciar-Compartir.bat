@echo off
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set "PYTHON_EXE=py -3"
  ) else (
    set "PYTHON_EXE=python"
  )
)

echo Iniciando servidor local...
start "" cmd /k "%PYTHON_EXE% app.py"

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8080"

endlocal
