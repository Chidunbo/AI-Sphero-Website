# Backend API Server

Flask backend that handles Bluetooth communication with Sphero BOLT robots.

## Installation

```bash
pip install -r requirements.txt
```

**Windows users**: If you encounter issues with `bleak`, try:
```bash
pip install bleak[winrt]
```

## Running the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "Sphero BOLT API"
}
```

### `GET /api/scan`
Scan for available Sphero BOLT devices.

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "name": "SB-XXXX",
      "address": "XX:XX:XX:XX:XX:XX"
    }
  ]
}
```

### `POST /api/connect`
Connect to a Sphero BOLT device.

**Request Body:**
```json
{
  "address": "XX:XX:XX:XX:XX:XX"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connected to Sphero BOLT",
  "address": "XX:XX:XX:XX:XX:XX"
}
```

### `GET /api/status`
Get current connection status.

**Response:**
```json
{
  "connected": true,
  "address": "XX:XX:XX:XX:XX:XX"
}
```

### `POST /api/disconnect`
Disconnect from Sphero.

**Response:**
```json
{
  "success": true,
  "message": "Disconnected"
}
```

### `POST /api/setColor`
Set Sphero LED color.

**Request Body:**
```json
{
  "r": 255,
  "g": 0,
  "b": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Color set to RGB(255, 0, 0)"
}
```

### `POST /api/drive`
Drive Sphero.

**Request Body:**
```json
{
  "speed": 100,
  "heading": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Driving: speed=100, heading=0°"
}
```

### `POST /api/stop`
Stop Sphero.

**Response:**
```json
{
  "success": true,
  "message": "Stopped"
}
```

### `POST /api/scrollMatrixText`
Scroll text on Sphero LED matrix.

**Request Body:**
```json
{
  "text": "Hello",
  "color": {
    "r": 255,
    "g": 255,
    "b": 255
  },
  "speed": 15,
  "loop": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scrolling text: 'Hello'"
}
```

## Troubleshooting

- **Bluetooth permission errors**: Make sure your OS allows Python to access Bluetooth
- **Device not found**: Ensure Sphero is powered on and nearby
- **Connection timeout**: Try restarting the Sphero and scanning again


