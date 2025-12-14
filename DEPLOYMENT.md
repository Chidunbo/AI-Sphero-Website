# Deployment Guide for Sphero Gesture Controller

## ⚠️ Important Limitation: Bluetooth Requirement

**This application requires Bluetooth access to communicate with the Sphero BOLT robot.** This creates a fundamental constraint:

- **Cannot run on remote cloud servers** (no Bluetooth access)
- **Must run on a local machine** with Bluetooth capability
- **Browser security** prevents remote websites from accessing local Bluetooth

## Deployment Options

### ✅ Option 1: Local Deployment (RECOMMENDED)

**Best for**: Single user or classroom with one computer

**How it works**: Run everything on the same machine that has Bluetooth access.

**Steps**:
1. Install Python and dependencies on the local machine
2. Run the Flask backend: `python backend/app.py`
3. Access via `http://localhost:5000` (Flask serves both API and frontend)

**Pros**:
- Simplest setup
- Full functionality
- No network configuration needed

**Cons**:
- Only accessible from that one machine
- Must be running to use

---

### ✅ Option 2: Local Network Deployment

**Best for**: Classroom with multiple devices, same WiFi network

**How it works**: Backend runs on one machine with Bluetooth, frontend accessible from other devices on the same network.

**Steps**:

1. **On the server machine** (with Bluetooth and Sphero):
   ```bash
   cd backend
   python app.py
   ```
   The backend will start on `0.0.0.0:5000` (already configured)

2. **Find the server's IP address**:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr`
   - Example: `192.168.1.100`

3. **On client devices** (tablets, phones, other computers):
   - Open browser and go to: `http://192.168.1.100:5000`
   - All devices can access the web interface
   - Only the server machine needs Bluetooth

**Pros**:
- Multiple users can access from different devices
- Only one machine needs Bluetooth
- Works on same WiFi network

**Cons**:
- Requires network configuration
- Server machine must stay on and connected
- May need firewall configuration

**Firewall Configuration**:
- **Windows**: Allow Python through Windows Firewall on port 5000
- **Mac**: System Preferences → Security → Firewall → Allow Python
- **Linux**: `sudo ufw allow 5000`

---

### ⚠️ Option 3: Hybrid Deployment (Frontend on Cloud, Backend Local)

**Best for**: Sharing the interface, but still requires local backend

**How it works**: 
- Deploy frontend (HTML/CSS/JS) to a static hosting service
- Backend must still run locally on a machine with Bluetooth
- Frontend connects to local backend via API

**Frontend Hosting Options**:
- **GitHub Pages** (free)
- **Netlify** (free tier)
- **Vercel** (free tier)
- **AWS S3 + CloudFront**

**Steps**:

1. **Deploy Frontend**:
   ```bash
   # Create a build directory with frontend files
   mkdir deploy
   cp index.html deploy/
   cp style.css deploy/
   cp app.js deploy/
   cp gesture-config.js deploy/
   # Upload deploy/ folder to your hosting service
   ```

2. **Update API URL in app.js**:
   ```javascript
   // Change from relative path to your local server IP
   const API_BASE_URL = 'http://YOUR_LOCAL_IP:5000/api';
   ```

3. **Run Backend Locally**:
   ```bash
   python backend/app.py
   ```

**Pros**:
- Frontend accessible from anywhere
- Easy to share link

**Cons**:
- Backend still must run locally
- CORS issues may occur (need to configure)
- More complex setup
- Security concerns (exposing local server)

**CORS Configuration** (if needed):
```python
# In backend/app.py, update CORS to allow your frontend domain
CORS(app, origins=["https://your-frontend-domain.com"])
```

---

### ❌ Option 4: Full Cloud Deployment (NOT POSSIBLE)

**Why it won't work**:
- Cloud servers don't have Bluetooth hardware
- Even if they did, you can't connect to a Sphero that's physically near you
- Browser security prevents remote websites from accessing local Bluetooth

**Alternative**: Use Web Bluetooth API (limited browser support, still requires local device)

---

## Recommended Setup for Different Scenarios

