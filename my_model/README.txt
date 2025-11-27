EXPORTED MODEL FOLDER
=====================

This folder should contain your EXPORTED Teachable Machine model files.

INSTRUCTIONS FOR STUDENTS:
==========================

1. Train your gesture model in Teachable Machine (https://teachablemachine.withgoogle.com/)
   - Use the training data from the ../training_data/ folder if needed
   - Create classes for your gestures (e.g., "hand-up", "head-left", etc.)

2. Export your model:
   - Click "Export Model" button in Teachable Machine
   - Choose "TensorFlow.js" format
   - Download the zip file

3. Extract the zip file and copy these files into this my_model folder:
   - model.json
   - metadata.json
   - weights.bin (or weights_*.bin files)

4. Replace the placeholder files in this folder with your actual model files

5. Open index.html in a web browser (Chrome or Edge recommended)

6. Click "Start Model" to load your Teachable Machine model

7. Click "Turn On Camera" to request webcam access

8. Click "Connect to Sphero BOLT" to pair with your robot

9. Show your hand gestures to control the robot!

IMPORTANT: 
----------
- The JavaScript code from Teachable Machine is already integrated into app.js
- You only need to copy the model files (model.json, metadata.json, and weights files) into this folder
- Training data is stored separately in the ../training_data/ folder for reference
