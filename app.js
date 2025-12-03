//--------------------------------------
// GLOBAL VARIABLES
//--------------------------------------
// More API functions here:
// https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image
// The link to your model provided by Teachable Machine export panel
const URL = "./my_model/";

let model, webcam, labelContainer, maxPredictions;
let isConnected = false;
let lastDetectedGesture = null; // Track normalized gesture name to only send commands on change

// Backend API URL - use relative path since frontend is served from same origin
const API_BASE_URL = '/api';


//--------------------------------------
// LOAD THE IMAGE MODEL
//--------------------------------------
document.getElementById("startBtn").addEventListener("click", initModel);

async function initModel() {
    try {
        const startBtn = document.getElementById("startBtn");
        startBtn.textContent = "Loading model...";
        startBtn.disabled = true;

        // Check if running from file:// protocol (CORS issue)
        if (window.location.protocol === 'file:') {
            throw new Error('CORS_FILE_PROTOCOL');
        }

        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";

        // First, verify files exist by trying to fetch them
        try {
            const modelResponse = await fetch(modelURL);
            if (!modelResponse.ok) {
                throw new Error(`HTTP ${modelResponse.status}: ${modelResponse.statusText}`);
            }
            const metadataResponse = await fetch(metadataURL);
            if (!metadataResponse.ok) {
                throw new Error(`HTTP ${metadataResponse.status}: ${metadataResponse.statusText}`);
            }
        } catch (fetchError) {
            if (fetchError.message.includes('CORS') || fetchError.name === 'TypeError') {
                throw new Error('CORS_ERROR');
            }
            throw fetchError;
        }

        // Load the model and metadata
        // Refer to tmImage.loadFromFiles() in the API to support files from a file picker
        // or files from your local hard drive
        // Note: the image library adds "tmImage" object to your window (window.tmImage)
        console.log("Loading model from:", modelURL);
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        console.log("Model loaded successfully! Classes:", maxPredictions);

        // Setup prediction labels
        labelContainer = document.getElementById("label-container");
        labelContainer.innerHTML = "";
        for (let i = 0; i < maxPredictions; i++) {
            labelContainer.appendChild(document.createElement("div"));
        }

        startBtn.textContent = "Model Loaded ✓";
        console.log("Model is ready to use!");
        
    } catch (error) {
        const startBtn = document.getElementById("startBtn");
        startBtn.textContent = "Start Model";
        startBtn.disabled = false;
        
        console.error("Error loading model:", error);
        
        // Provide helpful error messages
        if (error.message === 'CORS_FILE_PROTOCOL' || error.message === 'CORS_ERROR' || 
            error.message.includes('CORS') || error.message.includes('Failed to fetch') ||
            (error.name === 'TypeError' && error.message.includes('fetch'))) {
            
            const serverInstructions = `
IMPORTANT: You must run a local web server!

Browsers block loading local files for security. You need to run a web server.

QUICK FIX - Choose one method:

1. Python (if installed):
   Open terminal in this folder and run:
   python -m http.server 8000 --bind 127.0.0.1
   Then open: http://localhost:8000 or http://127.0.0.1:8000

2. Node.js (if installed):
   Open terminal in this folder and run:
   npx http-server -p 8000 -a localhost
   Then open: http://localhost:8000 or http://127.0.0.1:8000

3. VS Code:
   Install "Live Server" extension, then right-click index.html → "Open with Live Server"

4. Online:
   Upload all files to a web hosting service

After starting the server, refresh this page and try again.`;
            
            alert(serverInstructions);
        } else if (error.message.includes('model.json') || error.message.includes('404') || 
                   error.message.includes('HTTP 404')) {
            alert("Error: Could not find model files.\n\nMake sure you have:\n- model.json\n- metadata.json\n- weights.bin\n\nAll files should be in the my_model folder.\n\nAlso make sure you're running a local web server (see previous message).");
        } else if (error.message.includes('weights') || error.message.includes('weights.bin')) {
            alert("Error: Could not load model weights.\n\nMake sure weights.bin (or weights_*.bin files) are in the my_model folder.");
        } else {
            alert("Error loading model: " + error.message + "\n\nCheck the browser console (F12) for more details.");
        }
    }
}


//--------------------------------------
// TURN ON CAMERA - Load webcam and setup
//--------------------------------------
document.getElementById("turnOnCameraBtn").addEventListener("click", init);

