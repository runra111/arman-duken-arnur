@echo off
cd /d "%~dp0"
start "" http://localhost:5180/
python serve.py
