@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo === Lincoln Brief - Deploy ===
echo.

REM 1) status
echo [1/5] git status
git status --short
echo.

REM 2) confirm
set /p CONFIRM=Continue? (y/N):
if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

REM 3) commit (message body read from commit-msg.txt, UTF-8)
echo.
echo [2/5] add + commit
git add -A
git commit -F commit-msg.txt

if errorlevel 1 (
    echo.
    echo [ERROR] commit failed.
    pause
    exit /b 1
)

REM 4) rebase onto origin
echo.
echo [3/5] pull --rebase origin main
git pull --rebase origin main

if errorlevel 1 (
    echo.
    echo [WARN] rebase conflict. Resolve manually:
    echo   1) git status
    echo   2) fix conflicts, then: git add . ^&^& git rebase --continue
    echo   3) then: git push origin main
    echo   - or abort: git rebase --abort
    pause
    exit /b 1
)

REM 5) push
echo.
echo [4/5] push origin main
git push origin main

if errorlevel 1 (
    echo.
    echo [ERROR] push failed. Check auth/network.
    echo (Auth not set: gh auth login   or   Git Credential Manager)
    pause
    exit /b 1
)

echo.
echo [5/5] Done.
echo.
echo Vercel auto-deploy starts in 1-3 min.
echo   Dashboard: https://vercel.com/dashboard
echo   Site:      https://lincoln-brief.vercel.app
echo.

pause
