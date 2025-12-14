//--------------------------------------
// GLOBAL VARIABLES
//--------------------------------------
// More API functions here:
// https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image
// The link to your model provided by Teachable Machine export panel
const URL = "/models/";

let model, webcam, labelContainer, maxPredictions;
let isConnected = false;
let lastDetectedGesture = null; // Track normalized gesture name to only send commands on change
let isLoopRunning = false; // Track if prediction loop is running
// Make labelColors globally accessible so gesture-config.js can use it
let labelColors = {}; // Store RGB colors for each label: { "LabelName": { r: 255, g: 0, b: 0 } }
let pendingLabelColors = {}; // Store pending colors before update button is clicked
window.labelColors = labelColors; // Make it globally accessible

// Store user-selected actions for each label
let labelActions = {}; // Store actions: { "LabelName": { type: "roll", speed: 100, heading: 0, angle: 90, color: {r, g, b} } }
window.labelActions = labelActions; // Make it globally accessible

// Backend API URL - use relative path since frontend is served from same origin
const API_BASE_URL = '/api';

//--------------------------------------
// SPHERO BOLT CONNECTION (using boltAPP)
//--------------------------------------
let bolt = null; // SpheroBolt instance from boltAPP


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
        
        // Clean up movement control
        if (typeof cleanupMovementControl === 'function') {
            cleanupMovementControl();
        }
        
        // Clean up movement control
        if (typeof cleanupMovementControl === 'function') {
            cleanupMovementControl();
        }
        
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
        
        // Clean up movement control
        if (typeof cleanupMovementControl === 'function') {
            cleanupMovementControl();
        }

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
        displayLabelList(classNames);

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
// CONNECT TO SPHERO BOLT (via Web Bluetooth API)
//--------------------------------------
// Wait for DOM and scripts to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSpheroConnection);
} else {
    setupSpheroConnection();
}

function setupSpheroConnection() {
    const connectBtn = document.getElementById("connectBtn");
    if (connectBtn) {
        connectBtn.addEventListener("click", connectSphero);
        
        // Debug: Check if SpheroBolt is available
        if (typeof SpheroBolt === 'undefined') {
            console.error("⚠️ [WARNING] SpheroBolt class is not defined. Check that boltAPP scripts are loaded.");
            console.log("Available globals:", Object.keys(window).filter(k => k.includes('Sphero') || k.includes('bolt')));
        } else {
            console.log("✅ SpheroBolt class is loaded and ready");
        }
    }
}

async function connectSphero() {
    const connectBtn = document.getElementById("connectBtn");
    
    try {
        // Check if SpheroBolt class is loaded
        if (typeof SpheroBolt === 'undefined') {
            throw new Error("SpheroBolt class not loaded. Please check that boltAPP scripts are loaded correctly.");
        }
        
        // Check if Web Bluetooth is supported
        if (!navigator.bluetooth) {
            throw new Error("Web Bluetooth API is not supported in this browser. Please use Chrome, Edge, or Opera.");
        }
        
        console.log("🔵 [DEBUG] Starting Sphero connection process...");
        updateConnectionStatus("Scanning for devices...", "#ffaa00");
        
        // Update UI
        connectBtn.textContent = "Scanning...";
        connectBtn.disabled = true;
        
        // Create new SpheroBolt instance and connect
        bolt = new SpheroBolt();
        await bolt.connect();
        
        if (!bolt.connected) {
            throw new Error("Failed to connect to Sphero BOLT");
        }
        
        console.log("✅ [DEBUG] Connection established!");
        logToTerminal("Connected to Sphero BOLT!", "success");
        
        isConnected = true;
        
        // Listen for disconnection
        if (bolt.device) {
            bolt.device.addEventListener('gattserverdisconnected', onSpheroDisconnected);
        }
        
        // Send initialization: Show solid green on matrix
        try {
            await sleep(500); // Wait a bit for initialization to complete
            bolt.setMatrixColor(0, 255, 0); // Solid green
            updateVirtualMatrix(0, 255, 0);
            logToTerminal("Matrix set to green (connected)", "success");
        } catch (initError) {
            console.warn("Initialization commands failed:", initError);
        }
        
        // Update UI - Hide button since status message shows connection
        connectBtn.style.display = "none";
        updateConnectionStatus("Connected to Sphero BOLT!", "#00aa00");
        
        // Activate command column
        activateCommandColumn();
        
    } catch (error) {
        console.error("❌ [DEBUG] Connection error:", error);
        
        isConnected = false;
        bolt = null;
        connectBtn.textContent = "Connect to Sphero BOLT";
        connectBtn.disabled = false;
        connectBtn.style.display = "block"; // Show button on error
        
        updateConnectionStatus("Connection failed", "#aa0000");
        logToTerminal(`Connection failed: ${error.message}`, "error");
        
        let errorMsg = "Connection failed: " + error.message;
        if (error.name === 'NotFoundError') {
            errorMsg += "\n\nNo Sphero BOLT device found. Make sure:\n1. Your Sphero BOLT is powered on\n2. It's nearby and in pairing mode\n3. Bluetooth is enabled on your device";
        } else if (error.name === 'SecurityError') {
            errorMsg += "\n\nBluetooth permission denied. Please allow Bluetooth access and try again.";
        } else if (!navigator.bluetooth) {
            errorMsg += "\n\nWeb Bluetooth is not supported. Please use Chrome, Edge, or Opera browser.";
        }
        alert(errorMsg);
    }
}

