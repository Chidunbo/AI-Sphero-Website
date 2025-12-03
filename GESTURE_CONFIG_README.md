# Gesture Configuration Guide

This guide explains how to customize gesture-to-action mappings for your Sphero BOLT robot.

## Overview

The gesture control system uses a modular configuration file (`gesture-config.js`) that maps gesture class names from your Teachable Machine model to robot actions. This makes it easy to customize controls without modifying the main application code.

## How It Works

1. **Teachable Machine** detects gestures and outputs class names (e.g., "hand", "head")
2. **gesture-config.js** maps these class names to robot actions
3. **app.js** executes the configured actions

## Configuration File: `gesture-config.js`

### Basic Structure

Each gesture is defined with a name and a list of actions:

```javascript
"gestureName": {
    actions: [
        { type: "actionType", ...parameters },
        { type: "actionType", ...parameters }
    ]
}
```

### Available Actions

#### 1. Turn (Set Heading)
Turn the robot to a specific heading without moving forward.

```javascript
{ type: "turn", heading: 0, speed: 0 }
```
- `heading`: Direction in degrees (0-359)
  - 0° = Forward
  - 90° = Right
  - 180° = Backward
  - 270° = Left
- `speed`: Movement speed while turning (0-255, 0 = just turn, no movement)

#### 2. Drive (Move)
Move the robot in a specific direction.

```javascript
{ type: "drive", speed: 100, heading: 0 }
```
- `speed`: Movement speed (0-255)
- `heading`: Direction in degrees (0-359)

#### 3. Set Color
Change the robot's LED color.

```javascript
{ type: "setColor", r: 255, g: 0, b: 0 }
```
- `r`, `g`, `b`: Red, Green, Blue values (0-255)

#### 4. Stop
Stop the robot.

```javascript
{ type: "stop" }
```

#### 5. Scroll Text
Display text on the LED matrix.

```javascript
{ type: "scrollText", text: "Hello", r: 255, g: 255, b: 255, speed: 15, loop: false }
```
- `text`: Text to display
- `r`, `g`, `b`: Text color (0-255)
- `speed`: Scroll speed (0-255, lower is faster)
- `loop`: Whether to loop the text (true/false)

## Example Configurations

### Current Default: Hand/Head Turning

```javascript
"hand": {
    actions: [
        { type: "turn", heading: 0, speed: 0 },    // Turn to 0° (forward)
        { type: "setColor", r: 0, g: 255, b: 0 }  // Green color
    ]
},

"head": {
    actions: [
        { type: "turn", heading: 90, speed: 0 },  // Turn to 90° (right)
        { type: "setColor", r: 255, g: 0, b: 0 }  // Red color
    ]
}
```

### Adding a New Gesture

To add a new gesture (e.g., "wave"):

1. Train your model in Teachable Machine with a "wave" class
2. Add to `gesture-config.js`:

```javascript
"wave": {
    actions: [
        { type: "turn", heading: 180, speed: 0 },
        { type: "setColor", r: 255, g: 255, b: 0 },
        { type: "scrollText", text: "WAVE!", r: 255, g: 255, b: 255, speed: 10, loop: true }
    ]
}
```

### Complex Gesture Example

```javascript
"spin": {
    actions: [
        { type: "setColor", r: 255, g: 0, b: 255 },  // Purple
        { type: "drive", speed: 150, heading: 0 },   // Start moving forward
        // Note: For complex sequences, you may need to use setTimeout in app.js
    ]
}
```

## Tips

1. **Case Insensitive**: Gesture names are matched case-insensitively, so "hand", "Hand", and "HAND" all work.

2. **Multiple Actions**: You can chain multiple actions. They execute in order with a small delay between them.

3. **Speed Values**: 
   - For `turn`: Use `speed: 0` to just rotate without moving
   - For `drive`: Use values 50-255 for movement

4. **Testing**: After modifying `gesture-config.js`, refresh your browser to load the new configuration.

5. **Backup**: Keep a backup of your working configuration before making changes.

## Troubleshooting

- **Gesture not working?** Check that the gesture name in `gesture-config.js` matches your Teachable Machine class name exactly (case-insensitive).
- **Actions not executing?** Check the browser console (F12) for error messages.
- **Robot not responding?** Make sure the Sphero is connected and the backend server is running.

## Need Help?

Refer to the main README.md for setup instructions and troubleshooting.


