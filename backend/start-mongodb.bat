@echo off
echo Starting MongoDB service...
net start MongoDB
if %errorlevel% neq 0 (
    echo MongoDB service not found. Trying to start mongod directly...
    start "MongoDB" mongod --dbpath "C:\data\db"
    echo MongoDB started manually. Keep this window open.
) else (
    echo MongoDB service started successfully!
)
pause
