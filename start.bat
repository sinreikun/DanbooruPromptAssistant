@echo off
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
npm start
pause