function onSpheroDisconnected(event) {
    console.log("Sphero BOLT disconnected");
    isConnected = false;
    bolt = null;
    
    // Clean up movement control
    if (typeof cleanupMovementControl === 'function') {
        cleanupMovementControl();
    }
    
    const connectBtn = document.getElementById("connectBtn");
    connectBtn.textContent = "Connect to Sphero BOLT";
    connectBtn.disabled = false;
    connectBtn.style.display = "block"; // Show button again when disconnected
    updateConnectionStatus("Disconnected", "#aa0000");
    logToTerminal("Disconnected from Sphero BOLT", "warning");
    updateMovementStatus("Status: Disconnected");
    
    // Deactivate command column
    deactivateCommandColumn();
}

// Helper function removed - using boltAPP methods directly

// Helper function for sleep/delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Connection status is now handled by Web Bluetooth disconnect event

// Disconnection is now handled by onSpheroDisconnected

// Helper function to update connection status
function updateConnectionStatus(message, color) {
    const statusDiv = document.getElementById("connectionStatus");
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.color = color;
    }
    console.log("📊 [STATUS]", message);
}

// onDisconnected is now handled by onSpheroDisconnected


//--------------------------------------
// SPHERO COMMANDS
//--------------------------------------

// Set LED color (R, G, B values 0-255)
// Optimized for real-time: fire-and-forget, no blocking
async function setColor(r, g, b) {
    if (!isConnected || !bolt) {
        logToTerminal("setColor called but not connected", "warning");
        return;
    }
    
    logToTerminal(`LED color: RGB(${r}, ${g}, ${b})`, "action");
    
    try {
        bolt.setMainLedColor(r, g, b);
    } catch (error) {
        logToTerminal(`Error setting LED color: ${error.message}`, "error");
    }
}

// Set matrix LED color (R, G, B values 0-255)
// Optimized for real-time: fire-and-forget, no blocking
async function setMatrixColor(r, g, b) {
    // Update virtual matrix immediately for visual feedback
    updateVirtualMatrix(r, g, b);
    
    if (!isConnected || !bolt) {
        logToTerminal("setMatrixColor called but not connected", "warning");
        return;
    }
    
    try {
        bolt.setMatrixColor(r, g, b);
    } catch (error) {
        logToTerminal(`Error setting matrix color: ${error.message}`, "error");
    }
}

