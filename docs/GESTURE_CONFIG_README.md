# Gesture Configuration Guide

This guide explains how to customize gesture-to-action mappings for your Sphero BOLT robot.

## Overview

The gesture control system uses a modular configuration file (`gesture-config.js`) that maps gesture class names from your Teachable Machine model to robot actions. This makes it easy to customize controls without modifying the main application code.

## How It Works

1. **Teachable Machine** detects gestures and outputs class names (e.g., "Ms. Liu", "Cat", "Dog")
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

#### Set Matrix Color
Change the robot's LED matrix color.

```javascript
{ type: "setMatrixColor", r: 255, g: 0, b: 0 }
```
- `r`, `g`, `b`: Red, Green, Blue values (0-255)

## Example Configurations

### Current Default: Category-Based Matrix Colors

```javascript
"Ms. Liu": {
    actions: [
        { type: "setMatrixColor", r: 138, g: 43, b: 226 }  // Blue violet (fallback if no user selection)
    ]
},

"Cat": {
    actions: [
        { type: "setMatrixColor", r: 255, g: 165, b: 0 }  // Orange (fallback if no user selection)
    ]
},

"Dog": {
    actions: [
        { type: "setMatrixColor", r: 139, g: 69, b: 19 }  // Saddle brown (fallback if no user selection)
    ]
}
```

**Note:** The colors defined in `setMatrixColor` actions are now used as **fallback values only**. If a user has selected a color for a label using the color picker in the "Sphero Connection" column, that user-selected color will be used instead of the hardcoded value. The hardcoded colors serve as defaults when no user selection exists.

### Adding a New Gesture

To add a new gesture category:

1. Train your model in Teachable Machine with the new class name
2. Add to `gesture-config.js`:

```javascript
"YourCategory": {
    actions: [
        { type: "setMatrixColor", r: 255, g: 0, b: 255 }  // Your chosen color
    ]
}
```

## Tips

1. **Case Insensitive**: Gesture names are matched case-insensitively, so "Ms. Liu", "ms. liu", and "MS. LIU" all work.

2. **Color Values**: RGB values range from 0-255. You can use online color pickers to find RGB values for your desired colors.

3. **Testing**: After modifying `gesture-config.js`, refresh your browser to load the new configuration.

4. **Backup**: Keep a backup of your working configuration before making changes.

## Troubleshooting

- **Gesture not working?** Check that the gesture name in `gesture-config.js` matches your Teachable Machine class name exactly (case-insensitive).
- **Actions not executing?** Check the browser console (F12) for error messages.
- **Robot not responding?** Make sure the Sphero is connected and the backend server is running.

## Need Help?

Refer to the main README.md for setup instructions and troubleshooting.



