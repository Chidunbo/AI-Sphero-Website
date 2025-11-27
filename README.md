# Sphero Gesture Controller

A classroom project where middle school students train their own Teachable Machine image classification model to control a Sphero BOLT robot using hand gestures in real time through a webpage.

## Project Structure

```
gesture-sphero-controller/
│
├── index.html          # Main HTML file with UI
├── style.css           # Styling for the webpage
├── app.js              # JavaScript with ML model loading, predictions, and Sphero control
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

## ⚠️ IMPORTANT: Run a Local Web Server!

**You CANNOT simply double-click `index.html`!** Browsers block loading local files for security. You MUST run a web server.

### Quick Server Setup:

**Option 1: Python** (usually pre-installed)
```bash
python -m http.server 8000 --bind 127.0.0.1
```
Then open: http://localhost:8000 or http://127.0.0.1:8000

**Option 2: Node.js**
```bash
npx http-server -p 8000 -a localhost
```
Then open: http://localhost:8000 or http://127.0.0.1:8000

**Option 3: VS Code**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

See `START_SERVER.md` for detailed instructions.

## Setup Instructions

### For Students:

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

4. **Start a Web Server** (REQUIRED!):
   - See options above or check `START_SERVER.md`
   - Open the page through the server (e.g., http://localhost:8000)

5. **Run the Application**:
   - Click "Start Model" to load your model
   - Click "Turn On Camera" to start the webcam
   - Click "Connect to Sphero BOLT" to pair with your robot
   - Show your gestures to control the robot!

## Customizing Gesture Controls

Edit the `handleGesture()` function in `app.js` to map your gesture class names to robot actions. The function currently supports:
- Forward/Backward movement
- Left/Right turns
- Stop command

Add your own gesture mappings based on your Teachable Machine class names!

## Requirements

- Modern web browser with WebBluetooth support (Chrome/Edge recommended)
- Sphero BOLT robot
- Webcam/camera access
- Exported Teachable Machine model files

## Notes

- Training data in `training_data/` is for reference only - the running application uses the exported model files
- The model must be trained and exported from Teachable Machine before use
- Gesture confidence threshold is set to 85% to prevent false triggers

