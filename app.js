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
let isLoopRunning = false; // Track if prediction loop is running
// Make labelColors globally accessible so gesture-config.js can use it
let labelColors = {}; // Store RGB colors for each label: { "LabelName": { r: 255, g: 0, b: 0 } }
let pendingLabelColors = {}; // Store pending colors before update button is clicked
window.labelColors = labelColors; // Make it globally accessible

// Backend API URL - use relative path since frontend is served from same origin
const API_BASE_URL = '/api';


//--------------------------------------
// FILE UPLOAD HANDLING
//--------------------------------------
let uploadedZipFile = null;
let extractedFiles = {
    metadata: false,
    model: false,
    weights: false
};

// Setup file upload area
const fileUploadArea = document.getElementById("file-upload-area");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("file-list");

// Click anywhere on file upload area to open file picker
if (fileUploadArea) {
    fileUploadArea.addEventListener("click", (e) => {
        // Don't trigger if clicking on file list items
        if (e.target.closest(".file-item")) {
            return;
        }
        // Open file picker
        fileInput.click();
    });
}

// File input change
fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
        handleZipFile(e.target.files[0]);
    }
});

// Drag and drop handlers
fileUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    fileUploadArea.classList.add("drag-over");
});

fileUploadArea.addEventListener("dragleave", () => {
    fileUploadArea.classList.remove("drag-over");
});

fileUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) {
        handleZipFile(e.dataTransfer.files[0]);
    }
});

function handleZipFile(file) {
    // Validate it's a ZIP file
    if (!file.name.toLowerCase().endsWith('.zip')) {
        alert("Please upload a ZIP file (.zip)");
        return;
    }
    
    uploadedZipFile = file;
    displayFileList();
}

function displayFileList() {
    fileList.innerHTML = "";
    
    // Check if there are any files to display
    const hasFiles = uploadedZipFile || Object.values(extractedFiles).some(v => v);
    
    if (!hasFiles) {
        // Hide file list if no files
        fileList.classList.remove("show");
        return;
    }
    
    // Show uploaded ZIP file name if present
    if (uploadedZipFile) {
        const zipItem = document.createElement("div");
        zipItem.className = "file-item";
        
        const zipName = document.createElement("span");
        zipName.className = "file-item-name";
        zipName.textContent = uploadedZipFile.name;
        
        const zipStatus = document.createElement("span");
        zipStatus.className = "file-item-status ready";
        zipStatus.textContent = "✓ Ready";
        
        zipItem.appendChild(zipName);
        zipItem.appendChild(zipStatus);
        fileList.appendChild(zipItem);
    }
    
    // Show extracted files status
    const files = [
        { key: "metadata", name: "metadata.json" },
        { key: "model", name: "model.json" },
        { key: "weights", name: "weights.bin" }
    ];
    
    files.forEach(({ key, name }) => {
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";
        
        const fileName = document.createElement("span");
        fileName.className = "file-item-name";
        fileName.textContent = name;
        
        const fileStatus = document.createElement("span");
        fileStatus.className = "file-item-status";
        if (extractedFiles[key]) {
            fileStatus.textContent = "✓ Extracted";
            fileStatus.classList.add("ready");
        } else {
            fileStatus.textContent = uploadedZipFile ? "⏳ Waiting..." : "✗ Not uploaded";
            if (!uploadedZipFile) {
                fileStatus.style.color = "#aa0000";
            }
        }
        
        fileItem.appendChild(fileName);
        fileItem.appendChild(fileStatus);
        fileList.appendChild(fileItem);
    });
    
    fileList.classList.add("show");
}

//--------------------------------------
// SHOW/HIDE FILE UPLOAD AREA
//--------------------------------------
function hideFileUploadArea() {
    const fileUploadRow = document.getElementById("file-upload-row");
    if (fileUploadRow) {
        fileUploadRow.style.display = "none";
    }
}

function showFileUploadArea() {
    const fileUploadRow = document.getElementById("file-upload-row");
    if (fileUploadRow) {
        fileUploadRow.style.display = "flex";
    }
}

