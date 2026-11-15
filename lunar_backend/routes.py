from flask import Blueprint, request, jsonify
import io
import base64
from LunaTrek import getMoonState
from LunaTrek import get360profile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import traceback
bp = Blueprint('routes', __name__)

@bp.route('/get-elevation', methods=['POST'])
def get_elevation():
    # Get latitude and longitude from the frontend request (JSON payload)
  try:
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
  except Exception as e:
    # Log the error for debugging purposes
    traceback.print_exc()
    return jsonify({
        'status': 'error',
        'message': str(e)
    }), 500

@bp.route('/get-360-profile', methods=['POST'])
def get_360_profile():
    try:
        data = request.get_json()
        phi = float(data.get('latitude'))
        lamb = float(data.get('longitude'))
        
        # 1. Call get360profile from engine
        X_east, Y_north, eleveff = get360profile(phi, lamb)
        
        # 2. Match the exact styling from your test notebook
        fig = plt.figure(figsize=(12, 9), facecolor='#0f172a')
        ax = fig.add_subplot(111, projection='3d')
        ax.set_facecolor('#0f172a')
        
        surf = ax.plot_surface(
            X_east,
            Y_north,
            eleveff,
            cmap='gist_earth',      # High-contrast terrain colormap for crater rims/floors
            edgecolor='none',
            antialiased=True,
            rcount=180,             # Smooth angular resolution
            ccount=300              # Smooth radial resolution
        )
        
        # Mark the observer's exact position at the center (0, 0)
        _, _, obs_elev, _ = getMoonState(phi, lamb)
        ax.scatter([0], [0], [obs_elev], color='red', s=60, label='Observer Point', zorder=10)
        
        # 4. Widen the base visually and tilt camera to look INTO the craters
        ax.set_box_aspect((1, 1, 0.35))  # Streses X and Y relative to Z (flattens steep walls)
        ax.view_init(elev=55, azim=-45)  # Higher 'elev' (50-70 deg) looks down into crater bowls
        
        ax.set_title(f"Local Crater Topography [Lat: {phi}°, Lng: {lamb}°]", fontsize=13, color='#f8fafc', pad=15)
        ax.set_xlabel("East Distance (m)", color='#94a3b8', labelpad=8)
        ax.set_ylabel("North Distance (m)", color='#94a3b8', labelpad=8)
        ax.set_zlabel("Effective Elevation (m)", color='#94a3b8', labelpad=8)
        
        # Tick colors and legend styling for dark theme
        ax.tick_params(colors='#94a3b8', labelsize=8)
        
        # Customize legend background and text to match dark UI
        leg = ax.legend(facecolor='#1e293b', edgecolor='#334155', labelcolor='#f8fafc')
        
        cbar = fig.colorbar(surf, ax=ax, shrink=0.5, aspect=12, label="Elevation (m)")
        cbar.set_label("Elevation (m)", color='#f8fafc')
        cbar.ax.yaxis.set_tick_params(color='#94a3b8')
        plt.setp(cbar.ax.yaxis.get_ticklabels(), color='#94a3b8')

        plt.tight_layout()
        
        # 3. Save to memory buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=130, bbox_inches='tight', facecolor=fig.get_facecolor(), edgecolor='none')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        
        plt.close(fig)  # Clean up memory
        
        return jsonify({
            "status": "success",
            "image": f"data:image/png;base64,{img_base64}"
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500