// Load the image model and setup the webcam
async function init() {
    try {
        // Check if model is loaded first
        if (!model) {
            alert("Please load the model first by clicking 'Start Model' button.");
            return;
        }

        const turnOnCameraBtn = document.getElementById("turnOnCameraBtn");
        turnOnCameraBtn.textContent = "Requesting camera access...";
        turnOnCameraBtn.disabled = true;

        // Clear webcam container
        const webcamContainer = document.getElementById("webcam-container");
        webcamContainer.innerHTML = "";

        // Convenience function to setup a webcam
        const flip = true; // whether to flip the webcam
        webcam = new tmImage.Webcam(200, 200, flip); // width, height, flip
        await webcam.setup(); // request access to the webcam
        await webcam.play();
        window.requestAnimationFrame(loop);

        // Append elements to the DOM
        document.getElementById("webcam-container").appendChild(webcam.canvas);
        
        // Style the canvas to be visible
        webcam.canvas.style.width = "100%";
        webcam.canvas.style.height = "auto";
        webcam.canvas.style.display = "block";

        // Setup label container if not already done
        if (!labelContainer) {
            labelContainer = document.getElementById("label-container");
            labelContainer.innerHTML = "";
            for (let i = 0; i < maxPredictions; i++) {
                labelContainer.appendChild(document.createElement("div"));
            }
        }

        turnOnCameraBtn.textContent = "Camera On ✓";
        
    } catch (error) {
        const turnOnCameraBtn = document.getElementById("turnOnCameraBtn");
        turnOnCameraBtn.textContent = "Turn On Camera";
        turnOnCameraBtn.disabled = false;
        
        if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
            alert("Camera access denied. Please allow camera access and try again.");
        } else if (error.name === 'NotFoundError') {
            alert("No camera found. Please connect a camera and try again.");
        } else {
            alert("Error accessing camera: " + error.message);
        }
        console.error("Error details:", error);
    }
}


//--------------------------------------
// PREDICTION LOOP
//--------------------------------------
async function loop() {
    webcam.update(); // update the webcam frame
    await predict();
    window.requestAnimationFrame(loop);
}

//--------------------------------------
// RUN THE WEBCAM IMAGE THROUGH THE IMAGE MODEL
//--------------------------------------
async function predict() {
    if (!model || !webcam) return;
    
    // Predict can take in an image, video or canvas html element
    const prediction = await model.predict(webcam.canvas);
    
    // Update UI labels
    let highestClass = "";
    let highestProb = 0;

    for (let i = 0; i < maxPredictions; i++) {
        const classPrediction = prediction[i].className + ": " + prediction[i].probability.toFixed(2);
        labelContainer.childNodes[i].innerHTML = classPrediction;

        // Track top prediction
        const prob = parseFloat(prediction[i].probability);
        if (prob > highestProb) {
            highestProb = prob;
            highestClass = prediction[i].className;
        }
    }

    // Update UI
    document.getElementById("gestureOutput").innerText = highestClass || "–";
    document.getElementById("confidenceOutput").innerText = (highestProb * 100).toFixed(0) + "%";

    // Real-time control: process current frame immediately
    // Very low threshold for maximum responsiveness
    const confidenceThreshold = 0.3; // 30% confidence threshold for real-time control
    
    if (highestProb > confidenceThreshold && isConnected && highestClass) {
        // Normalize gesture name for consistent comparisons (prevents flicker from casing/spaces)
        const normalizedGesture = highestClass.trim().toLowerCase();
        
        // Only send command if gesture has changed
        if (lastDetectedGesture !== normalizedGesture) {
            lastDetectedGesture = normalizedGesture;
            // Fire-and-forget: send command immediately for current frame
            handleGesture(normalizedGesture);
        }
    }
}


//--------------------------------------
// CONNECT TO SPHERO BOLT (via Backend API)
//--------------------------------------
document.getElementById("connectBtn").addEventListener("click", connectSphero);

async function connectSphero() {
    const connectBtn = document.getElementById("connectBtn");
    
    try {
        console.log("🔵 [DEBUG] Starting Sphero connection process...");
        updateConnectionStatus("Scanning for devices...", "#ffaa00");
        
        // Update UI
        connectBtn.textContent = "Scanning...";
        connectBtn.disabled = true;
        
        // First, scan for available devices
        const scanResponse = await fetch(`${API_BASE_URL}/scan`);
        const scanData = await scanResponse.json();
        
        if (!scanData.success) {
            throw new Error(scanData.error || "Failed to scan for devices");
        }
        
        if (!scanData.devices || scanData.devices.length === 0) {
            throw new Error("No Sphero BOLT devices found. Make sure your robot is powered on and nearby.");
        }
        
        console.log("✅ [DEBUG] Found devices:", scanData.devices);
        updateConnectionStatus(`Found ${scanData.devices.length} device(s)`, "#ffaa00");
        
        // Use the first device (or you could let user select)
        const device = scanData.devices[0];
        console.log(`🔵 [DEBUG] Connecting to: ${device.name} (${device.address})`);
        updateConnectionStatus(`Connecting to ${device.name}...`, "#ffaa00");
        connectBtn.textContent = "Connecting...";
        
        // Connect to the device
        const connectResponse = await fetch(`${API_BASE_URL}/connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address: device.address })
        });
        
        const connectData = await connectResponse.json();
        
        if (!connectData.success) {
            throw new Error(connectData.error || "Connection failed");
        }
        
        isConnected = true;
        console.log("✅ [DEBUG] Connection established!");
        
        // Update UI
        connectBtn.textContent = "Connected ✓";
        connectBtn.disabled = true;
        updateConnectionStatus("Connected to Sphero BOLT!", "#00aa00");
        
        // Check connection status periodically
        startStatusCheck();
        
    } catch (error) {
        console.error("❌ [DEBUG] Connection error:", error);
        
        isConnected = false;
        connectBtn.textContent = "Connect to Sphero BOLT";
        connectBtn.disabled = false;
        
        updateConnectionStatus("Connection failed", "#aa0000");
        alert("Connection failed: " + error.message + "\n\nMake sure:\n1. The backend server is running (python backend/app.py)\n2. Your Sphero BOLT is powered on and nearby\n3. Bluetooth is enabled on your computer");
    }
}

// Periodically check connection status
let statusCheckInterval = null;

function startStatusCheck() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/status`);
            const data = await response.json();
            
            if (!data.connected) {
                isConnected = false;
                const connectBtn = document.getElementById("connectBtn");
                connectBtn.textContent = "Connect to Sphero BOLT";
                connectBtn.disabled = false;
                updateConnectionStatus("Disconnected", "#aa0000");
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
            }
        } catch (error) {
            console.warn("Status check failed:", error);
        }
    }, 2000); // Check every 2 seconds
}