//--------------------------------------
// CHANGE MODEL BUTTON
//--------------------------------------
function addChangeModelButton() {
    // Check if button already exists
    if (document.getElementById('changeModelBtn')) {
        return;
    }
    
    const setupColumn = document.querySelector('.setup-column');
    const changeModelBtn = document.createElement("button");
    changeModelBtn.id = "changeModelBtn";
    changeModelBtn.className = "btn-secondary";
    changeModelBtn.textContent = "Change Model";
    
    changeModelBtn.addEventListener("click", async () => {
        // Reset everything and show upload area
        await resetToInitialState();
        showFileUploadArea();
        removeChangeModelButton();
    });
    
    // Insert after Load Model button row
    const startBtn = document.getElementById('startBtn');
    const loadModelRow = startBtn ? startBtn.closest('.setup-row') : null;
    if (loadModelRow && loadModelRow.parentNode) {
        loadModelRow.parentNode.insertBefore(changeModelBtn, loadModelRow.nextSibling);
    } else {
        setupColumn.appendChild(changeModelBtn);
    }
}

function removeChangeModelButton() {
    const changeModelBtn = document.getElementById('changeModelBtn');
    if (changeModelBtn) {
        changeModelBtn.remove();
    }
}

//--------------------------------------
// RESET TO INITIAL STATE
//--------------------------------------
async function resetToInitialState() {
    try {
        logToTerminal("Resetting to initial state...", "info");
        
        // Stop prediction loop
        isLoopRunning = false;
        
        // Stop webcam if running
        if (webcam) {
            try {
                webcam.stop();
                webcam = null;
            } catch (e) {
                console.warn("Error stopping webcam:", e);
            }
        }
        
        // Clear webcam container
        const webcamContainer = document.getElementById("webcam-container");
        if (webcamContainer) {
            webcamContainer.innerHTML = '<p class="webcam-placeholder">Webcam will appear here</p>';
        }
        
        // Reset camera button
        const turnOnCameraBtn = document.getElementById("turnOnCameraBtn");
        if (turnOnCameraBtn) {
            turnOnCameraBtn.textContent = "Camera On";
            turnOnCameraBtn.disabled = false;
        }
        
        // Dispose of TensorFlow model to free memory
        if (model) {
            try {
                // TensorFlow.js models have a dispose method
                if (model.dispose) {
                    model.dispose();
                }
            } catch (e) {
                console.warn("Error disposing model:", e);
            }
        }
        
        // Clear model state
        model = null;
        maxPredictions = 0;
        lastDetectedGesture = null;
        
        // Clear predictions
        labelContainer = null;
        const labelContainerEl = document.getElementById("label-container");
        if (labelContainerEl) {
            labelContainerEl.innerHTML = "";
        }
        
        // Reset gesture display
        const gestureOutput = document.getElementById("gestureOutput");
        if (gestureOutput) {
            gestureOutput.innerText = "–";
        }
        const confidenceOutput = document.getElementById("confidenceOutput");
        if (confidenceOutput) {
            confidenceOutput.innerText = "0%";
        }
        
        // Clear model categories
        const categoriesContainer = document.getElementById("model-categories");
        if (categoriesContainer) {
            categoriesContainer.innerHTML = "";
            categoriesContainer.classList.remove("show");
        }
        
        // Clear uploaded files (frontend and backend)
        uploadedZipFile = null;
        extractedFiles = {
            metadata: false,
            model: false,
            weights: false
        };
        fileInput.value = "";
        
        // Clear label colors
        labelColors = {};
        pendingLabelColors = {};
        window.labelColors = {};
        
        // Hide label color picker section
        const colorPickerSection = document.getElementById("label-color-picker-section");
        if (colorPickerSection) {
            colorPickerSection.style.display = "none";
        }
        
        // Hide update button
        const updateColorsBtn = document.getElementById("updateColorsBtn");
        if (updateColorsBtn) {
            updateColorsBtn.style.display = "none";
        }
        
        // Clear backend files
        try {
            const response = await fetch(`${API_BASE_URL}/clearModel`, {
                method: "POST"
            });
            const data = await response.json();
            if (data.success) {
                logToTerminal("Model files cleared from server", "info");
            }
        } catch (error) {
            console.warn("Error clearing backend files:", error);
        }
        
        // Update file list display
        displayFileList();
        
        // Show file upload area
        showFileUploadArea();
        
        // Reset Load Model button
        const startBtn = document.getElementById("startBtn");
        if (startBtn) {
            startBtn.textContent = "Load Model";
            startBtn.disabled = false;
        }
        
        // Deactivate prediction column
        deactivatePredictionColumn();
        // Command column stays active
        
        // Reset virtual matrix
        if (matrixPixels && matrixPixels.length > 0) {
            matrixPixels.forEach(pixel => {
                pixel.style.backgroundColor = "#000";
            });
        }
        const matrixInfo = document.getElementById("matrix-info");
        if (matrixInfo) {
            matrixInfo.textContent = "Matrix: Off";
            matrixInfo.style.color = "#333";
        }
        
        // Reset movement status
        updateMovementStatus("Status: Idle");
        
        logToTerminal("Reset complete. Ready for new model upload.", "success");
        
    } catch (error) {
        console.error("Reset error:", error);
        logToTerminal(`Reset error: ${error.message}`, "error");
    }
}


