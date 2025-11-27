//--------------------------------------
// GLOBAL VARIABLES
//--------------------------------------
// More API functions here:
// https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image
// The link to your model provided by Teachable Machine export panel
const URL = "./my_model/";

let model, webcam, labelContainer, maxPredictions;
let spheroDevice = null;
let spheroService = null;
let spheroCharacteristic = null;
let isConnected = false;

// Sphero BOLT Bluetooth UUIDs
// Note: These are the standard Sphero BOLT UUIDs
// If connection fails, these might need to be adjusted
const SPHERO_SERVICE_UUID = 0x22bb7466;
const SPHERO_CHARACTERISTIC_UUID = 0x22bb7469;

// Helper function to convert UUID to full UUID string format
// For 32-bit UUIDs: "xxxxxxxx-0000-1000-8000-00805f9b34fb"
// Input: 0x22bb7466 -> Output: "22bb7466-0000-1000-8000-00805f9b34fb"
function uuidToString(uuid) {
    // Convert to hex string (lowercase) and pad to 8 digits for 32-bit UUID
    const hex = uuid.toString(16).toLowerCase().padStart(8, '0');
    // Format: xxxxxxxx-0000-1000-8000-00805f9b34fb (32-bit UUID format)
    return `${hex}-0000-1000-8000-00805f9b34fb`;
}

// Debug: Log UUIDs on load
console.log("🔵 [INIT] Sphero BOLT UUIDs configured:");
console.log("  Service UUID (hex):", SPHERO_SERVICE_UUID.toString(16));
console.log("  Service UUID (full):", uuidToString(SPHERO_SERVICE_UUID));
console.log("  Characteristic UUID (hex):", SPHERO_CHARACTERISTIC_UUID.toString(16));
console.log("  Characteristic UUID (full):", uuidToString(SPHERO_CHARACTERISTIC_UUID));


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

    // Only act when confident (threshold: 85%)
    if (highestProb > 0.85 && isConnected) {
        handleGesture(highestClass);
    }
}


//--------------------------------------
// CONNECT TO SPHERO BOLT
//--------------------------------------
document.getElementById("connectBtn").addEventListener("click", connectSphero);