### Scenario 1: Single User / Personal Project
→ **Use Option 1** (Local Deployment)
- Simplest and most reliable
- Access via `http://localhost:5000`

### Scenario 2: Classroom with Multiple Students
→ **Use Option 2** (Local Network Deployment)
- One teacher computer runs backend with Bluetooth
- Students access from tablets/laptops on same WiFi
- All share the same Sphero robot

### Scenario 3: Demo / Presentation
→ **Use Option 1 or 2**
- For live demo: Option 1 (single machine)
- For multiple viewers: Option 2 (local network)

### Scenario 4: Sharing with Remote Users
→ **Not Recommended** (Bluetooth limitation)
- Users would need their own Sphero robot
- Each user needs to run backend locally
- Better to share the code repository instead

---

## Production-Ready Optimizations

### 1. Environment Variables

Create a `.env` file for configuration:

```python
# backend/.env
FLASK_ENV=production
FLASK_DEBUG=False
PORT=5000
HOST=0.0.0.0
```

Update `app.py`:
```python
import os
from dotenv import load_dotenv

load_dotenv()

app.run(
    host=os.getenv('HOST', '0.0.0.0'),
    port=int(os.getenv('PORT', 5000)),
    debug=os.getenv('FLASK_DEBUG', 'False') == 'True'
)
```

### 2. Production WSGI Server

Instead of Flask's development server, use a production server:

**Option A: Waitress** (Windows-friendly)
```bash
pip install waitress
```

```python
# backend/app.py (at the bottom)
from waitress import serve

if __name__ == '__main__':
    if os.getenv('FLASK_ENV') == 'production':
        serve(app, host='0.0.0.0', port=5000)
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)
```

**Option B: Gunicorn** (Linux/Mac)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 3. Security Considerations

For local network deployment:

```python
# backend/app.py
from flask import Flask, request
import logging

# Only allow requests from local network
@app.before_request
def limit_remote_addr():
    if request.remote_addr not in ['127.0.0.1', '::1']:
        # Check if it's a local network IP
        ip_parts = request.remote_addr.split('.')
        if ip_parts[0] not in ['192', '10', '172']:
            return "Access denied", 403
```

### 4. Error Handling & Logging

```python
# backend/app.py
import logging
from logging.handlers import RotatingFileHandler

if not app.debug:
    file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
```

### 5. Static File Optimization

For production, consider:
- Minifying JavaScript/CSS
- Compressing model files
- Using CDN for TensorFlow.js (already done)

---

## Quick Start: Local Network Deployment

**Step 1**: Start backend on server machine
```bash
cd backend
python app.py
```

**Step 2**: Find server IP address
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
# or
hostname -I
```

**Step 3**: Access from other devices
- Open browser on any device on same network
- Go to: `http://SERVER_IP:5000`
- Example: `http://192.168.1.100:5000`

**Step 4**: Configure firewall (if needed)
- Allow port 5000 through firewall
- Windows: Windows Defender Firewall → Allow an app
- Mac: System Preferences → Security → Firewall

---

## Troubleshooting Deployment

### "Connection refused" from other devices
- Check firewall settings
- Verify server is running on `0.0.0.0:5000` (not `127.0.0.1`)
- Ensure devices are on same network

### CORS errors
- Backend already has `CORS(app)` enabled
- If issues persist, check browser console for specific error

### Bluetooth not working
- Backend must run on machine with Bluetooth
- Check Bluetooth is enabled
- Verify Sphero is powered on and nearby

### Model files not loading
- Ensure `my_model/` folder is accessible
- Check file permissions
- Verify model files exist

---

## Summary

**For most use cases**: Use **Local Network Deployment (Option 2)**
- One machine runs backend with Bluetooth
- Multiple devices can access the web interface
- Works great for classrooms and demos

**For single user**: Use **Local Deployment (Option 1)**
- Simplest setup
- Everything on one machine

**Remember**: Bluetooth requires local hardware, so full cloud deployment is not possible. The backend must always run on a machine with Bluetooth access to the Sphero robot.