//--------------------------------------
// LOAD THE IMAGE MODEL
//--------------------------------------
document.getElementById("startBtn").addEventListener("click", async () => {
    // Check if ZIP file is selected for upload
    if (uploadedZipFile) {
        // Upload and extract ZIP file first
        await uploadModelZip();
    }
    
    // Then load the model
    await initModel();
});

async function uploadModelZip() {
    try {
        const startBtn = document.getElementById("startBtn");
        startBtn.textContent = "Uploading & Extracting...";
        startBtn.disabled = true;
        
        logToTerminal("Uploading ZIP file...", "info");
        
        // Create FormData
        const formData = new FormData();
        formData.append("zipfile", uploadedZipFile);
        
        // Upload to backend
        const response = await fetch(`${API_BASE_URL}/uploadModel`, {
            method: "POST",
            body: formData
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || "Upload failed");
        }
        
        logToTerminal(`ZIP file uploaded and extracted successfully!`, "success");
        logToTerminal(`Model: ${data.modelName || "Unknown"}`, "info");
        logToTerminal(`Categories: ${data.labels ? data.labels.join(", ") : "None"}`, "info");
        
        // Update extracted files status
        if (data.files) {
            extractedFiles = {
                metadata: data.files['metadata.json'] || false,
                model: data.files['model.json'] || false,
                weights: data.files['weights.bin'] || false
            };
        }
        
        // Update file list display
        displayFileList();
        
        startBtn.textContent = "Load Model";
        startBtn.disabled = false;
        
    } catch (error) {
        const startBtn = document.getElementById("startBtn");
        startBtn.textContent = "Load Model";
        startBtn.disabled = false;
        
        console.error("Upload error:", error);
        logToTerminal(`Upload failed: ${error.message}`, "error");
        alert("Failed to upload ZIP file: " + error.message);
        throw error;
    }
}