function onDisconnected() {
    isConnected = false;
    lastDetectedGesture = null; // Reset gesture tracker on disconnect
    const connectBtn = document.getElementById("connectBtn");
    connectBtn.textContent = "Connect to Sphero BOLT";
    connectBtn.disabled = false;
    updateConnectionStatus("Disconnected", "#aa0000");
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

// Helper function to update connection status
function updateConnectionStatus(message, color) {
    const statusDiv = document.getElementById("connectionStatus");
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.color = color;
    }
    console.log("📊 [STATUS]", message);
}

function onDisconnected() {
    isConnected = false;
    document.getElementById("connectBtn").textContent = "Connect to Sphero BOLT";
    document.getElementById("connectBtn").disabled = false;
    document.getElementById("connectionStatus").textContent = "Disconnected";
    document.getElementById("connectionStatus").style.color = "#aa0000";
    spheroDevice = null;
    spheroService = null;
    spheroCharacteristic = null;
}


//--------------------------------------
// SPHERO COMMANDS
//--------------------------------------

// Set LED color (R, G, B values 0-255)
// Optimized for real-time: fire-and-forget, no blocking
function setColor(r, g, b) {
    if (!isConnected) return;
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/setColor`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ r, g, b })
    }).catch(() => {
        // Silently handle errors - don't block the prediction loop
    });
}

// Set matrix LED color (R, G, B values 0-255)
// Optimized for real-time: fire-and-forget, no blocking
function setMatrixColor(r, g, b) {
    if (!isConnected) return;
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/setMatrixColor`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ r, g, b })
    }).catch(() => {
        // Silently handle errors - don't block the prediction loop
    });
}

// Drive command (speed 0-255, heading 0-359 degrees)
// Optimized for real-time: fire-and-forget, no blocking
function drive(speed, heading) {
    if (!isConnected) return;
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/drive`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ speed, heading })
    }).catch(() => {
        // Silently handle errors - don't block the prediction loop
    });
}

// Stop the robot
// Optimized for real-time: fire-and-forget, no blocking
function stop() {
    if (!isConnected) return;
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/stop`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }).catch(() => {
        // Silently handle errors - don't block the prediction loop
    });
}

// Turn robot to a specific heading (degrees 0-359)
// Optimized for real-time: fire-and-forget, no blocking
function turn(heading, speed = 0) {
    if (!isConnected) return;
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/turn`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ heading, speed })
    }).catch(() => {
        // Silently handle errors - don't block the prediction loop
    });
}

// Scroll text on the LED matrix
// text: string to display
// color: object with r, g, b values (0-255)
// speed: scroll speed (0-255, lower is faster)
// loop: boolean, whether to loop the text
// Scroll text on LED matrix
// Optimized for real-time: fire-and-forget, no blocking
function scrollMatrixText(text, color, speed, loop) {
    if (!isConnected) return;
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/scrollMatrixText`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, color, speed, loop })
    }).catch(() => {
        // Silently handle errors - don't block the prediction loop
    });
}


//--------------------------------------
// 🎯 GESTURE HANDLING (MODULAR)
//--------------------------------------
// This function uses the gesture-config.js file for flexible gesture mapping
// Students can modify gesture-config.js to customize their gesture controls
// Optimized for real-time: non-blocking, fire-and-forget
function handleGesture(gesture) {
    // Use the modular gesture configuration system
    if (typeof executeGestureActions === 'function') {
        // Fire-and-forget: execute immediately without blocking
        executeGestureActions(gesture);
    } else {
        // Fallback to simple hardcoded behavior if config system not loaded
        if (gesture === "hand" || gesture === "Hand") {
            turn(0, 0);
            setColor(0, 255, 0);
        } else if (gesture === "head" || gesture === "Head") {
            turn(90, 0);
            setColor(255, 0, 0);
        }
    }
}
