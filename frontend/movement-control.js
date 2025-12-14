/**
 * Movement Control Module
 * 
 * Handles robot movement based on user-selected actions for each label.
 * This module uses actions defined in labelActions (set via UI).
 * 
 * Supported Actions:
 * - "roll": Roll forward continuously until label changes
 * - "angle": Set angle (turn to specific heading)
 * - "stop": Stop moving
 * 
 * Matrix color is automatically set based on labelColors when a label is detected.
 */

// Track current movement state
let currentMovementLabel = null;
let currentActionType = null;
let continuousMovementInterval = null;

/**
 * Handle movement for a detected gesture label
 * @param {string} gestureName - The gesture class name from Teachable Machine
 */
function handleMovementControl(gestureName) {
    if (!gestureName || !isConnected || !bolt) {
        // Stop any continuous movement if not connected
        stopContinuousMovement();
        return;
    }

    // Normalize gesture name for matching (case-insensitive, handle spaces)
    const normalize = (str) => str.toLowerCase().replace(/\s*\.\s*/g, '.').trim();
    const normalized = normalize(gestureName);

    // Get user-selected action for this label
    // Check both normalized and original name
    let action = null;
    if (typeof window !== 'undefined' && window.labelActions) {
        // Try exact match first
        action = window.labelActions[gestureName];
        
        // Try normalized match
        if (!action) {
            for (const key in window.labelActions) {
                if (normalize(key) === normalized) {
                    action = window.labelActions[key];
                    break;
                }
            }
        }
    }

    // If no action configured or action is "none", stop any continuous movement
    if (!action || action.type === "none") {
        if (currentMovementLabel && normalize(currentMovementLabel) !== normalized) {
            stopContinuousMovement();
        }
        return;
    }

    // If this is the same label and action is already running, don't restart
    if (currentMovementLabel && normalize(currentMovementLabel) === normalized && 
        currentActionType === action.type && continuousMovementInterval) {
        // For continuous actions, keep them running
        if (action.type === "roll") {
            return; // Already rolling, keep it going
        }
    }

    // Stop any previous continuous movement if label changed
    if (currentMovementLabel && normalize(currentMovementLabel) !== normalized) {
        stopContinuousMovement();
    }

    // Set matrix color automatically based on labelColors
    // Try both exact match and normalized match
    if (typeof window !== 'undefined' && window.labelColors) {
        let labelColor = window.labelColors[gestureName];
        
        // Try normalized match if exact match fails
        if (!labelColor) {
            for (const key in window.labelColors) {
                if (normalize(key) === normalized) {
                    labelColor = window.labelColors[key];
                    break;
                }
            }
        }
        
        if (labelColor) {
            const r = Math.max(0, Math.min(255, parseInt(labelColor.r) || 0));
            const g = Math.max(0, Math.min(255, parseInt(labelColor.g) || 0));
            const b = Math.max(0, Math.min(255, parseInt(labelColor.b) || 0));
            
            if (typeof setMatrixColor === 'function') {
                setMatrixColor(r, g, b);
            }
        }
    }
    
    // Execute the action
    executeAction(gestureName, action);
}

/**
 * Execute a user-selected action
 * @param {string} labelName - Original label name
 * @param {Object} action - Action configuration { type, speed, heading, angle, color }
 */
function executeAction(labelName, action) {
    if (!action || !action.type) {
        return;
    }

    // Check if required functions are available
    if (typeof drive !== 'function' || typeof turn !== 'function' || 
        typeof stop !== 'function' || typeof setMatrixColor !== 'function' || !bolt) {
        console.warn("Movement control: Required functions not available");
        return;
    }

    currentMovementLabel = labelName;
    currentActionType = action.type;

    switch (action.type) {
        case "roll":
            handleRollAction(action);
            break;
            
        case "angle":
            handleAngleAction(action);
            break;
            
        case "stop":
            handleStopAction();
            break;
            
        default:
            console.warn(`Unknown action type: ${action.type}`);
            break;
    }
}

/**
 * Handle roll action: Roll forward continuously
 */
function handleRollAction(action) {
    const speed = Math.max(0, Math.min(255, parseInt(action.speed) || 100));
    const heading = Math.max(0, Math.min(359, parseInt(action.heading) || 0));

    if (typeof logToTerminal === 'function') {
        logToTerminal(`${currentMovementLabel}: Rolling forward (speed: ${speed}, heading: ${heading}°)`, "action");
    }

    // Send initial drive command
    drive(speed, heading);

    // Continue rolling at regular intervals
    continuousMovementInterval = setInterval(() => {
        const normalize = (str) => str.toLowerCase().replace(/\s*\.\s*/g, '.').trim();
        const currentNormalized = currentMovementLabel ? normalize(currentMovementLabel) : null;
        
        // Check if action still applies
        if (currentMovementLabel && typeof window !== 'undefined' && window.labelActions) {
            const currentAction = window.labelActions[currentMovementLabel];
            if (currentAction && currentAction.type === "roll" && 
                typeof isConnected !== 'undefined' && isConnected && bolt) {
                drive(speed, heading);
            } else {
                stopContinuousMovement();
            }
        } else {
            stopContinuousMovement();
        }
    }, 200); // Send drive command every 200ms to maintain movement
}

/**
 * Handle angle action: Set angle (turn to specific heading)
 */
function handleAngleAction(action) {
    const angle = Math.max(0, Math.min(359, parseInt(action.angle) || 0));

    if (typeof logToTerminal === 'function') {
        logToTerminal(`${currentMovementLabel}: Setting angle to ${angle}°`, "action");
    }

    // Turn to the specified angle (without moving forward)
    turn(angle, 0);
}

/**
 * Handle stop action: Stop moving
 */
function handleStopAction() {
    if (typeof logToTerminal === 'function') {
        logToTerminal(`${currentMovementLabel}: Stopping`, "action");
    }

    stop();
    stopContinuousMovement();
}

/**
 * Stop continuous movement
 */
function stopContinuousMovement() {
    if (continuousMovementInterval) {
        clearInterval(continuousMovementInterval);
        continuousMovementInterval = null;
    }

    if (currentActionType === "roll") {
        if (typeof logToTerminal === 'function') {
            logToTerminal("Stopping continuous movement", "action");
        }
        if (typeof stop === 'function') {
            stop();
        }
    }

    currentMovementLabel = null;
    currentActionType = null;
}

/**
 * Clean up movement control (call when disconnecting)
 */
function cleanupMovementControl() {
    stopContinuousMovement();
    currentMovementLabel = null;
    currentActionType = null;
}
