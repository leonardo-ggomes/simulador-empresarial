@echo off
chcp 65001 >nul
echo === Aurora Business Lab - Gerar executavel Windows ===
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org ^(versao 22.13 ou superior^) & pause & exit /b 1)
node scripts/build.mjs --win %*
if errorlevel 1 (echo. & echo Falha no build. & pause & exit /b 1)
echo.
echo Pronto! Veja a pasta "dist".
pause
