"""
Flask Backend for Sphero BOLT Gesture Controller
Handles Bluetooth communication with Sphero BOLT robot
"""

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import logging
import os
import threading
from spherov2 import scanner
from spherov2.sphero_edu import SpheroEduAPI
from spherov2.types import Color

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the parent directory (project root) for serving static files
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__, static_folder=None)  # We'll handle static files manually
CORS(app)  # Enable CORS for frontend requests

# Global connection state
sphero_toy = None
sphero_api = None
is_connected = False
sphero_lock = threading.Lock()  # Thread lock for API access


def find_sphero_devices():
    """Scan for Sphero BOLT devices using spherov2"""
    logger.info("Scanning for Sphero BOLT devices...")
    try:
        toys = scanner.find_toys()
        sphero_devices = []
        for toy in toys:
            device_info = {
                "name": toy.name if hasattr(toy, 'name') else "Unknown",
                "address": str(toy) if hasattr(toy, '__str__') else "Unknown"
            }
            # Try to get MAC address if available
            if hasattr(toy, 'get_address'):
                try:
                    device_info["address"] = toy.get_address()
                except:
                    pass
            sphero_devices.append(device_info)
            logger.info(f"Found Sphero device: {device_info['name']} ({device_info['address']})")
        return sphero_devices
    except Exception as e:
        logger.error(f"Error scanning for devices: {e}")
        return []