// Drive command (speed 0-255, heading 0-359 degrees)
// Optimized for real-time: fire-and-forget, no blocking
async function drive(speed, heading) {
    if (!isConnected || !bolt) {
        logToTerminal("drive called but not connected", "warning");
        return;
    }
    
    const speedPercent = ((speed / 255) * 100).toFixed(0);
    logToTerminal(`Drive: Speed ${speedPercent}% (${speed}), Heading ${heading}°`, "action");
    updateMovementStatus(`Status: Moving at ${speedPercent}% speed, heading ${heading}°`);
    
    try {
        bolt.roll(speed, heading, []);
    } catch (error) {
        logToTerminal(`Error driving: ${error.message}`, "error");
    }
}

// Stop the robot
// Optimized for real-time: fire-and-forget, no blocking
async function stop() {
    if (!isConnected || !bolt) {
        logToTerminal("stop called but not connected", "warning");
        return;
    }
    
    logToTerminal("Stop command sent", "action");
    updateMovementStatus("Status: Stopped");
    
    try {
        // Use current heading (or 0 if not set) with speed 0
        const currentHeading = bolt.heading || 0;
        bolt.roll(0, currentHeading, []);
    } catch (error) {
        logToTerminal(`Error stopping: ${error.message}`, "error");
    }
}

// Turn robot to a specific heading (degrees 0-359)
// Optimized for real-time: fire-and-forget, no blocking
async function turn(heading, speed = 0) {
    if (!isConnected || !bolt) {
        logToTerminal("turn called but not connected", "warning");
        return;
    }
    
    const speedText = speed > 0 ? ` at speed ${speed}` : "";
    logToTerminal(`Turn to ${heading}°${speedText}`, "action");
    updateMovementStatus(`Status: Turning to ${heading}°${speedText}`);
    
    try {
        bolt.roll(speed, heading, []);
    } catch (error) {
        logToTerminal(`Error turning: ${error.message}`, "error");
    }
}

