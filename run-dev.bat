@echo off
REM Lincoln Brief - 로컬 개발 서버 실행
REM 더블클릭하면 의존성 설치(최초 1회) 후 dev 서버 시작

cd /d "%~dp0"

echo.
echo === Lincoln Brief - Local Dev ===
echo.

if not exist node_modules (
    echo [1/2] 의존성 설치 중... 한 번만 실행됩니다.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install 실패. Node.js 가 설치되어 있는지 확인하세요.
        echo Node.js 다운로드: https://nodejs.org/
        pause
        exit /b 1
    )
) else (
    echo [1/2] node_modules 이미 존재 - 설치 건너뜀
)

echo.
echo [2/2] dev 서버 시작... 브라우저에서 http://localhost:4321 열기
echo (종료: Ctrl+C)
echo.

call npm run dev

pause
