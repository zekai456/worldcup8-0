@echo off
chcp 65001 >nul
title 世界杯 8-0：传奇之路
cd /d "%~dp0"

echo ============================================
echo   世界杯 8-0：传奇之路  ·  一键启动
echo ============================================
echo.

REM ---- 1. 安装依赖（仅首次或缺失时）----
if not exist "server\node_modules" (
  echo [1/3] 正在安装后端依赖...
  call npm --prefix server install || goto :err
) else (
  echo [1/3] 后端依赖已就绪，跳过安装。
)

if not exist "client\node_modules" (
  echo       正在安装前端依赖...
  call npm --prefix client install || goto :err
) else (
  echo       前端依赖已就绪，跳过安装。
)

REM ---- 2. 构建前端 ----
echo [2/3] 正在构建前端...
call npm --prefix client run build || goto :err

REM ---- 3. 启动单进程服务（后端托管前端）----
echo [3/3] 启动服务  http://localhost:8787
echo.
echo   游戏地址：http://localhost:8787
echo   关闭此窗口即可停止游戏。
echo.

REM 稍候片刻再打开浏览器，确保服务已监听
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8787"

node server\src\index.js
goto :eof

:err
echo.
echo *** 启动失败，请检查上面的错误信息。***
pause