// Scroll text on the LED matrix
// text: string to display
// color: object with r, g, b values (0-255)
// speed: scroll speed (0-255, lower is faster)
// loop: boolean, whether to loop the text
// Scroll text on LED matrix
// Optimized for real-time: fire-and-forget, no blocking
async function scrollMatrixText(text, color, speed, loop) {
    if (!isConnected || !bolt) {
        logToTerminal("scrollMatrixText called but not connected", "warning");
        return;
    }
    
    const colorStr = color ? `RGB(${color.r}, ${color.g}, ${color.b})` : "default";
    logToTerminal(`Scroll text: "${text}" (${colorStr}, speed: ${speed}, loop: ${loop})`, "action");
    
    // Sphero BOLT command: Scroll text on matrix using boltAPP
    try {
        const r = color ? color.r : 255;
        const g = color ? color.g : 255;
        const b = color ? color.b : 255;
        const loopByte = loop ? 0x01 : 0x00;
        const textBytes = new TextEncoder().encode(text);
        
        // Create command using boltAPP's createCommand method
        const commandInfo = {
            deviceId: DeviceId.userIO,
            commandId: UserIOCommandIds.matrixScrollText,
            targetId: 0x12,
            data: [speed, r, g, b, loopByte, textBytes.length, ...textBytes]
        };
        const command = bolt.createCommand(commandInfo);
        bolt.queueCommand(command);
    } catch (error) {
        logToTerminal(`Error scrolling text: ${error.message}`, "error");
    }
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

// Display label action selectors
function displayLabelActionSelectors(labels) {
    const actionSection = document.getElementById("label-action-section");
    const actionSelectorsContainer = document.getElementById("label-action-selectors");
    
    if (!actionSection || !actionSelectorsContainer || !labels || labels.length === 0) {
        return;
    }
    
    // Show the section
    actionSection.style.display = "block";
    actionSelectorsContainer.innerHTML = "";
    
    // Create action selector for each label
    labels.forEach(label => {
        const labelActionDiv = document.createElement("div");
        labelActionDiv.className = "label-action-item";
        labelActionDiv.dataset.label = label;
        
        // Label name
        const labelName = document.createElement("div");
        labelName.className = "label-action-name";
        labelName.textContent = label;
        labelActionDiv.appendChild(labelName);
        
        // Action type selector
        const actionSelect = document.createElement("select");
        actionSelect.className = "label-action-select";
        actionSelect.dataset.label = label;
        
        // Action options
        const options = [
            { value: "none", text: "No Action" },
            { value: "roll", text: "Roll Forward" },
            { value: "angle", text: "Set Angle" },
            { value: "stop", text: "Stop Moving" }
        ];
        
        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.text;
            if (labelActions[label] && labelActions[label].type === opt.value) {
                option.selected = true;
            }
            actionSelect.appendChild(option);
        });
        
        // Action parameters container
        const paramsContainer = document.createElement("div");
        paramsContainer.className = "label-action-params";
        paramsContainer.style.display = "none";
        
        // Roll parameters: speed, heading
        const rollParams = document.createElement("div");
        rollParams.className = "action-params-roll";
        rollParams.style.display = "none";
        
        const speedLabel = document.createElement("label");
        speedLabel.textContent = "Speed (0-255):";
        const speedInput = document.createElement("input");
        speedInput.type = "number";
        speedInput.min = "0";
        speedInput.max = "255";
        speedInput.value = labelActions[label]?.speed || 100;
        speedInput.className = "action-param-speed";
        
        const headingLabel = document.createElement("label");
        headingLabel.textContent = "Heading (0-359):";
        const headingInput = document.createElement("input");
        headingInput.type = "number";
        headingInput.min = "0";
        headingInput.max = "359";
        headingInput.value = labelActions[label]?.heading || 0;
        headingInput.className = "action-param-heading";
        
        rollParams.appendChild(speedLabel);
        rollParams.appendChild(speedInput);
        rollParams.appendChild(headingLabel);
        rollParams.appendChild(headingInput);
        
        // Angle parameters: angle
        const angleParams = document.createElement("div");
        angleParams.className = "action-params-angle";
        angleParams.style.display = "none";
        
        const angleLabel = document.createElement("label");
        angleLabel.textContent = "Angle (0-359):";
        const angleInput = document.createElement("input");
        angleInput.type = "number";
        angleInput.min = "0";
        angleInput.max = "359";
        angleInput.value = labelActions[label]?.angle || 0;
        angleInput.className = "action-param-angle";
        
        angleParams.appendChild(angleLabel);
        angleParams.appendChild(angleInput);
        
        // Matrix color parameters: color picker
        const matrixParams = document.createElement("div");
        matrixParams.className = "action-params-matrix";
        matrixParams.style.display = "none";
        
        const colorLabel = document.createElement("label");
        colorLabel.textContent = "Color:";
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        const currentColor = labelActions[label]?.color || labelColors[label] || { r: 255, g: 0, b: 0 };
        colorInput.value = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        colorInput.className = "action-param-color";
        
        matrixParams.appendChild(colorLabel);
        matrixParams.appendChild(colorInput);
        
        paramsContainer.appendChild(rollParams);
        paramsContainer.appendChild(angleParams);
        paramsContainer.appendChild(matrixParams);
        
        // Show/hide parameters based on selected action
        function updateParamsVisibility() {
            const selectedAction = actionSelect.value;
            rollParams.style.display = selectedAction === "roll" ? "block" : "none";
            angleParams.style.display = selectedAction === "angle" ? "block" : "none";
            matrixParams.style.display = selectedAction === "matrix" ? "block" : "none";
            paramsContainer.style.display = selectedAction !== "none" && selectedAction !== "stop" ? "block" : "none";
            
            // Save action immediately when changed
            if (selectedAction === "none") {
                delete labelActions[label];
            } else {
                const action = {
                    type: selectedAction,
                    speed: parseInt(speedInput.value) || 100,
                    heading: parseInt(headingInput.value) || 0,
                    angle: parseInt(angleInput.value) || 0,
                    color: hexToRgb(colorInput.value)
                };
                labelActions[label] = action;
            }
            window.labelActions = labelActions; // Update global reference
        }
        
        actionSelect.addEventListener("change", updateParamsVisibility);
        speedInput.addEventListener("input", updateParamsVisibility);
        headingInput.addEventListener("input", updateParamsVisibility);
        angleInput.addEventListener("input", updateParamsVisibility);
        colorInput.addEventListener("input", updateParamsVisibility);
        
        // Initial visibility
        updateParamsVisibility();
        
        labelActionDiv.appendChild(actionSelect);
        labelActionDiv.appendChild(paramsContainer);
        actionSelectorsContainer.appendChild(labelActionDiv);
    });
    
    logToTerminal(`Action selectors displayed for ${labels.length} labels`, "info");
}

