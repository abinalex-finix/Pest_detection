@echo off
echo Starting AgriLens Flask Server...
start /B python app.py

echo.
echo Starting Secure Public Tunnel (Cloudflare)...
echo Please wait a few seconds for the tunnel to connect.
echo Look for the link ending in ".trycloudflare.com" below!
echo.
.\cloudflared.exe tunnel --url http://localhost:5000
pause