async function initModel() {
    try {
        const startBtn = document.getElementById("startBtn");
        startBtn.textContent = "Loading...";
        startBtn.disabled = true;
        
        // Reset model state
        if (model) {
            model = null;
        }
        lastDetectedGesture = null;

        // Check if running from file:// protocol (CORS issue)
        if (window.location.protocol === 'file:') {
            throw new Error('CORS_FILE_PROTOCOL');
        }

        // Add cache-busting parameter to ensure fresh model is loaded after upload
        const cacheBuster = "?t=" + Date.now();
        const modelURL = URL + "model.json" + cacheBuster;
        const metadataURL = URL + "metadata.json" + cacheBuster;

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

        // Fetch metadata to get class names
        const metadataResponse = await fetch(metadataURL);
        const metadata = await metadataResponse.json();
        const classNames = metadata.labels || [];

        console.log("Model loaded successfully! Classes:", maxPredictions);
        logToTerminal(`Model loaded: ${maxPredictions} classes`, "success");

        // Update extracted files status (files are now in my_model folder)
        extractedFiles = {
            metadata: true,
            model: true,
            weights: true
        };
        displayFileList();

        // Display model categories
        displayModelCategories(classNames);
        
        // Display label color pickers
        displayLabelColorPickers(classNames);

        // Setup prediction labels with bar structure
        labelContainer = document.getElementById("label-container");
        labelContainer.innerHTML = "";
        for (let i = 0; i < maxPredictions; i++) {
            const predictionDiv = document.createElement("div");
            predictionDiv.className = "prediction-item";
            
            // Create label text
            const labelText = document.createElement("span");
            labelText.className = "prediction-label";
            
            // Create bar container
            const barContainer = document.createElement("div");
            barContainer.className = "prediction-bar-container";
            
            // Create blue fill bar
            const barFill = document.createElement("div");
            barFill.className = "prediction-bar-fill";
            barFill.style.width = "0%";
            
            barContainer.appendChild(barFill);
            predictionDiv.appendChild(labelText);
            predictionDiv.appendChild(barContainer);
            
            labelContainer.appendChild(predictionDiv);
        }

        startBtn.textContent = "Model Loaded ✓";
        console.log("Model is ready to use!");
        logToTerminal("Model is ready to use!", "success");
        
        // Hide file upload area and show Change Model button
        hideFileUploadArea();
        addChangeModelButton();
        
    } catch (error) {
        const startBtn = document.getElementById("startBtn");
        startBtn.textContent = "Load Model";
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
        isLoopRunning = true;
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
                const predictionDiv = document.createElement("div");
                predictionDiv.className = "prediction-item";
                
                // Create label text
                const labelText = document.createElement("span");
                labelText.className = "prediction-label";
                
                // Create bar container
                const barContainer = document.createElement("div");
                barContainer.className = "prediction-bar-container";
                
                // Create blue fill bar
                const barFill = document.createElement("div");
                barFill.className = "prediction-bar-fill";
                barFill.style.width = "0%";
                
                barContainer.appendChild(barFill);
                predictionDiv.appendChild(labelText);
                predictionDiv.appendChild(barContainer);
                
                labelContainer.appendChild(predictionDiv);
            }
        }

        turnOnCameraBtn.textContent = "Camera On ✓";
        logToTerminal("Camera started", "success");
        
        // Activate prediction column
        activatePredictionColumn();
        
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
    if (!isLoopRunning) {
        return; // Stop loop if reset was called
    }
    webcam.update(); // update the webcam frame
    await predict();
    if (isLoopRunning) {
        window.requestAnimationFrame(loop);
    }
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
        const predictionItem = labelContainer.childNodes[i];
        const prob = parseFloat(prediction[i].probability);
        const className = prediction[i].className;
        
        // Update label text
        const labelText = predictionItem.querySelector(".prediction-label");
        if (labelText) {
            labelText.textContent = className + ": " + prob.toFixed(2);
        }
        
        // Update bar fill width based on probability (0-1 range maps to 0-100%)
        const barFill = predictionItem.querySelector(".prediction-bar-fill");
        if (barFill) {
            const percentage = (prob * 100).toFixed(1);
            barFill.style.width = percentage + "%";
        }

        // Track top prediction
        if (prob > highestProb) {
            highestProb = prob;
            highestClass = className;
        }
    }

    // Update UI
    document.getElementById("gestureOutput").innerText = highestClass || "–";
    document.getElementById("confidenceOutput").innerText = (highestProb * 100).toFixed(0) + "%";

    // Real-time control: process current frame immediately
    // Very low threshold for maximum responsiveness
    const confidenceThreshold = 0.3; // 30% confidence threshold for real-time control
    
    if (highestProb > confidenceThreshold && highestClass) {
        // Normalize gesture name for consistent comparisons (prevents flicker from casing/spaces)
        const normalizedGesture = highestClass.trim().toLowerCase();
        
        // Process gestures for matrix color updates even when not connected
        // Only send robot commands when connected
        if (lastDetectedGesture !== normalizedGesture) {
            lastDetectedGesture = normalizedGesture;
            // Fire-and-forget: send command immediately for current frame
            // Use original highestClass (not normalized) to ensure proper config lookup
            handleGesture(highestClass.trim());
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
        logToTerminal("Connected to Sphero BOLT!", "success");
        
        // Update UI
        connectBtn.textContent = "Connected ✓";
        connectBtn.disabled = true;
        updateConnectionStatus("Connected to Sphero BOLT!", "#00aa00");
        
        // Activate command column
        activateCommandColumn();
        
        // Check connection status periodically
        startStatusCheck();
        
    } catch (error) {
        console.error("❌ [DEBUG] Connection error:", error);
        
        isConnected = false;
        connectBtn.textContent = "Connect to Sphero BOLT";
        connectBtn.disabled = false;
        
        updateConnectionStatus("Connection failed", "#aa0000");
        logToTerminal(`Connection failed: ${error.message}`, "error");
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
                logToTerminal("Disconnected from Sphero BOLT", "warning");
                updateMovementStatus("Status: Disconnected");
                
                // Command column stays active
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
    if (!isConnected) {
        logToTerminal("setColor called but not connected", "warning");
        return;
    }
    
    logToTerminal(`LED color: RGB(${r}, ${g}, ${b})`, "action");
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/setColor`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ r, g, b })
    }).catch((error) => {
        logToTerminal(`Error setting LED color: ${error.message}`, "error");
    });
}

// Set matrix LED color (R, G, B values 0-255)
// Optimized for real-time: fire-and-forget, no blocking
function setMatrixColor(r, g, b) {
    if (!isConnected) {
        logToTerminal("setMatrixColor called but not connected", "warning");
        // Still update virtual matrix for debugging
        updateVirtualMatrix(r, g, b);
        return;
    }
    
    // Update virtual matrix immediately for visual feedback
    updateVirtualMatrix(r, g, b);
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/setMatrixColor`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ r, g, b })
    }).catch((error) => {
        logToTerminal(`Error setting matrix color: ${error.message}`, "error");
    });
}

