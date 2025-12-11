/**
 * Gesture Configuration File
 * 
 * This file defines how gestures map to robot actions.
 * Students can easily modify this file to customize their gesture controls.
 * 
 * Each gesture can trigger multiple actions:
 * - turn: Set robot heading (0-359 degrees)
 * - drive: Move robot (speed 0-255, heading 0-359)
 * - setColor: Change LED color (r, g, b values 0-255)
 * - setMatrixColor: Change LED matrix color (r, g, b values 0-255)
 * - stop: Stop the robot
 * - scrollText: Display text on LED matrix
 */

const GESTURE_CONFIG = {
    // Ms. Liu gesture: set matrix to light blue
    // Support both "Ms. Liu" and "Ms.Liu" variations
    "Ms. Liu": {
        actions: [
            { type: "setMatrixColor", r: 173, g: 216, b: 230 }  // Light blue
        ]
    },
    "Ms.Liu": {
        actions: [
            { type: "setMatrixColor", r: 173, g: 216, b: 230 }  // Light blue
        ]
    },
    
    // Cat gesture: set matrix to orange
    "Cat": {
        actions: [
            { type: "setMatrixColor", r: 255, g: 165, b: 0 }  // Orange
        ]
    },
    
    // Dog gesture: set matrix to brown
    "Dog": {
        actions: [
            { type: "setMatrixColor", r: 139, g: 69, b: 19 }  // Saddle brown
        ]
    }
};

/**
 * Get configuration for a gesture (case-insensitive)
 * @param {string} gestureName - The gesture class name from Teachable Machine
 * @returns {Object|null} - The gesture configuration or null if not found
 */
function getGestureConfig(gestureName) {
    if (!gestureName) return null;
    
    // Normalize: remove spaces around periods and convert to lowercase for flexible matching
    const normalize = (str) => str.toLowerCase().replace(/\s*\.\s*/g, '.');
    
    // Try exact match first
    if (GESTURE_CONFIG[gestureName]) {
        return GESTURE_CONFIG[gestureName];
    }
    
    // Try normalized match (handles case and space variations around periods)
    const normalizedName = normalize(gestureName);
    for (const key in GESTURE_CONFIG) {
        if (normalize(key) === normalizedName) {
            return GESTURE_CONFIG[key];
        }
    }
    
    // Fallback: try simple case-insensitive match
    const lowerName = gestureName.toLowerCase();
    for (const key in GESTURE_CONFIG) {
        if (key.toLowerCase() === lowerName) {
            return GESTURE_CONFIG[key];
        }
    }
    
    return null;
}

/**
 * Execute actions for a gesture (optimized for real-time responsiveness)
 * No throttling - always processes current frame immediately
 * @param {string} gestureName - The gesture class name
 */
function executeGestureActions(gestureName) {
    const config = getGestureConfig(gestureName);
    
    if (!config || !config.actions) {
        return; // Silently ignore unknown gestures
    }
    
    // Execute all actions immediately (fire-and-forget) for maximum speed
    // No throttling - always use current frame with minimal delay
    for (const action of config.actions) {
        // Fire-and-forget: send commands immediately without waiting
        switch (action.type) {
            case "turn":
                turn(action.heading, action.speed || 0);
                break;
                
            case "drive":
                drive(action.speed || 0, action.heading || 0);
                break;
                
            case "setColor":
                setColor(action.r || 0, action.g || 0, action.b || 0);
                break;
                
            case "setMatrixColor":
                setMatrixColor(action.r || 0, action.g || 0, action.b || 0);
                break;
                
            case "stop":
                stop();
                break;
                
            case "scrollText":
                scrollMatrixText(
                    action.text || "",
                    { r: action.r || 255, g: action.g || 255, b: action.b || 255 },
                    action.speed || 15,
                    action.loop || false
                );
                break;
                
            default:
                // Unknown action type - silently ignore
                break;
        }
    }
}

