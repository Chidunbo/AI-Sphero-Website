# Sphero Gesture Controller

A classroom project where middle school students train their own Teachable Machine image classification model to control a Sphero BOLT robot using hand gestures in real time through a webpage.

## Architecture

This project uses a **frontend/backend architecture**:
- **Frontend**: HTML/JavaScript web application that handles ML model loading, webcam, and gesture detection
- **Backend**: Flask API server that handles Bluetooth communication with the Sphero BOLT robot

## Project Structure

```
gesture-sphero-controller/
│
├── index.html          # Frontend: Main HTML file with UI
├── style.css           # Frontend: Styling for the webpage
├── app.js              # Frontend: ML model loading, predictions, and API calls
│
├── backend/            # Backend: Flask API server
│   ├── app.py          # Flask server with Sphero Bluetooth communication
│   └── requirements.txt # Python dependencies
│
├── my_model/           # Place your EXPORTED Teachable Machine model files here
│   ├── model.json      # Model architecture (from Teachable Machine export)
│   ├── metadata.json   # Model metadata (from Teachable Machine export)
│   └── weights.bin     # Model weights (from Teachable Machine export)
│
└── training_data/      # Training datasets (for reference/retraining)
    ├── hand-samples.zip
    └── head-samples.zip
```

## How It Works

1. **Training Data**: The `training_data/` folder contains zip files with training samples (hand gestures, head movements, etc.) that were used to train the model in Teachable Machine.

2. **Exported Model**: After training in Teachable Machine, export your model and place the files (`model.json`, `metadata.json`, `weights.bin`) in the `my_model/` folder.

3. **Running the Application**: 
   - Click "Start Model" to load your exported model
   - Click "Turn On Camera" to request webcam access
   - Click "Connect to Sphero BOLT" to pair with your robot
   - Show gestures to control the robot!

## Setup Instructions

### Prerequisites

1. **Python 3.7+** installed
2. **Modern web browser** (Chrome/Edge recommended)
3. **Sphero BOLT robot** powered on and nearby
4. **Bluetooth enabled** on your computer

### Step 1: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Note for Windows users**: You may need to install additional Bluetooth libraries. If you encounter issues with `bleak`, try:
```bash
pip install bleak[winrt]
```

### Step 2: Start the Backend Server

```bash
cd backend
python app.py
```

The backend will start on `http://localhost:5000`. Keep this terminal window open!

### Step 3: Start the Frontend Server

**Open a NEW terminal window** and run:

**Option 1: Python** (usually pre-installed)
```bash
python -m http.server 8000 --bind 127.0.0.1
```

**Option 2: Node.js**
```bash
npx http-server -p 8000 -a localhost
```

**Option 3: VS Code**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

### Step 4: Open the Application

Open your browser and navigate to:
- http://localhost:8000 or http://127.0.0.1:8000

**⚠️ IMPORTANT**: You MUST run both servers:
- Backend (port 5000) - handles Sphero communication
- Frontend (port 8000) - serves the web page

See `START_SERVER.md` for detailed frontend server instructions.

### Step 5: Train and Export Your Model

1. **Train Your Model** (if not already done):
   - Go to https://teachablemachine.withgoogle.com/
   - Create an Image Classification project
   - Use the training data from `training_data/` folder if needed
   - Train your model with gesture classes

2. **Export Your Model**:
   - Click "Export Model" in Teachable Machine
   - Choose "TensorFlow.js" format
   - Download the zip file

3. **Install Model Files**:
   - Extract the downloaded zip file
   - Copy `model.json`, `metadata.json`, and `weights.bin` files into the `my_model/` folder
   - Replace any placeholder files

### Step 6: Use the Application

1. **Start Model**: Click "Start Model" to load your exported model
2. **Turn On Camera**: Click "Turn On Camera" to start the webcam
3. **Connect to Sphero**: Click "Connect to Sphero BOLT" to pair with your robot
   - The backend will scan for nearby Sphero devices
   - Once connected, the robot will light up green and display "OK" on its LED matrix
4. **Control with Gestures**: Show your gestures to control the robot!

## Customizing Gesture Controls

Gesture controls are now modular and easy to customize! Edit the `gesture-config.js` file to map your gesture class names to robot actions.

### Quick Example

The default configuration maps:
- **"hand"** → Turn to 0° (forward direction)
- **"head"** → Turn to 90° (right direction)

### How to Customize

1. Open `gesture-config.js`
2. Modify the `GESTURE_CONFIG` object to add/edit gesture mappings
3. Each gesture can have multiple actions (turn, drive, setColor, stop, scrollText)
4. Refresh your browser to load the new configuration

See `GESTURE_CONFIG_README.md` for detailed documentation and examples!

## How It Works

1. **Frontend (Browser)**:
   - Loads the Teachable Machine model
   - Captures webcam feed
   - Runs gesture predictions
   - Sends commands to backend via HTTP API

2. **Backend (Python Flask)**:
   - Receives commands from frontend
   - Communicates with Sphero BOLT via Bluetooth (using `bleak` library)
   - Sends commands to control robot movement, LED colors, and LED matrix

## Troubleshooting

### Backend Issues

- **"No module named 'flask'"**: Run `pip install -r backend/requirements.txt`
- **"No Sphero devices found"**: 
  - Make sure your Sphero BOLT is powered on
  - Ensure Bluetooth is enabled on your computer
  - Try moving the robot closer
- **Connection fails**: Check that the backend server is running on port 5000

### Frontend Issues

- **"Failed to fetch"**: Make sure the backend server is running
- **Model won't load**: Check that model files are in `my_model/` folder
- **CORS errors**: Make sure you're accessing via the web server (not file://)

## Requirements

- Python 3.7+
- Modern web browser (Chrome/Edge recommended)
- Sphero BOLT robot
- Webcam/camera access
- Exported Teachable Machine model files
- Bluetooth enabled on your computer

## Notes

- Training data in `training_data/` is for reference only - the running application uses the exported model files
- The model must be trained and exported from Teachable Machine before use
- Gesture confidence threshold is set to 85% to prevent false triggers
- The backend must be running before connecting to Sphero