// Display label list (new unified UI)
function displayLabelList(labels) {
    const labelListSection = document.getElementById("label-list-section");
    const labelListContainer = document.getElementById("label-list");
    
    if (!labelListSection || !labelListContainer || !labels || labels.length === 0) {
        return;
    }
    
    // Show the section
    labelListSection.style.display = "block";
    labelListContainer.innerHTML = "";
    
    // Initialize default colors if not set
    labels.forEach((label, index) => {
        if (!labelColors[label]) {
            const hue = (index * 360) / labels.length;
            const rgb = hslToRgb(hue / 360, 0.7, 0.5);
            labelColors[label] = { r: rgb[0], g: rgb[1], b: rgb[2] };
        }
    });
    
    // Update global reference
    window.labelColors = labelColors;
    
    // Create clickable label items
    labels.forEach(label => {
        const labelItem = document.createElement("div");
        labelItem.className = "label-list-item";
        labelItem.dataset.label = label;
        
        const currentColor = labelColors[label] || { r: 0, g: 0, b: 0 };
        const hexColor = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        labelItem.style.backgroundColor = hexColor;
        labelItem.style.color = getContrastColor(currentColor.r, currentColor.g, currentColor.b);
        labelItem.textContent = label;
        
        // Show current action if set
        const actionInfo = document.createElement("span");
        actionInfo.className = "label-action-info";
        if (labelActions[label] && labelActions[label].type !== "none") {
            const actionNames = {
                "roll": "Roll",
                "angle": "Angle",
                "stop": "Stop",
                "matrix": "Matrix"
            };
            actionInfo.textContent = ` • ${actionNames[labelActions[label].type] || labelActions[label].type}`;
        }
        labelItem.appendChild(actionInfo);
        
        // Click handler - show choice modal
        labelItem.addEventListener("click", () => {
            showLabelChoiceModal(label);
        });
        
        labelListContainer.appendChild(labelItem);
    });
    
    logToTerminal(`Label list created for ${labels.length} labels`, "info");
    
    // Setup update button
    setupUpdateButton();
}

// Show label choice modal (Color or Action)
let currentEditingLabel = null;

function showLabelChoiceModal(label) {
    currentEditingLabel = label;
    const modal = document.getElementById("label-choice-modal");
    const title = document.getElementById("label-choice-title");
    
    if (modal && title) {
        title.textContent = `Configure: ${label}`;
        modal.style.display = "flex";
        
        // Setup button handlers
        const colorBtn = modal.querySelector('[data-choice="color"]');
        const actionBtn = modal.querySelector('[data-choice="action"]');
        const closeBtn = modal.querySelector('.label-choice-close');
        
        if (colorBtn) {
            colorBtn.onclick = () => {
                modal.style.display = "none";
                showColorPickerModal(label);
            };
        }
        
        if (actionBtn) {
            actionBtn.onclick = () => {
                modal.style.display = "none";
                showActionSelectorModal(label);
            };
        }
        
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = "none";
                currentEditingLabel = null;
            };
        }
    }
}

// Show color picker modal (right corner)
// Store the current color input handler to remove it later
let currentColorInputHandler = null;