// Drive command (speed 0-255, heading 0-359 degrees)
// Optimized for real-time: fire-and-forget, no blocking
function drive(speed, heading) {
    if (!isConnected) {
        logToTerminal("drive called but not connected", "warning");
        return;
    }
    
    const speedPercent = ((speed / 255) * 100).toFixed(0);
    logToTerminal(`Drive: Speed ${speedPercent}% (${speed}), Heading ${heading}°`, "action");
    updateMovementStatus(`Status: Moving at ${speedPercent}% speed, heading ${heading}°`);
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/drive`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ speed, heading })
    }).catch((error) => {
        logToTerminal(`Error driving: ${error.message}`, "error");
    });
}

// Stop the robot
// Optimized for real-time: fire-and-forget, no blocking
function stop() {
    if (!isConnected) {
        logToTerminal("stop called but not connected", "warning");
        return;
    }
    
    logToTerminal("Stop command sent", "action");
    updateMovementStatus("Status: Stopped");
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/stop`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }).catch((error) => {
        logToTerminal(`Error stopping: ${error.message}`, "error");
    });
}

// Turn robot to a specific heading (degrees 0-359)
// Optimized for real-time: fire-and-forget, no blocking
function turn(heading, speed = 0) {
    if (!isConnected) {
        logToTerminal("turn called but not connected", "warning");
        return;
    }
    
    const speedText = speed > 0 ? ` at speed ${speed}` : "";
    logToTerminal(`Turn to ${heading}°${speedText}`, "action");
    updateMovementStatus(`Status: Turning to ${heading}°${speedText}`);
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/turn`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ heading, speed })
    }).catch((error) => {
        logToTerminal(`Error turning: ${error.message}`, "error");
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
    if (!isConnected) {
        logToTerminal("scrollMatrixText called but not connected", "warning");
        return;
    }
    
    const colorStr = color ? `RGB(${color.r}, ${color.g}, ${color.b})` : "default";
    logToTerminal(`Scroll text: "${text}" (${colorStr}, speed: ${speed}, loop: ${loop})`, "action");
    
    // Fire-and-forget: send request without waiting for response
    fetch(`${API_BASE_URL}/scrollMatrixText`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, color, speed, loop })
    }).catch((error) => {
        logToTerminal(`Error scrolling text: ${error.message}`, "error");
    });
}


//--------------------------------------
// DEBUG TERMINAL & VIRTUAL MATRIX
//--------------------------------------

// Column activation functions
function activatePredictionColumn() {
    const predictionColumn = document.querySelector(".prediction-column");
    if (predictionColumn) {
        predictionColumn.classList.remove("inactive");
    }
}

function deactivatePredictionColumn() {
    const predictionColumn = document.querySelector(".prediction-column");
    if (predictionColumn) {
        predictionColumn.classList.add("inactive");
    }
}

function activateCommandColumn() {
    const commandColumn = document.querySelector(".command-column");
    if (commandColumn) {
        commandColumn.classList.remove("inactive");
    }
}

function deactivateCommandColumn() {
    const commandColumn = document.querySelector(".command-column");
    if (commandColumn) {
        commandColumn.classList.add("inactive");
    }
}

// Display model categories
function displayModelCategories(categories) {
    const categoriesContainer = document.getElementById("model-categories");
    if (!categoriesContainer || !categories || categories.length === 0) return;
    
    categoriesContainer.innerHTML = "";
    categoriesContainer.classList.add("show");
    
    const title = document.createElement("h4");
    title.textContent = "Model Categories:";
    categoriesContainer.appendChild(title);
    
    const categoryList = document.createElement("div");
    categoryList.className = "category-list";
    
    categories.forEach(category => {
        const tag = document.createElement("span");
        tag.className = "category-tag";
        tag.textContent = category;
        categoryList.appendChild(tag);
    });
    
    categoriesContainer.appendChild(categoryList);
    logToTerminal(`Categories displayed: ${categories.join(", ")}`, "info");
}

// Display label color pickers
function displayLabelColorPickers(labels) {
    const colorPickerSection = document.getElementById("label-color-picker-section");
    const colorPickersContainer = document.getElementById("label-color-pickers");
    const updateColorsBtn = document.getElementById("updateColorsBtn");
    
    if (!colorPickerSection || !colorPickersContainer || !labels || labels.length === 0) {
        return;
    }
    
    // Show the section
    colorPickerSection.style.display = "block";
    colorPickersContainer.innerHTML = "";
    
    // Initialize default colors if not set (distribute colors evenly around color wheel)
    labels.forEach((label, index) => {
        if (!labelColors[label]) {
            // Generate a color based on index (hue distribution)
            const hue = (index * 360) / labels.length;
            const rgb = hslToRgb(hue / 360, 0.7, 0.5);
            labelColors[label] = { r: rgb[0], g: rgb[1], b: rgb[2] };
        }
        // Initialize pending colors with current colors
        pendingLabelColors[label] = { ...labelColors[label] };
    });
    
    // Update global reference
    window.labelColors = labelColors;
    
    // Create clickable label tag for each label
    labels.forEach(label => {
        const labelTag = document.createElement("div");
        labelTag.className = "label-color-tag";
        labelTag.dataset.label = label;
        
        const currentColor = labelColors[label] || { r: 0, g: 0, b: 0 };
        const hexColor = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        labelTag.style.backgroundColor = hexColor;
        labelTag.style.color = getContrastColor(currentColor.r, currentColor.g, currentColor.b);
        labelTag.textContent = label;
        
        // Hidden color input
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "label-color-input-hidden";
        colorInput.value = hexColor;
        colorInput.style.display = "none";
        
        // Click label to open color picker
        labelTag.addEventListener("click", () => {
            colorInput.click();
        });
        
        // Update pending color when changed
        colorInput.addEventListener("input", (e) => {
            const hex = e.target.value;
            const rgb = hexToRgb(hex);
            pendingLabelColors[label] = { r: rgb.r, g: rgb.g, b: rgb.b };
            
            // Update visual preview
            labelTag.style.backgroundColor = hex;
            labelTag.style.color = getContrastColor(rgb.r, rgb.g, rgb.b);
            
            // Show update button
            const updateBtn = document.getElementById("updateColorsBtn");
            if (updateBtn) {
                updateBtn.style.display = "block";
            }
        });
        
        colorPickersContainer.appendChild(labelTag);
        colorPickersContainer.appendChild(colorInput);
    });
    
    // Update Colors button handler
    const updateBtn = document.getElementById("updateColorsBtn");
    if (updateBtn) {
        // Remove any existing listeners by cloning
        const newUpdateBtn = updateBtn.cloneNode(true);
        updateBtn.parentNode.replaceChild(newUpdateBtn, updateBtn);
        
        newUpdateBtn.addEventListener("click", () => {
            // Apply pending colors
            Object.keys(pendingLabelColors).forEach(label => {
                labelColors[label] = { ...pendingLabelColors[label] };
            });
            
            // Update global reference
            window.labelColors = labelColors;
            
            // Hide update button
            newUpdateBtn.style.display = "none";
            
            logToTerminal("Matrix colors updated for all labels", "success");
        });
    }
    
    logToTerminal(`Color pickers created for ${labels.length} labels`, "info");
}

// Helper function: Get contrasting text color (black or white)
function getContrastColor(r, g, b) {
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
}

// Helper function: HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
        g = Math.round(hue2rgb(p, q, h) * 255);
        b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    }
    return [r, g, b];
}

// Helper function: RGB to Hex
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

// Helper function: Hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// Initialize virtual matrix on page load
let virtualMatrix = null;
let matrixPixels = [];

function initVirtualMatrix() {
    const matrixContainer = document.getElementById("virtual-matrix");
    if (!matrixContainer) return;
    
    matrixContainer.innerHTML = "";
    matrixPixels = [];
    
    // Create 8x8 grid of pixels
    for (let i = 0; i < 64; i++) {
        const pixel = document.createElement("div");
        pixel.className = "matrix-pixel";
        pixel.style.backgroundColor = "#000";
        matrixContainer.appendChild(pixel);
        matrixPixels.push(pixel);
    }
    
    virtualMatrix = { r: 0, g: 0, b: 0 };
    logToTerminal("Virtual matrix initialized (8x8)", "info");
}

// Log message to debug terminal
function logToTerminal(message, type = "info") {
    const terminal = document.getElementById("debug-terminal");
    if (!terminal) return;
    
    const logEntry = document.createElement("div");
    logEntry.className = "debug-log";
    
    const time = new Date().toLocaleTimeString();
    const timeSpan = document.createElement("span");
    timeSpan.className = "debug-log-time";
    timeSpan.textContent = `[${time}]`;
    
    const messageSpan = document.createElement("span");
    messageSpan.className = `debug-log-${type}`;
    messageSpan.textContent = message;
    
    logEntry.appendChild(timeSpan);
    logEntry.appendChild(messageSpan);
    terminal.appendChild(logEntry);
    
    // Auto-scroll to bottom
    terminal.scrollTop = terminal.scrollHeight;
    
    // Limit to last 100 entries to prevent memory issues
    while (terminal.children.length > 100) {
        terminal.removeChild(terminal.firstChild);
    }
}

// Update virtual matrix display
function updateVirtualMatrix(r, g, b) {
    if (!matrixPixels || matrixPixels.length === 0) {
        initVirtualMatrix();
    }
    
    virtualMatrix = { r, g, b };
    const rgbColor = `rgb(${r}, ${g}, ${b})`;
    
    // Update all pixels
    matrixPixels.forEach(pixel => {
        pixel.style.backgroundColor = rgbColor;
    });
    
    // Update info text
    const matrixInfo = document.getElementById("matrix-info");
    if (matrixInfo) {
        const hexColor = `#${[r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("")}`;
        matrixInfo.textContent = `Matrix: RGB(${r}, ${g}, ${b}) ${hexColor.toUpperCase()}`;
        matrixInfo.style.color = rgbColor;
    }
    
    logToTerminal(`Matrix color set: RGB(${r}, ${g}, ${b})`, "action");
}

// Update movement status display
function updateMovementStatus(status) {
    const movementStatus = document.getElementById("movement-status");
    if (movementStatus) {
        movementStatus.textContent = status;
    }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    initVirtualMatrix();
    logToTerminal("Debug terminal ready", "success");
    
    // Ensure prediction column starts in inactive state
    deactivatePredictionColumn();
    // Command column (Sphero Connection) is active by default
    
});

//--------------------------------------
// 🎯 GESTURE HANDLING (MODULAR)
//--------------------------------------
// This function uses the gesture-config.js file for flexible gesture mapping
// Students can modify gesture-config.js to customize their gesture controls
// Optimized for real-time: non-blocking, fire-and-forget
function handleGesture(gesture) {
    logToTerminal(`Gesture detected: "${gesture}"`, "action");
    
    // Use the modular gesture configuration system
    // executeGestureActions will check for user-selected colors first
    if (typeof executeGestureActions === 'function') {
        // Fire-and-forget: execute immediately without blocking
        executeGestureActions(gesture);
    }
    // No fallback needed - gesture-config.js handles all gestures
}