async function connectSphero() {
    const connectBtn = document.getElementById("connectBtn");
    const statusDiv = document.getElementById("connectionStatus");
    
    try {
        console.log("🔵 [DEBUG] Starting Sphero connection process...");
        updateConnectionStatus("Checking WebBluetooth support...", "#ffaa00");
        
        // Check if WebBluetooth is available
        if (!navigator.bluetooth) {
            console.error("❌ [DEBUG] WebBluetooth not available");
            alert("WebBluetooth is not supported in this browser. Please use Chrome/Edge on desktop or Android.");
            updateConnectionStatus("WebBluetooth not supported", "#aa0000");
            return;
        }
        console.log("✅ [DEBUG] WebBluetooth is available");

        // Update UI
        connectBtn.textContent = "Connecting...";
        connectBtn.disabled = true;
        updateConnectionStatus("Requesting device...", "#ffaa00");
        
        // Request device (Sphero BOLT names start with "SB-")
        console.log("🔵 [DEBUG] Requesting Bluetooth device with filter: namePrefix='SB-'");
        console.log("🔵 [DEBUG] Service UUID (hex):", SPHERO_SERVICE_UUID.toString(16));
        console.log("🔵 [DEBUG] Service UUID (full):", uuidToString(SPHERO_SERVICE_UUID));
        
        // Use the short UUID format for optionalServices (WebBluetooth prefers this)
        // The full UUID format can cause errors, so we'll only use it when getting services
        console.log("🔵 [DEBUG] Using short UUID format for requestDevice");
        
        spheroDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: "SB-" }],
            optionalServices: [SPHERO_SERVICE_UUID]  // Use short format (number) for requestDevice
        });
        
        console.log("✅ [DEBUG] Device selected:", spheroDevice.name);
        console.log("🔵 [DEBUG] Device ID:", spheroDevice.id);
        console.log("🔵 [DEBUG] Device connected:", spheroDevice.gatt?.connected);
        updateConnectionStatus(`Device found: ${spheroDevice.name}`, "#ffaa00");

        // Connect to GATT server
        console.log("🔵 [DEBUG] Connecting to GATT server...");
        updateConnectionStatus("Connecting to GATT server...", "#ffaa00");
        
        const server = await spheroDevice.gatt.connect();
        console.log("✅ [DEBUG] GATT server connected:", server.connected);
        updateConnectionStatus("GATT server connected", "#ffaa00");
        
        // Get the Sphero service
        console.log("🔵 [DEBUG] Getting primary service...");
        console.log("🔵 [DEBUG] Looking for service UUID (hex):", SPHERO_SERVICE_UUID.toString(16));
        console.log("🔵 [DEBUG] Looking for service UUID (full):", uuidToString(SPHERO_SERVICE_UUID));
        updateConnectionStatus("Getting service...", "#ffaa00");
        
        // List available services for debugging and try to find the Sphero service
        let services = [];
        try {
            services = await server.getPrimaryServices();
            console.log("🔵 [DEBUG] Available services:", services.length);
            services.forEach((svc, idx) => {
                console.log(`  Service ${idx}: ${svc.uuid} (isPrimary: ${svc.isPrimary})`);
            });
        } catch (e) {
            console.warn("⚠️ [DEBUG] Could not list services:", e);
        }
        
        // Try to get service - first try short format (number), then full format (lowercase string)
        let serviceFound = false;
        try {
            // Try short format (number) - this is what WebBluetooth prefers
            spheroService = await server.getPrimaryService(SPHERO_SERVICE_UUID);
            console.log("✅ [DEBUG] Service found using short UUID format (number)");
            serviceFound = true;
        } catch (e1) {
            console.warn("⚠️ [DEBUG] Failed with short UUID format, trying full lowercase format:", e1);
            try {
                // Try full format but ensure it's lowercase
                const fullUuid = uuidToString(SPHERO_SERVICE_UUID);
                spheroService = await server.getPrimaryService(fullUuid);
                console.log("✅ [DEBUG] Service found using full UUID format (string)");
                serviceFound = true;
            } catch (e2) {
                // If both fail, try to find it by searching through available services
                console.warn("⚠️ [DEBUG] Failed with both UUID formats, searching available services...");
                const targetUuid = SPHERO_SERVICE_UUID.toString(16).toLowerCase();
                const targetFullUuid = uuidToString(SPHERO_SERVICE_UUID);
                
                for (const svc of services) {
                    const svcUuid = svc.uuid.toLowerCase();
                    console.log(`🔵 [DEBUG] Comparing: ${svcUuid} with ${targetUuid} and ${targetFullUuid}`);
                    if (svcUuid === targetUuid || svcUuid === targetFullUuid || 
                        svcUuid.includes(targetUuid) || svcUuid.endsWith(targetUuid)) {
                        spheroService = svc;
                        console.log("✅ [DEBUG] Service found by searching available services:", svc.uuid);
                        serviceFound = true;
                        break;
                    }
                }
                
                if (!serviceFound) {
                    console.error("❌ [DEBUG] Service not found in any format");
                    console.error("   Available service UUIDs:", services.map(s => s.uuid));
                    throw new Error(`Service not found. Available services: ${services.map(s => s.uuid).join(', ')}`);
                }
            }
        }
        console.log("✅ [DEBUG] Service found:", spheroService.uuid);
        updateConnectionStatus("Service found", "#ffaa00");
        
        // Get the characteristic for sending commands
        console.log("🔵 [DEBUG] Getting characteristic...");
        console.log("🔵 [DEBUG] Looking for characteristic UUID (hex):", SPHERO_CHARACTERISTIC_UUID.toString(16));
        console.log("🔵 [DEBUG] Looking for characteristic UUID (full):", uuidToString(SPHERO_CHARACTERISTIC_UUID));
        updateConnectionStatus("Getting characteristic...", "#ffaa00");
        
        // List available characteristics for debugging
        try {
            const characteristics = await spheroService.getCharacteristics();
            console.log("🔵 [DEBUG] Available characteristics:", characteristics.length);
            characteristics.forEach((char, idx) => {
                console.log(`  Characteristic ${idx}: ${char.uuid}, properties:`, char.properties);
                console.log(`    - write: ${char.properties.write}`);
                console.log(`    - writeWithoutResponse: ${char.properties.writeWithoutResponse}`);
                console.log(`    - read: ${char.properties.read}`);
                console.log(`    - notify: ${char.properties.notify}`);
            });
        } catch (e) {
            console.warn("⚠️ [DEBUG] Could not list characteristics:", e);
        }
        
        // Try to get characteristic - first try short format, then full format, then search
        let characteristicFound = false;
        let characteristics = [];
        try {
            characteristics = await spheroService.getCharacteristics();
        } catch (e) {
            console.warn("⚠️ [DEBUG] Could not get characteristics list:", e);
        }
        
        try {
            // Try short format (number)
            spheroCharacteristic = await spheroService.getCharacteristic(SPHERO_CHARACTERISTIC_UUID);
            console.log("✅ [DEBUG] Characteristic found using short UUID format (number)");
            characteristicFound = true;
        } catch (e1) {
            console.warn("⚠️ [DEBUG] Failed with short UUID, trying full format:", e1);
            try {
                // Try full format (lowercase string)
                const fullUuid = uuidToString(SPHERO_CHARACTERISTIC_UUID);
                spheroCharacteristic = await spheroService.getCharacteristic(fullUuid);
                console.log("✅ [DEBUG] Characteristic found using full UUID format (string)");
                characteristicFound = true;
            } catch (e2) {
                // If both fail, try to find it by searching through available characteristics
                console.warn("⚠️ [DEBUG] Failed with both UUID formats, searching available characteristics...");
                const targetUuid = SPHERO_CHARACTERISTIC_UUID.toString(16).toLowerCase();
                const targetFullUuid = uuidToString(SPHERO_CHARACTERISTIC_UUID);
                
                for (const char of characteristics) {
                    const charUuid = char.uuid.toLowerCase();
                    console.log(`🔵 [DEBUG] Comparing characteristic: ${charUuid} with ${targetUuid} and ${targetFullUuid}`);
                    if (charUuid === targetUuid || charUuid === targetFullUuid || 
                        charUuid.includes(targetUuid) || charUuid.endsWith(targetUuid)) {
                        // Also check if it supports write
                        if (char.properties.write || char.properties.writeWithoutResponse) {
                            spheroCharacteristic = char;
                            console.log("✅ [DEBUG] Characteristic found by searching:", char.uuid);
                            characteristicFound = true;
                            break;
                        }
                    }
                }
                
                if (!characteristicFound) {
                    console.error("❌ [DEBUG] Characteristic not found in any format");
                    console.error("   Available characteristic UUIDs:", characteristics.map(c => c.uuid));
                    throw new Error(`Characteristic not found. Available: ${characteristics.map(c => c.uuid).join(', ')}`);
                }
            }
        }
        console.log("✅ [DEBUG] Characteristic found:", spheroCharacteristic.uuid);
        console.log("🔵 [DEBUG] Characteristic properties:", spheroCharacteristic.properties);
        updateConnectionStatus("Characteristic found", "#ffaa00");
        
        // Verify write capability
        if (!spheroCharacteristic.properties.write && !spheroCharacteristic.properties.writeWithoutResponse) {
            console.error("❌ [DEBUG] Characteristic does not support write operations!");
            throw new Error("Characteristic does not support write operations");
        }
        console.log("✅ [DEBUG] Characteristic supports write operations");
        
        // Test connection with a simple command
        console.log("🔵 [DEBUG] Testing connection with setColor command...");
        updateConnectionStatus("Testing connection...", "#ffaa00");
        
        // Try a simple color command first to verify connection
        try {
            await setColor(0, 255, 0); // Green to indicate connection
            console.log("✅ [DEBUG] Test color command sent successfully");
            await new Promise(resolve => setTimeout(resolve, 300)); // Wait a bit
            
            // Then try the scrollMatrixText
            console.log("🔵 [DEBUG] Attempting to scroll 'OK' text...");
            await scrollMatrixText("OK", {r: 140, g: 255, b: 221}, 15, true);
            console.log("✅ [DEBUG] 'OK' text command sent successfully");
        } catch (cmdError) {
            console.error("❌ [DEBUG] Error sending initialization command:", cmdError);
            // Don't fail the connection if command fails - connection is still valid
            console.warn("⚠️ [DEBUG] Connection established but command failed - robot may still be connected");
        }
        
        isConnected = true;
        console.log("✅ [DEBUG] Connection established! isConnected =", isConnected);
        
        // Update UI
        connectBtn.textContent = "Connected ✓";
        connectBtn.disabled = true;
        updateConnectionStatus("Connected to Sphero BOLT!", "#00aa00");

        // Handle disconnection
        spheroDevice.addEventListener('gattserverdisconnected', onDisconnected);
        console.log("✅ [DEBUG] Disconnection handler attached");
        
    } catch (error) {
        console.error("❌ [DEBUG] Connection error at step:", error);
        console.error("❌ [DEBUG] Error name:", error.name);
        console.error("❌ [DEBUG] Error message:", error.message);
        console.error("❌ [DEBUG] Error stack:", error.stack);
        
        isConnected = false;
        connectBtn.textContent = "Connect to Sphero BOLT";
        connectBtn.disabled = false;
        
        if (error.name === 'NotFoundError') {
            updateConnectionStatus("No Sphero BOLT found", "#aa0000");
            alert("No Sphero BOLT found. Make sure it's powered on and nearby.\n\nDebug info: " + error.message);
        } else if (error.name === 'SecurityError') {
            updateConnectionStatus("Connection blocked", "#aa0000");
            alert("Connection was blocked. Please allow Bluetooth access.\n\nDebug info: " + error.message);
        } else if (error.name === 'NetworkError') {
            updateConnectionStatus("Network error", "#aa0000");
            alert("Network error. The device may have disconnected.\n\nDebug info: " + error.message);
        } else {
            updateConnectionStatus("Connection failed", "#aa0000");
            alert("Connection failed: " + error.message + "\n\nCheck the browser console (F12) for detailed debug information.");
        }
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
async function setColor(r, g, b) {
    if (!isConnected || !spheroCharacteristic) {
        console.warn("⚠️ [setColor] Cannot set color - not connected or characteristic missing");
        console.warn("  isConnected:", isConnected);
        console.warn("  spheroCharacteristic:", spheroCharacteristic);
        return;
    }
    
    try {
        console.log(`🔵 [setColor] Setting color to RGB(${r}, ${g}, ${b})`);
        // Sphero BOLT API: Set LED color command
        // Command format: [0x8A, 0x0A, 0x00, 0x00, r, g, b, 0x00, 0x00, 0x00, 0x00]
        const command = new Uint8Array([0x8A, 0x0A, 0x00, 0x00, r, g, b, 0x00, 0x00, 0x00, 0x00]);
        console.log("🔵 [setColor] Command bytes:", Array.from(command).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        // Use writeWithoutResponse if available (faster, more reliable for Sphero)
        if (spheroCharacteristic.properties.writeWithoutResponse) {
            await spheroCharacteristic.writeValueWithoutResponse(command);
            console.log("✅ [setColor] Color command sent (writeWithoutResponse)");
        } else if (spheroCharacteristic.properties.write) {
            await spheroCharacteristic.writeValue(command);
            console.log("✅ [setColor] Color command sent (write)");
        } else {
            throw new Error("Characteristic does not support write operations");
        }
    } catch (error) {
        console.error("❌ [setColor] Error setting color:", error);
        console.error("  Error name:", error.name);
        console.error("  Error message:", error.message);
        throw error; // Re-throw so caller knows it failed
    }
}

// Drive command (speed 0-255, heading 0-359 degrees)
async function drive(speed, heading) {
    if (!isConnected || !spheroCharacteristic) return;
    
    try {
        // Sphero BOLT API: Drive command
        // Command format: [0x8A, 0x02, heading_high, heading_low, speed]
        const headingHigh = (heading >> 8) & 0xFF;
        const headingLow = heading & 0xFF;
        const command = new Uint8Array([0x8A, 0x02, headingHigh, headingLow, speed]);
        await spheroCharacteristic.writeValue(command);
    } catch (error) {
        console.error("Error driving:", error);
    }
}

// Stop the robot
async function stop() {
    await drive(0, 0);
}

// Scroll text on the LED matrix
// text: string to display
// color: object with r, g, b values (0-255)
// speed: scroll speed (0-255, lower is faster)
// loop: boolean, whether to loop the text
async function scrollMatrixText(text, color, speed, loop) {
    if (!isConnected || !spheroCharacteristic) {
        console.warn("⚠️ [scrollMatrixText] Cannot scroll text - not connected or characteristic missing");
        console.warn("  isConnected:", isConnected);
        console.warn("  spheroCharacteristic:", spheroCharacteristic);
        return;
    }
    
    try {
        console.log(`🔵 [scrollMatrixText] Scrolling text: "${text}" with color RGB(${color.r}, ${color.g}, ${color.b}), speed: ${speed}, loop: ${loop}`);
        
        // Sphero BOLT API: Scroll matrix text command
        // Command format: [0x8A, 0x1B, text_length, r, g, b, speed, loop_flag, ...text_bytes...]
        const textBytes = new TextEncoder().encode(text);
        const textLength = textBytes.length;
        const loopFlag = loop ? 1 : 0;
        
        console.log(`🔵 [scrollMatrixText] Text length: ${textLength}, text bytes:`, Array.from(textBytes));
        
        // Build command array
        const command = new Uint8Array([
            0x8A, 0x1B,                    // Command header
            textLength,                    // Text length
            color.r, color.g, color.b,     // RGB color
            speed,                         // Scroll speed
            loopFlag,                      // Loop flag
            ...textBytes                   // Text bytes
        ]);
        
        console.log("🔵 [scrollMatrixText] Command bytes:", Array.from(command).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        console.log("🔵 [scrollMatrixText] Command length:", command.length);
        
        // Use writeWithoutResponse if available (faster, more reliable for Sphero)
        if (spheroCharacteristic.properties.writeWithoutResponse) {
            await spheroCharacteristic.writeValueWithoutResponse(command);
            console.log("✅ [scrollMatrixText] Text command sent (writeWithoutResponse)");
        } else if (spheroCharacteristic.properties.write) {
            await spheroCharacteristic.writeValue(command);
            console.log("✅ [scrollMatrixText] Text command sent (write)");
        } else {
            throw new Error("Characteristic does not support write operations");
        }
    } catch (error) {
        console.error("❌ [scrollMatrixText] Error scrolling matrix text:", error);
        console.error("  Error name:", error.name);
        console.error("  Error message:", error.message);
        throw error; // Re-throw so caller knows it failed
    }
}


//--------------------------------------
// 🎯 STUDENT EDITABLE GESTURE MAPPING
//--------------------------------------
// Students can modify this function to map their gesture class names to robot actions
function handleGesture(gesture) {
    // Map gestures based on your Teachable Machine class names
    // Current model has: "hand" and "head" classes
    
    if (gesture === "hand" || gesture === "Hand") {
        drive(100, 0);        // Move forward when hand is detected
        setColor(0, 255, 0);  // Green while moving forward
    }
    else if (gesture === "head" || gesture === "Head") {
        drive(80, 180);       // Move backward when head is detected
        setColor(255, 0, 0);  // Red while moving backward
    }
    // Add more gesture mappings based on your model classes
    else if (gesture === "Forward" || gesture === "forward" || gesture === "Go") {
        drive(100, 0);        // Move forward (heading 0°)
        setColor(0, 255, 0);  // Green while moving forward
    }
    else if (gesture === "Backward" || gesture === "backward" || gesture === "Back") {
        drive(80, 180);       // Move backward (heading 180°)
        setColor(255, 0, 0); // Red while moving backward
    }
    else if (gesture === "Left" || gesture === "left") {
        drive(80, 270);       // Turn left (heading 270°)
        setColor(255, 165, 0); // Orange while turning left
    }
    else if (gesture === "Right" || gesture === "right") {
        drive(80, 90);        // Turn right (heading 90°)
        setColor(0, 0, 255);  // Blue while turning right
    }
    else if (gesture === "Stop" || gesture === "stop" || gesture === "None") {
        stop();               // Stop the robot
        setColor(255, 255, 255); // White when stopped
    }
    // Students can add more gestures here!
    // Example:
    // else if (gesture === "Spin") {
    //     drive(150, 0);
    //     setTimeout(() => drive(150, 180), 500);
    // }
}
