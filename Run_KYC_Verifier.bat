@echo off
title Ashraf Finance - KYC Selfie & ID Card Verifier
cd /d "%~dp0"
start "" "http://127.0.0.1:8000"
python kyc_verifier.py
pause