function showColorPickerModal(label) {
    const modal = document.getElementById("color-picker-modal");
    const title = document.getElementById("color-picker-title");
    const colorInput = document.getElementById("color-picker-input");
    
    if (modal && title && colorInput) {
        title.textContent = `Color for: ${label}`;
        
        // Remove any existing event listener to prevent duplicates
        if (currentColorInputHandler) {
            colorInput.removeEventListener("input", currentColorInputHandler);
            currentColorInputHandler = null;
        }
        
        // Set current color (use pending if exists, otherwise use saved)
        const currentColor = pendingLabelColors[label] || labelColors[label] || { r: 255, g: 0, b: 0 };
        colorInput.value = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        
        modal.style.display = "flex";
        
        // Create a new handler for this specific label
        currentColorInputHandler = (e) => {
            const hex = e.target.value;
            const rgb = hexToRgb(hex);
            pendingLabelColors[label] = { r: rgb.r, g: rgb.g, b: rgb.b };
            
            // Update label display preview (not saved yet) - only for the current label
            updateLabelDisplayPreview(label, hex, rgb);
            
            // Show update button if there are pending changes
            checkPendingChanges();
        };
        
        // Store color changes in pendingLabelColors (not applied yet)
        colorInput.addEventListener("input", currentColorInputHandler);
        
        // Setup cancel button
        const cancelBtn = document.getElementById("color-picker-cancel");
        if (cancelBtn) {
            // Remove any existing onclick handler
            cancelBtn.onclick = null;
            cancelBtn.onclick = () => {
                modal.style.display = "none";
                currentEditingLabel = null;
                // Remove event listener when closing
                if (currentColorInputHandler) {
                    colorInput.removeEventListener("input", currentColorInputHandler);
                    currentColorInputHandler = null;
                }
                // Show update button if there are pending changes
                checkPendingChanges();
            };
        }
    }
}

// Show action selector modal
function showActionSelectorModal(label) {
    const modal = document.getElementById("action-selector-modal");
    const title = document.getElementById("action-selector-title");
    const body = document.getElementById("action-selector-body");
    
    if (modal && title && body) {
        title.textContent = `Action for: ${label}`;
        body.innerHTML = "";
        
        modal.style.display = "flex";
        
        // Create action selector UI for this specific label
        const actionSelect = document.createElement("select");
        actionSelect.className = "action-select-modal";
        
        const options = [
            { value: "none", text: "No Action" },
            { value: "roll", text: "Roll Forward" },
            { value: "angle", text: "Set Angle" },
            { value: "stop", text: "Stop Moving" }
        ];
        
        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.text;
            if (labelActions[label] && labelActions[label].type === opt.value) {
                option.selected = true;
            }
            actionSelect.appendChild(option);
        });
        
        body.appendChild(actionSelect);
        
        // Parameters container
        const paramsContainer = document.createElement("div");
        paramsContainer.className = "action-params-modal";
        paramsContainer.style.display = "none";
        
        // Roll parameters
        const rollParams = createRollParams(label);
        const angleParams = createAngleParams(label);
        
        paramsContainer.appendChild(rollParams);
        paramsContainer.appendChild(angleParams);
        
        body.appendChild(paramsContainer);
        
        // Store pending actions (not applied yet)
        const pendingActions = {};
        if (labelActions[label]) {
            pendingActions[label] = { ...labelActions[label] };
        }
        
        // Update visibility function
        function updateParamsVisibility() {
            const selectedAction = actionSelect.value;
            rollParams.style.display = selectedAction === "roll" ? "block" : "none";
            angleParams.style.display = selectedAction === "angle" ? "block" : "none";
            paramsContainer.style.display = selectedAction !== "none" && selectedAction !== "stop" ? "block" : "none";
            
            // Store in pending actions (not saved to labelActions yet)
            if (selectedAction === "none") {
                delete pendingActions[label];
            } else {
                const speedInput = rollParams.querySelector('.action-param-speed');
                const headingInput = rollParams.querySelector('.action-param-heading');
                const angleInput = angleParams.querySelector('.action-param-angle');
                
                pendingActions[label] = {
                    type: selectedAction,
                    speed: speedInput ? parseInt(speedInput.value) || 100 : 100,
                    heading: headingInput ? parseInt(headingInput.value) || 0 : 0,
                    angle: angleInput ? parseInt(angleInput.value) || 0 : 0
                };
            }
            
            // Update label display preview (not saved yet)
            updateLabelDisplayPreview(label, null, null, pendingActions[label]);
            
            // Show update button if there are pending changes
            checkPendingChanges();
        }
        
        actionSelect.addEventListener("change", updateParamsVisibility);
        
        // Add input listeners for parameters
        const speedInput = rollParams.querySelector('.action-param-speed');
        const headingInput = rollParams.querySelector('.action-param-heading');
        const angleInput = angleParams.querySelector('.action-param-angle');
        
        if (speedInput) speedInput.addEventListener("input", updateParamsVisibility);
        if (headingInput) headingInput.addEventListener("input", updateParamsVisibility);
        if (angleInput) angleInput.addEventListener("input", updateParamsVisibility);
        
        updateParamsVisibility(); // Initial call
        
        // Store pending actions when modal closes
        const closeBtn = document.getElementById("action-selector-close");
        if (closeBtn) {
            closeBtn.onclick = () => {
                // Save pending actions to pendingLabelActions (but not applied yet)
                if (!window.pendingLabelActions) {
                    window.pendingLabelActions = {};
                }
                if (pendingActions[label]) {
                    window.pendingLabelActions[label] = pendingActions[label];
                } else {
                    delete window.pendingLabelActions[label];
                }
                
                modal.style.display = "none";
                currentEditingLabel = null;
                checkPendingChanges();
            };
        }
    }
}

