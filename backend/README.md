# Backend API Server

Flask backend that handles model file uploads and serves static files.

## Installation

```bash
pip install -r requirements.txt
```

## Running the Server

```bash
python app.py
```

Or use the startup scripts from the `scripts/` folder:
- Windows: `scripts/start_backend.bat`
- Linux/Mac: `scripts/start_backend.sh`

The server will start on `http://localhost:5000`

## API Endpoints

### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "Model Upload API"
}
```

### `POST /api/uploadModel`
Upload a ZIP file containing model files (metadata.json, model.json, weights.bin).

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `zipfile`
- File: ZIP archive containing model files

**Response:**
```json
{
  "success": true,
  "message": "Model files uploaded successfully",
  "files": ["metadata.json", "model.json", "weights.bin"]
}
```

### `POST /api/clearModel`
Clear/delete uploaded model files.

**Response:**
```json
{
  "success": true,
  "message": "Model files cleared",
  "removedFiles": ["metadata.json", "model.json", "weights.bin"]
}
```

## Static File Serving

The backend serves:
- Frontend files from `frontend/` directory
- Model files from `models/` directory
- boltAPP library from `lib/boltAPP/` directory

## Architecture

- **Frontend**: Handles ML model loading, webcam, gesture detection, and Sphero control via Web Bluetooth
- **Backend**: Handles model file uploads and serves static files only
- **Sphero Connection**: Handled directly in the browser using Web Bluetooth API (no backend involvement)

