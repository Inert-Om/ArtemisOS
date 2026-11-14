from flask import Blueprint, request, jsonify
from LunaTrace import getMoonState

bp = Blueprint('routes', __name__)

@bp.route('/get-elevation', methods=['POST'])
def get_elevation():
    # Get latitude and longitude from the frontend request (JSON payload)
    data = request.get_json()
    lat = float(data.get('latitude'))
    long = float(data.get('longitude'))
    
    # Unpack the tuple, assigning np.array([x,y,z]) and np.array([row,col]) to underscore variables
    _, _, elev_m, slop_deg = getMoonState(lat, long)
    
    # Store elev_m in another variable to be used for display
    elevation = float(elev_m)
    slop=float(slop_deg)
    
    # Return the elevation parameter to the frontend
    return jsonify({
        'status': 'success',
        'latitude': lat,
        'longitude': long,
        'elevation': elevation,
        'slope':slop
    })