// Helper functions to create parameter inputs
function createRollParams(label) {
    const div = document.createElement("div");
    div.className = "action-params-roll";
    
    // Speed parameter group
    const speedGroup = document.createElement("div");
    speedGroup.className = "param-group";
    const speedLabel = document.createElement("label");
    speedLabel.textContent = "Speed (0-255):";
    speedLabel.className = "param-label";
    const speedInput = document.createElement("input");
    speedInput.type = "number";
    speedInput.min = "0";
    speedInput.max = "255";
    speedInput.value = labelActions[label]?.speed || 100;
    speedInput.className = "action-param-speed param-input";
    speedGroup.appendChild(speedLabel);
    speedGroup.appendChild(speedInput);
    
    // Heading parameter group (on new line)
    const headingGroup = document.createElement("div");
    headingGroup.className = "param-group";
    const headingLabel = document.createElement("label");
    headingLabel.textContent = "Heading (0-359):";
    headingLabel.className = "param-label";
    const headingInput = document.createElement("input");
    headingInput.type = "number";
    headingInput.min = "0";
    headingInput.max = "359";
    headingInput.value = labelActions[label]?.heading || 0;
    headingInput.className = "action-param-heading param-input";
    headingGroup.appendChild(headingLabel);
    headingGroup.appendChild(headingInput);
    
    div.appendChild(speedGroup);
    div.appendChild(headingGroup);
    
    return div;
}

function createAngleParams(label) {
    const div = document.createElement("div");
    div.className = "action-params-angle";
    
    // Angle parameter group
    const angleGroup = document.createElement("div");
    angleGroup.className = "param-group";
    const angleLabel = document.createElement("label");
    angleLabel.textContent = "Angle (0-359):";
    angleLabel.className = "param-label";
    const angleInput = document.createElement("input");
    angleInput.type = "number";
    angleInput.min = "0";
    angleInput.max = "359";
    angleInput.value = labelActions[label]?.angle || 0;
    angleInput.className = "action-param-angle param-input";
    angleGroup.appendChild(angleLabel);
    angleGroup.appendChild(angleInput);
    
    div.appendChild(angleGroup);
    
    return div;
}

// Update label display preview (for pending changes, not saved yet)
function updateLabelDisplayPreview(label, hexColor, rgbColor, pendingAction) {
    const labelItem = document.querySelector(`.label-list-item[data-label="${label}"]`);
    if (labelItem) {
        // Update color preview if provided
        if (hexColor && rgbColor) {
            labelItem.style.backgroundColor = hexColor;
            labelItem.style.color = getContrastColor(rgbColor.r, rgbColor.g, rgbColor.b);
        }
        
        // Update action info preview if provided
        const actionInfo = labelItem.querySelector('.label-action-info');
        if (actionInfo) {
            if (pendingAction && pendingAction.type !== "none") {
                const actionNames = {
                    "roll": "Roll",
                    "angle": "Angle",
                    "stop": "Stop"
                };
                actionInfo.textContent = ` • ${actionNames[pendingAction.type] || pendingAction.type}`;
            } else if (!pendingAction) {
                // Use saved action
                const savedAction = window.pendingLabelActions && window.pendingLabelActions[label] 
                    ? window.pendingLabelActions[label] 
                    : (labelActions[label] || null);
                if (savedAction && savedAction.type !== "none") {
                    const actionNames = {
                        "roll": "Roll",
                        "angle": "Angle",
                        "stop": "Stop"
                    };
                    actionInfo.textContent = ` • ${actionNames[savedAction.type] || savedAction.type}`;
                } else {
                    actionInfo.textContent = "";
                }
            } else {
                actionInfo.textContent = "";
            }
        }
    }
}

