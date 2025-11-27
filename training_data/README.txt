TRAINING DATA FOLDER
===================

This folder contains the training datasets used to train the Teachable Machine model.

Current datasets:
- hand-samples.zip: Training images for hand gesture recognition
- head-samples.zip: Training images for head gesture recognition

HOW TO USE:
-----------
1. These zip files contain the training samples used in Teachable Machine
2. To retrain or modify the model:
   - Go to https://teachablemachine.withgoogle.com/
   - Create a new image classification project
   - Upload the images from these zip files as your training data
   - Train your model
   - Export the model and place the exported files in the ../my_model/ folder

NOTE:
-----
- These training datasets are NOT used by the running application
- The application only uses the exported model files (model.json, metadata.json, weights) in the my_model folder
- This folder is for reference and future retraining purposes

