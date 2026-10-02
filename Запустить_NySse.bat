@echo off
chcp 65001 >nul
title NySse Writer

echo ======================================================
echo    Запуск NySse Writer (Академический редактор)
echo ======================================================
echo.

where npx >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [i] Node.js обнаружен. Загрузка и запуск через npx...
    echo.
    call npx -y github:Bilkawitch/NySse_writer
) else (
    echo [i] Node.js не обнаружен на этом компьютере.
    echo [i] Открытие автономной версии в браузере...
    start "" "https://bilkawitch.github.io/NySse_writer/"
)

pause
