@echo off
REM TensorFlow.js build script (Windows CMD)
REM Uses Visual Studio Developer Command Prompt environment

echo Setting up Visual Studio environment...

REM Save current directory
set "ORIGINAL_DIR=%CD%"

REM Clean PATH before calling VsDevCmd.bat to avoid conflicts
REM Keep only essential system paths
set "CLEAN_PATH=%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem"
set "PATH=%CLEAN_PATH%"

REM Call Visual Studio Developer Command Prompt environment setup
call "D:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat"

if errorlevel 1 (
    echo [ERROR] Failed to load Visual Studio environment
    echo Please confirm Visual Studio is installed at: D:\Program Files\Microsoft Visual Studio\18\Community
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

echo [OK] Visual Studio environment loaded

REM Set node-gyp environment variables (tell node-gyp this is VS 2022)
set GYP_MSVS_VERSION=2022
set npm_config_msvs_version=2022

REM Ensure Node.js is in PATH (if not already)
where npm >nul 2>&1
if errorlevel 1 (
    echo [WARN] npm not found in PATH, trying to add Node.js path...
    if exist "C:\Program Files\nodejs\npm.cmd" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    ) else if exist "C:\Program Files (x86)\nodejs\npm.cmd" (
        set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
    ) else (
        echo [ERROR] Cannot find npm, please confirm Node.js is installed
        echo Please manually add Node.js to PATH, or use full path to run npm
        cd /d "%ORIGINAL_DIR%"
        exit /b 1
    )
)

REM Verify npm is available
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is still not available
    echo Current PATH: %PATH%
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

echo [OK] npm found

REM Switch to project directory
cd /d "%~dp0\.."

echo.
echo Building TensorFlow.js...
echo This may take 5-15 minutes, please be patient...
echo.

REM Run build
call npm rebuild @tensorflow/tfjs-node --build-addon-from-source

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

echo.
echo [OK] Build completed!
echo.
echo Verifying build results...
if exist "node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node" (
    echo [OK] TensorFlow.js native module built successfully
    dir "node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node"
) else (
    echo [WARN] Build file not found, build may have failed
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

cd /d "%ORIGINAL_DIR%"