// Update label display after changes (saved)
function updateLabelDisplay(label) {
    const labelItem = document.querySelector(`.label-list-item[data-label="${label}"]`);
    if (labelItem) {
        // Update color
        const currentColor = labelColors[label] || { r: 0, g: 0, b: 0 };
        const hexColor = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        labelItem.style.backgroundColor = hexColor;
        labelItem.style.color = getContrastColor(currentColor.r, currentColor.g, currentColor.b);
        
        // Update action info
        const actionInfo = labelItem.querySelector('.label-action-info');
        if (actionInfo) {
            const currentAction = (window.pendingLabelActions && window.pendingLabelActions[label]) 
                ? window.pendingLabelActions[label] 
                : (labelActions[label] || null);
            if (currentAction && currentAction.type !== "none") {
                const actionNames = {
                    "roll": "Roll",
                    "angle": "Angle",
                    "stop": "Stop"
                };
                actionInfo.textContent = ` • ${actionNames[currentAction.type] || currentAction.type}`;
            } else {
                actionInfo.textContent = "";
            }
        }
    }
}

// Check if there are pending changes and show/hide update button
function checkPendingChanges() {
    const updateBtn = document.getElementById("update-color-action-btn");
    if (!updateBtn) return;
    
    const hasPendingColors = Object.keys(pendingLabelColors).length > 0;
    const hasPendingActions = window.pendingLabelActions && Object.keys(window.pendingLabelActions).length > 0;
    
    if (hasPendingColors || hasPendingActions) {
        updateBtn.style.display = "block";
    } else {
        updateBtn.style.display = "none";
    }
}

// Setup Update Color & Action button handler
function setupUpdateButton() {
    const updateBtn = document.getElementById("update-color-action-btn");
    if (updateBtn) {
        // Remove any existing listeners
        const newUpdateBtn = updateBtn.cloneNode(true);
        updateBtn.parentNode.replaceChild(newUpdateBtn, updateBtn);
        
        newUpdateBtn.addEventListener("click", () => {
            // Apply pending colors
            Object.keys(pendingLabelColors).forEach(label => {
                labelColors[label] = { ...pendingLabelColors[label] };
            });
            pendingLabelColors = {};
            
            // Apply pending actions
            if (window.pendingLabelActions) {
                Object.keys(window.pendingLabelActions).forEach(label => {
                    labelActions[label] = { ...window.pendingLabelActions[label] };
                });
                window.pendingLabelActions = {};
            }
            
            // Update global references
            window.labelColors = labelColors;
            window.labelActions = labelActions;
            
            // Update all label displays
            Object.keys(labelColors).forEach(label => {
                updateLabelDisplay(label);
            });
            
            // Hide update button
            newUpdateBtn.style.display = "none";
            
            logToTerminal("Colors and actions updated for all labels", "success");
        });
    }
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
    
    // Handle movement control first (separate from color commands)
    if (typeof handleMovementControl === 'function') {
        handleMovementControl(gesture);
    }
    
    // Use the modular gesture configuration system for color/matrix commands
    // executeGestureActions will check for user-selected colors first
    // Note: Movement control is handled separately above, so color commands can still run
    if (typeof executeGestureActions === 'function') {
        // Fire-and-forget: execute immediately without blocking
        executeGestureActions(gesture);
    }
    // No fallback needed - gesture-config.js handles all gestures
}
