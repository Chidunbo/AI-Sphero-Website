# How to Run the Project

## ⚠️ IMPORTANT: You MUST run a local web server!

Browsers block loading local files for security reasons. You cannot simply double-click `index.html` - you need to run a web server.

## Quick Start Options:

### Option 1: Python (Recommended - Usually Pre-installed)
1. Open Terminal/Command Prompt in this folder
2. Run: `python -m http.server 8000 --bind 127.0.0.1`
   - Or on Windows PowerShell: `python -m http.server 8000 -b 127.0.0.1`
3. Open browser and go to: `http://localhost:8000` or `http://127.0.0.1:8000`
4. Click on `index.html`

### Option 2: Node.js
1. Open Terminal/Command Prompt in this folder
2. Run: `npx http-server -p 8000 -a localhost`
3. Open browser and go to: `http://localhost:8000` or `http://127.0.0.1:8000`
4. Click on `index.html`

### Option 3: VS Code (Easiest!)
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"
4. Browser will open automatically!

### Option 4: Online Hosting
Upload all files to:
- GitHub Pages
- Netlify
- Vercel
- Any web hosting service

## Troubleshooting:

**Error: "ERR_ADDRESS_INVALID" or "http://[::]:8000/"**
- The server is binding to IPv6. Use this command instead:
  ```bash
  python -m http.server 8000 --bind 127.0.0.1
  ```
- Then access: `http://127.0.0.1:8000` or `http://localhost:8000`

**Error: "Could not find model files"**
- Make sure `model.json`, `metadata.json`, and `weights.bin` are in the `my_model` folder
- Make sure you're running a web server (not opening file:// directly)

**Error: CORS error**
- You're opening the file directly (file://). Use a web server instead (see options above)

**Model won't load**
- Check browser console (F12) for detailed error messages
- Verify all files are in the correct folders
- Make sure the web server is running

