@echo off
cd /d "%~dp0"
echo === type-check ===
call npm run type-check
if errorlevel 1 goto fail

echo.
echo === lint ===
call npm run lint
if errorlevel 1 goto fail

echo.
echo === build ===
call npm run build
if errorlevel 1 goto fail

echo.
echo === test ===
call npm test
if errorlevel 1 goto fail

echo.
echo ALL CHECKS PASSED
pause
exit /b 0

:fail
echo.
echo FAILED - see above
pause
exit /b 1