def connect_to_sphero(address=None):
    """Connect to a Sphero BOLT device using spherov2"""
    global sphero_toy, sphero_api, is_connected
    
    try:
        with sphero_lock:
            logger.info("Connecting to Sphero BOLT...")
            
            # Find the toy - if address provided, try to find by address, otherwise find first available
            if address:
                logger.info(f"Looking for Sphero at address: {address}")
                toys = scanner.find_toys()
                toy = None
                for t in toys:
                    toy_address = str(t) if hasattr(t, '__str__') else ""
                    if hasattr(t, 'get_address'):
                        try:
                            toy_address = t.get_address()
                        except:
                            pass
                    if address.lower() in toy_address.lower() or address.lower() in str(t).lower():
                        toy = t
                        break
                if not toy:
                    raise Exception(f"Sphero device with address {address} not found")
            else:
                logger.info("Finding first available Sphero device...")
                toy = scanner.find_toy()
            
            if not toy:
                raise Exception("No Sphero device found")
            
            logger.info(f"Found Sphero device: {toy.name if hasattr(toy, 'name') else 'Unknown'}")
            
            # Create API connection
            api = SpheroEduAPI(toy)
            api.__enter__()  # Manually enter context manager
            
            sphero_toy = toy
            sphero_api = api
            is_connected = True
            
            logger.info("Successfully connected to Sphero BOLT")
            return True
        
    except Exception as e:
        logger.error(f"Connection error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        is_connected = False
        raise


def disconnect_from_sphero():
    """Disconnect from Sphero BOLT"""
    global sphero_toy, sphero_api, is_connected
    
    with sphero_lock:
        if sphero_api:
            try:
                sphero_api.__exit__(None, None, None)  # Manually exit context manager
                logger.info("Disconnected from Sphero BOLT")
            except Exception as e:
                logger.warning(f"Error during disconnect: {e}")
        
        sphero_toy = None
        sphero_api = None
        is_connected = False


# Flask Routes

@app.route('/api/scan', methods=['GET'])
def scan_devices():
    """Scan for available Sphero devices"""
    try:
        devices = find_sphero_devices()
        return jsonify({"success": True, "devices": devices})
    except Exception as e:
        logger.error(f"Scan error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/connect', methods=['POST'])
def connect():
    """Connect to a Sphero device"""
    global is_connected
    
    try:
        data = request.json
        address = data.get('address')
        
        if not address:
            return jsonify({"success": False, "error": "Address required"}), 400
        
        if is_connected:
            return jsonify({"success": False, "error": "Already connected"}), 400
        
        connect_to_sphero(address)
        
        # Send initialization commands
        try:
            logger.info("Sending initialization commands to Sphero...")
            import time
            
            with sphero_lock:
                if sphero_api:
                    # Set color to green
                    logger.info("Setting LED color to green...")
                    sphero_api.set_main_led(Color(r=0, g=255, b=0))
                    time.sleep(0.5)
                    
                    # Scroll "OK" text on LED matrix
                    logger.info("Scrolling 'OK' text on LED matrix...")
                    sphero_api.scroll_matrix_text("OK", Color(r=140, g=255, b=221), 15, True)
                    logger.info("Initialization commands completed")
        except Exception as cmd_error:
            logger.error(f"Initialization command failed: {cmd_error}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Don't fail connection if commands fail
        
        return jsonify({
            "success": True,
            "message": "Connected to Sphero BOLT",
            "address": address
        })
        
    except Exception as e:
        logger.error(f"Connect error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/disconnect', methods=['POST'])
def disconnect():
    """Disconnect from Sphero"""
    try:
        disconnect_from_sphero()
        return jsonify({"success": True, "message": "Disconnected"})
    except Exception as e:
        logger.error(f"Disconnect error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/status', methods=['GET'])
def status():
    """Get connection status"""
    global is_connected, sphero_toy
    return jsonify({
        "connected": is_connected,
        "name": sphero_toy.name if (is_connected and sphero_toy and hasattr(sphero_toy, 'name')) else None
    })


@app.route('/api/characteristics', methods=['GET'])
def get_characteristics():
    """Get connection info (spherov2 handles characteristics internally)"""
    global is_connected, sphero_toy
    return jsonify({
        "success": True,
        "connected": is_connected,
        "toy_name": sphero_toy.name if (is_connected and sphero_toy and hasattr(sphero_toy, 'name')) else None,
        "note": "spherov2 library handles characteristics internally"
    })


@app.route('/api/setColor', methods=['POST'])
def set_color():
    """Set Sphero LED color using spherov2"""
    try:
        data = request.json
        r = int(data.get('r', 0))
        g = int(data.get('g', 0))
        b = int(data.get('b', 0))
        
        # Clamp values to 0-255
        r = max(0, min(255, r))
        g = max(0, min(255, g))
        b = max(0, min(255, b))
        
        logger.info(f"setColor API called: RGB({r}, {g}, {b})")
        
        with sphero_lock:
            if not is_connected or not sphero_api:
                raise Exception("Not connected to Sphero")
            
            sphero_api.set_main_led(Color(r=r, g=g, b=b))
        
        logger.info(f"setColor command completed successfully")
        return jsonify({"success": True, "message": f"Color set to RGB({r}, {g}, {b})"})
        
    except Exception as e:
        logger.error(f"SetColor error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/drive', methods=['POST'])
def drive():
    """Drive Sphero using spherov2"""
    try:
        data = request.json
        speed = int(data.get('speed', 0))
        heading = int(data.get('heading', 0))
        
        # Clamp values - ensure heading is an integer
        speed = max(0, min(255, speed))
        heading = int(heading % 360)
        
        logger.info(f"drive API called: speed={speed}, heading={heading}° (type: {type(heading)})")
        
        with sphero_lock:
            if not is_connected or not sphero_api:
                raise Exception("Not connected to Sphero")
            
            # Convert speed from 0-255 to 0-1.0 for spherov2, then back to 0-255 for roll()
            # spherov2 roll() signature: roll(heading: int, speed: int, duration: float)
            # Note: roll() expects speed as int 0-255, not normalized float!
            speed_int = speed  # Keep as int 0-255
            heading_int = int(round(heading))
            
            # roll() parameter order: (heading, speed, duration)
            sphero_api.roll(heading_int, speed_int, duration=0.0)
        
        return jsonify({"success": True, "message": f"Driving: speed={speed}, heading={heading}°"})
        
    except Exception as e:
        logger.error(f"Drive error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/stop', methods=['POST'])
def stop():
    """Stop Sphero using spherov2"""
    try:
        logger.info("stop API called")
        
        with sphero_lock:
            if not is_connected or not sphero_api:
                raise Exception("Not connected to Sphero")
            
            # roll() parameter order: (heading, speed, duration)
            sphero_api.roll(0, 0, duration=0.0)  # Stop by setting speed to 0
        
        return jsonify({"success": True, "message": "Stopped"})
        
    except Exception as e:
        logger.error(f"Stop error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/turn', methods=['POST'])
def turn():
    """Turn Sphero to a specific heading (degrees) using spherov2"""
    try:
        data = request.json
        heading = int(data.get('heading', 0))
        speed = int(data.get('speed', 0))  # Optional: speed while turning (0 = just turn, no movement)
        
        # Clamp values - ensure heading is an integer
        heading = int(heading % 360)
        speed = max(0, min(255, speed))
        
        # Double-check heading is an integer (spherov2 requires int, not float)
        heading = int(heading)
        
        logger.info(f"turn API called: heading={heading}° (type: {type(heading).__name__}), speed={speed}")
        
        with sphero_lock:
            if not is_connected or not sphero_api:
                raise Exception("Not connected to Sphero")
            
            # spherov2 roll() signature: roll(heading: int, speed: int, duration: float)
            # Note: roll() expects speed as int 0-255, not normalized float!
            speed_int = speed  # Keep as int 0-255
            heading_int = int(round(float(heading)))
            
            logger.debug(f"Before roll: heading={heading_int} (type: {type(heading_int).__name__}), speed={speed_int} (type: {type(speed_int).__name__})")
            
            # roll() parameter order: (heading, speed, duration)
            sphero_api.roll(heading_int, speed_int, duration=0.0)
        
        return jsonify({"success": True, "message": f"Turned to heading: {heading}°"})
        
    except Exception as e:
        logger.error(f"Turn error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/setMatrixColor', methods=['POST'])
def set_matrix_color():
    """Fill the entire Sphero BOLT LED matrix with a solid color instantly"""
    try:
        data = request.json
        r = max(0, min(255, int(data.get('r', 0))))
        g = max(0, min(255, int(data.get('g', 0))))
        b = max(0, min(255, int(data.get('b', 0))))
        
        with sphero_lock:
            if not is_connected or not sphero_api:
                return jsonify({"success": False, "error": "Not connected"}), 400
            
            color_obj = Color(r=r, g=g, b=b)
            handled = False
            
            # Highest fidelity: set_main_led instantly fills BOLT matrix
            try:
                sphero_api.set_main_led(color_obj)
                handled = True
            except Exception:
                handled = False
            
            # If set_main_led isn't available, try matrix-specific helpers
            if not handled and hasattr(sphero_api, 'set_matrix'):
                matrix_frame = [color_obj] * 64
                sphero_api.set_matrix(matrix_frame)
                handled = True
            if not handled and hasattr(sphero_api, 'fill_matrix'):
                sphero_api.fill_matrix(color_obj)
                handled = True
            if not handled and hasattr(sphero_api, 'set_matrix_led'):
                sphero_api.set_matrix_led(color_obj)
                handled = True
            
            if not handled:
                return jsonify({"success": False, "error": "Matrix fill API not supported on this device"}), 501
        
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/scrollMatrixText', methods=['POST'])
def scroll_matrix_text():
    """Scroll text on Sphero LED matrix"""
    try:
        data = request.json
        text = data.get('text', '')
        color = data.get('color', {'r': 255, 'g': 255, 'b': 255})
        speed = int(data.get('speed', 15))
        loop_text = bool(data.get('loop', False))
        
        # Clamp values
        r = max(0, min(255, int(color.get('r', 255))))
        g = max(0, min(255, int(color.get('g', 255))))
        b = max(0, min(255, int(color.get('b', 255))))
        speed = max(0, min(255, speed))
        
        logger.info(f"scrollMatrixText API called: text='{text}', RGB({r}, {g}, {b}), speed={speed}, loop={loop_text}")
        
        with sphero_lock:
            if not is_connected or not sphero_api:
                raise Exception("Not connected to Sphero")
            
            sphero_api.scroll_matrix_text(text, Color(r=r, g=g, b=b), speed, loop_text)
        
        return jsonify({"success": True, "message": f"Scrolling text: '{text}'"})
        
    except Exception as e:
        logger.error(f"ScrollMatrixText error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "Sphero BOLT API"})


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


if __name__ == '__main__':
    print("=" * 60)
    print("Sphero BOLT Gesture Controller - Backend API")
    print("=" * 60)
    print("Starting Flask server on http://localhost:5000")
    print("Frontend will be available at: http://localhost:5000")
    print("Make sure your Sphero BOLT is powered on and nearby")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)

