@echo off
setlocal

rem Resolve the PowerShell launcher relative to this BAT file.
set "SCRIPT_DIR=%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start_yukkuri_movie_maker.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Startup failed. See the messages above.
  echo The startup log is also available in logs\launcher.
) else (
  echo.
  echo The startup process or server has ended.
)

echo Press any key to close this window.
pause >nul
exit /b %EXIT_CODE%
