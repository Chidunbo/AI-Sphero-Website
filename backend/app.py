"""
Flask Backend for AI Sphero Website
Handles model file uploads and serves static files
"""

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import logging
import os
import zipfile
import shutil
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the parent directory (project root) for serving static files
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__, static_folder=None)  # We'll handle static files manually
CORS(app)  # Enable CORS for frontend requests


# Flask Routes

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "Model Upload API"})


@app.route('/api/clearModel', methods=['POST'])
def clear_model():
    """Clear/delete uploaded model files"""
    try:
        model_dir = os.path.join(BASE_DIR, 'my_model')
        
        # List of files to remove
        files_to_remove = ['metadata.json', 'model.json', 'weights.bin']
        removed_files = []
        
        for filename in files_to_remove:
            file_path = os.path.join(model_dir, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                removed_files.append(filename)
        
        logger.info(f"Cleared model files: {removed_files}")
        
        return jsonify({
            "success": True,
            "message": "Model files cleared",
            "removedFiles": removed_files
        })
        
    except Exception as e:
        logger.error(f"Clear model error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/uploadModel', methods=['POST'])
def upload_model():
    """Upload ZIP file containing model files (metadata.json, model.json, weights.bin) and extract them"""
    temp_dir = None
    try:
        # Check if ZIP file is present
        if 'zipfile' not in request.files:
            return jsonify({
                "success": False,
                "error": "Missing ZIP file. Please upload a ZIP file containing metadata.json, model.json, and weights.bin"
            }), 400
        
        zip_file = request.files['zipfile']
        
        if zip_file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400
        
        # Validate it's a ZIP file
        if not zip_file.filename.lower().endswith('.zip'):
            return jsonify({
                "success": False,
                "error": "File must be a ZIP archive (.zip)"
            }), 400
        
        # Create temporary directory for extraction
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, 'model.zip')
        zip_file.save(zip_path)
        
        # Extract ZIP file
        extracted_files = {}
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # List all files in the ZIP
            file_list = zip_ref.namelist()
            
            # Extract all files to temp directory
            zip_ref.extractall(temp_dir)
            
            # Look for required files (case-insensitive)
            for file_name in file_list:
                file_name_lower = file_name.lower()
                # Handle files in subdirectories
                base_name = os.path.basename(file_name).lower()
                
                if base_name == 'metadata.json':
                    extracted_files['metadata'] = os.path.join(temp_dir, file_name)
                elif base_name == 'model.json':
                    extracted_files['model'] = os.path.join(temp_dir, file_name)
                elif base_name == 'weights.bin':
                    extracted_files['weights'] = os.path.join(temp_dir, file_name)
        
        # Validate all required files are present
        missing_files = []
        if 'metadata' not in extracted_files:
            missing_files.append('metadata.json')
        if 'model' not in extracted_files:
            missing_files.append('model.json')
        if 'weights' not in extracted_files:
            missing_files.append('weights.bin')
        
        if missing_files:
            # Clean up temp directory
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            return jsonify({
                "success": False,
                "error": f"ZIP file is missing required files: {', '.join(missing_files)}"
            }), 400
        
        # Define model directory
        model_dir = os.path.join(BASE_DIR, 'my_model')
        
        # Create directory if it doesn't exist
        os.makedirs(model_dir, exist_ok=True)
        
        # Copy extracted files to model directory (overwrite existing)
        metadata_path = os.path.join(model_dir, 'metadata.json')
        model_path = os.path.join(model_dir, 'model.json')
        weights_path = os.path.join(model_dir, 'weights.bin')
        
        shutil.copy2(extracted_files['metadata'], metadata_path)
        shutil.copy2(extracted_files['model'], model_path)
        shutil.copy2(extracted_files['weights'], weights_path)
        
        logger.info(f"Model files extracted and saved to {model_dir}")
        
        # Read metadata to get labels
        import json
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        labels = metadata.get('labels', [])
        
        # Clean up temp directory
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        
        return jsonify({
            "success": True,
            "message": "Model files uploaded and extracted successfully",
            "labels": labels,
            "modelName": metadata.get('modelName', 'Unknown'),
            "files": {
                "metadata.json": True,
                "model.json": True,
                "weights.bin": True
            }
        })
        
    except zipfile.BadZipFile:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        return jsonify({
            "success": False,
            "error": "Invalid ZIP file format"
        }), 400
    except Exception as e:
        logger.error(f"Upload error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        return jsonify({"success": False, "error": str(e)}), 500


# Frontend Routes - Serve static files
# Note: These routes must come AFTER API routes to avoid conflicts

@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_file(os.path.join(BASE_DIR, 'index.html'))


@app.route('/app.js')
def serve_app_js():
    """Serve the main JavaScript file"""
    return send_from_directory(BASE_DIR, 'app.js', mimetype='application/javascript')


@app.route('/gesture-config.js')
def serve_gesture_config():
    """Serve the gesture configuration file"""
    return send_from_directory(BASE_DIR, 'gesture-config.js', mimetype='application/javascript')


@app.route('/style.css')
def serve_style_css():
    """Serve the CSS file"""
    return send_from_directory(BASE_DIR, 'style.css', mimetype='text/css')


@app.route('/my_model/<path:filename>')
def serve_model_file(filename):
    """Serve model files from my_model directory"""
    return send_from_directory(os.path.join(BASE_DIR, 'my_model'), filename)


@app.route('/boltAPP/<path:filename>')
def serve_boltapp_file(filename):
    """Serve boltAPP library files"""
    boltapp_dir = os.path.join(BASE_DIR, 'boltAPP')
    # Determine MIME type based on file extension
    mimetype = 'application/javascript'
    if filename.endswith('.css'):
        mimetype = 'text/css'
    elif filename.endswith('.html'):
        mimetype = 'text/html'
    elif filename.endswith('.json'):
        mimetype = 'application/json'
    return send_from_directory(boltapp_dir, filename, mimetype=mimetype)


if __name__ == '__main__':
    print("=" * 60)
    print("AI Sphero Website - Backend API")
    print("=" * 60)
    print("Starting Flask server on http://localhost:5000")
    print("Frontend will be available at: http://localhost:5000")
    print("Backend handles model file uploads only")
    print("Sphero connection is handled via Web Bluetooth in the browser")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)

