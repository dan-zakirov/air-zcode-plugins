@echo off
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0run-ui-patch.ps1"
exit /b %errorlevel%
