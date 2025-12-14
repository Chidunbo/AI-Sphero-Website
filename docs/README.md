# AI Sphero Website

A web application that uses Teachable Machine image classification to control a Sphero BOLT robot with hand gestures in real time.

## Project Structure

```
AI-Sphero-Website/
├── frontend/              # Frontend web application
│   ├── index.html         # Main HTML file
│   ├── style.css          # Styling
│   ├── app.js             # Main application logic
│   ├── gesture-config.js  # Gesture configuration
│   └── movement-control.js # Movement control module
│
├── backend/               # Flask backend API
│   ├── app.py            # Flask server
│   ├── requirements.txt  # Python dependencies
│   └── README.md         # Backend documentation
│
├── lib/                   # Third-party libraries
│   └── boltAPP/          # Sphero BOLT Web Bluetooth library
│       ├── const.js
│       ├── queue.js
│       ├── spheroBolt.js
│       └── utils.js
│
├── models/                # ML model files (uploaded by user)
│   ├── metadata.json
│   ├── model.json
│   ├── weights.bin
│   └── README.txt
│
├── scripts/               # Utility scripts
│   ├── start_backend.bat  # Windows startup script
│   └── start_backend.sh   # Linux/Mac startup script
│
└── docs/                  # Documentation
    ├── README.md          # This file
    └── GESTURE_CONFIG_README.md  # Gesture configuration guide
```

## Features

- **Model Upload**: Upload Teachable Machine models via ZIP file
- **Real-time Gesture Detection**: Use webcam to detect gestures
- **Sphero BOLT Control**: Control robot via Web Bluetooth (no backend needed)
- **Customizable Actions**: Configure actions (roll, angle, stop) for each gesture label
- **Color Customization**: Set matrix colors for each label
- **Visual Feedback**: Virtual LED matrix and debug terminal

## Quick Start

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the Backend Server

**Windows:**
```bash
scripts\start_backend.bat
```

**Linux/Mac:**
```bash
bash scripts/start_backend.sh
```

Or manually:
```bash
cd backend
python app.py
```

The server will start on `http://localhost:5000`

### 3. Open the Application

Open your browser and navigate to: **http://localhost:5000**

### 4. Load Your Model

1. Upload a ZIP file containing your Teachable Machine model files (metadata.json, model.json, weights.bin)
2. Click "Load Model"
3. Configure label colors and actions
4. Click "Update Color & Action" to apply changes
5. Turn on camera
6. Connect to Sphero BOLT
7. Start controlling with gestures!

## Architecture

- **Frontend**: HTML/JavaScript application running in the browser
  - Handles ML model loading and predictions
  - Webcam capture and gesture detection
  - Sphero BOLT control via Web Bluetooth API
  - User interface for model and robot configuration

- **Backend**: Flask API server
  - Handles model file uploads (ZIP extraction)
  - Serves static files (HTML, CSS, JS)
  - Model file management (clear/delete)

- **Sphero Connection**: Direct browser-to-robot communication
  - Uses Web Bluetooth API (Chrome/Edge/Opera)
  - No backend involvement in robot control
  - Real-time command execution

## Requirements

- Python 3.7+
- Modern web browser with Web Bluetooth support (Chrome, Edge, Opera)
- Sphero BOLT robot
- Webcam/camera access
- Exported Teachable Machine model (TensorFlow.js format)

## Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Edge
- ✅ Opera
- ❌ Firefox (no Web Bluetooth support)
- ❌ Safari (no Web Bluetooth support)

## Troubleshooting

### Backend Issues
- **"No module named 'flask'"**: Run `pip install -r backend/requirements.txt`
- **Port already in use**: Change port in `backend/app.py` or stop other services on port 5000

### Frontend Issues
- **"SpheroBolt is not defined"**: Make sure backend is running and serving files correctly
- **Model won't load**: Check that model files are in `models/` folder
- **Web Bluetooth not working**: Use Chrome, Edge, or Opera browser

### Sphero Connection Issues
- **Device not found**: Make sure Sphero BOLT is powered on and nearby
- **Connection fails**: Check Bluetooth is enabled on your computer
- **Permission denied**: Allow Bluetooth access when prompted by browser

## Customization

See `docs/GESTURE_CONFIG_README.md` for information on customizing gesture controls.

## License

This is a classroom project for educational purposes.
