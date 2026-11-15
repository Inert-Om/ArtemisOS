from flask import Blueprint, request, jsonify
import io
import base64
from LunaTrek import *
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import traceback

bp = Blueprint('routes', __name__)
df = pd.DataFrame()

@bp.route('/get-elevation', methods=['POST'])
def get_elevation():
  
  try:
    data = request.get_json()
    lat = float(data.get('latitude'))
    long = float(data.get('longitude'))
    starttime = data.get('starttime') or data.get('startTime') or '2026-11-11T12:00:00Z'
    endtime = data.get('endtime') or data.get('endTime') or '2027-11-11T12:00:00Z'
    
    _, _, elev_m, slop_deg = getMoonState(lat, long)
    
    elevation = float(elev_m)
    slop = float(slop_deg)
    df_time = makeDF(starttime, endtime, freq="2h")
    df_time = calcRVect(lat, long, df_time)
    Spts = df_time[['SX', 'SY', 'SZ']].to_numpy()
    Epts = df_time[['EX', 'EY', 'EZ']].to_numpy()
    
    df_time['SCritTheta'], df_time['SAzimuthal'] = getCritAzimuthalAngle(lat, long, Spts, elevation_grid, dem_transform)
    df_time['ECritTheta'], df_time['EAzimuthal'] = getCritAzimuthalAngle(lat, long, Epts, elevation_grid, dem_transform)
    
    windows_df, sunlight_ratio = findOptimalDatesNShadowPercent(df_time)
    solar_illumination = round(sunlight_ratio * 100.0, 2)
    landing_windows = windows_df.to_dict(orient='records') if not windows_df.empty else []
    
    return jsonify({
        'status': 'success',
        'latitude': lat,
        'longitude': long,
        'elevation': elevation,
        'slope': slop,
        'solar_illumination': solar_illumination,
        'landing_windows': landing_windows
    })
  except Exception as e:
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
        
        X_east, Y_north, eleveff = get360profile(phi, lamb)
        
        fig = plt.figure(figsize=(12, 9), facecolor='#0f172a')
        ax = fig.add_subplot(111, projection='3d')
        ax.set_facecolor('#0f172a')
        
        surf = ax.plot_surface(
            X_east,
            Y_north,
            eleveff,
            cmap='gist_earth',
            edgecolor='none',
            antialiased=True,
            rcount=180,
            ccount=300
        )
        
        _, _, obs_elev, _ = getMoonState(phi, lamb)
        ax.scatter([0], [0], [obs_elev], color='red', s=60, label='Observer Point', zorder=10)
        
        ax.set_box_aspect((1, 1, 0.35))
        ax.view_init(elev=55, azim=-45)
        
        ax.set_title(f"Local Crater Topography [Lat: {phi}°, Lng: {lamb}°]", fontsize=13, color='#f8fafc', pad=15)
        ax.set_xlabel("East Distance (m)", color='#94a3b8', labelpad=8)
        ax.set_ylabel("North Distance (m)", color='#94a3b8', labelpad=8)
        ax.set_zlabel("Effective Elevation (m)", color='#94a3b8', labelpad=8)
        
        ax.tick_params(colors='#94a3b8', labelsize=8)
        ax.legend(facecolor='#1e293b', edgecolor='#334155', labelcolor='#f8fafc')
        
        cbar = fig.colorbar(surf, ax=ax, shrink=0.5, aspect=12, label="Elevation (m)")
        cbar.set_label("Elevation (m)", color='#f8fafc')
        cbar.ax.yaxis.set_tick_params(color='#94a3b8')
        plt.setp(cbar.ax.yaxis.get_ticklabels(), color='#94a3b8')

        plt.tight_layout()
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=130, bbox_inches='tight', facecolor=fig.get_facecolor(), edgecolor='none')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        
        return jsonify({
            "status": "success",
            "image": f"data:image/png;base64,{img_base64}"
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route('/get-time-profile', methods=['POST'])
def get_time_profile():
   
    try:
        data = request.get_json()
        phi = float(data.get('latitude'))
        lamb = float(data.get('longitude'))
        starttime = data.get('starttime', '2026-11-11T12:00:00Z')
        endtime = data.get('endtime', '2027-11-11T12:00:00Z')
        
        df = makeDF(starttime, endtime, freq="2h")
        df=calcRVect(phi, lamb, df)
        Spts = df[['SX', 'SY', 'SZ']].to_numpy()
        Epts = df[['EX', 'EY', 'EZ']].to_numpy()
        
        # Unpack both return values correctly: maxTheta (elevation) and azimuth
        df['SCritTheta'], df['SAzimuthal'] = getCritAzimuthalAngle(phi, lamb, Spts, elevation_grid, dem_transform)
        df['ECritTheta'], df['EAzimuthal'] = getCritAzimuthalAngle(phi, lamb, Epts, elevation_grid, dem_transform)
        
        fig, axs = plt.subplots(2, 1, figsize=(14, 8), facecolor='#0f172a')
        
        # Subplot 0: Sun Elevation & Azimuth matching notebook
        axs[0].set_facecolor('#0f172a')
        axs[0].plot(df['datetime_utc'], df['STheta'], color='orange', label='Sun Elevation')
        axs[0].plot(df['datetime_utc'], df['SAzimuthal'] % 360, color='red', linestyle='-', label='Sun Azimuth % 360')
        axs[0].set_title(f"Elevation & Azimuth of Sun wrt moon surface — Lat: {phi}°, Lng: {lamb}°", color='#f8fafc', fontsize=11)
        axs[0].tick_params(colors='#94a3b8', labelsize=8)
        axs[0].legend(facecolor='#1e293b', edgecolor='#334155', labelcolor='#f8fafc', fontsize=9)
        axs[0].grid(True, color='#1e293b', alpha=0.5)
        
        # Subplot 1: Earth Elevation & Azimuth matching notebook
        axs[1].set_facecolor('#0f172a')
        axs[1].plot(df['datetime_utc'], df['ETheta'], color='blue', label='Earth Elevation')
        axs[1].plot(df['datetime_utc'], df['EAzimuthal'] % 360, color='red', linestyle='-', label='Earth Azimuth % 360')
        axs[1].set_title(f"Elevation & Azimuth of Earth wrt moon surface — Lat: {phi}°, Lng: {lamb}°", color='#f8fafc', fontsize=11)
        axs[1].tick_params(colors='#94a3b8', labelsize=8)
        axs[1].legend(facecolor='#1e293b', edgecolor='#334155', labelcolor='#f8fafc', fontsize=9)
        axs[1].grid(True, color='#1e293b', alpha=0.5)

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=130, bbox_inches='tight', facecolor=fig.get_facecolor(), edgecolor='none')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        
        return jsonify({"status": "success", "image": f"data:image/png;base64,{img_base64}"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route('/get-crit-profile', methods=['POST'])
def get_crit_profile():
   
    try:
        data = request.get_json()
        phi = float(data.get('latitude'))
        lamb = float(data.get('longitude'))
        starttime = data.get('starttime', '2026-11-11T12:00:00Z')
        endtime = data.get('endtime', '2027-11-11T12:00:00Z')
        
        df = makeDF(starttime, endtime, freq="2h")
        df=calcRVect(phi, lamb, df)
     
        Spts = df[['SX', 'SY', 'SZ']].to_numpy()
        Epts = df[['EX', 'EY', 'EZ']].to_numpy()
        
        # Matching your notebook's critical angle extraction pattern
        df['SCritTheta'], df['SAzimuthal'] = getCritAzimuthalAngle(phi, lamb, Spts, elevation_grid, dem_transform)
        df['ECritTheta'], df['EAzimuthal'] = getCritAzimuthalAngle(phi, lamb, Epts, elevation_grid, dem_transform)
        
        fig, axs = plt.subplots(2, 1, figsize=(14, 8), facecolor='#0f172a')
        
        # Subplot 0: Sun Critical Angle vs Elevation matching notebook snippet 2
        axs[0].set_facecolor('#0f172a')
        axs[0].plot(df['datetime_utc'], df['STheta'], color='orange', label='Sun Elevation')
        axs[0].plot(df['datetime_utc'], df['SCritTheta'], color='red', linestyle='--', label='Sun Critical Theta (SCritTheta)')
        axs[0].set_title(f"Elevation of Sun wrt moon surface & Critical Angle — Lat: {phi}°, Lng: {lamb}°", color='#f8fafc', fontsize=11)
        axs[0].tick_params(colors='#94a3b8', labelsize=8)
        axs[0].legend(facecolor='#1e293b', edgecolor='#334155', labelcolor='#f8fafc', fontsize=9)
        axs[0].grid(True, color='#1e293b', alpha=0.5)
        
        # Subplot 1: Earth Critical Angle vs Elevation matching notebook snippet 2
        axs[1].set_facecolor('#0f172a')
        axs[1].plot(df['datetime_utc'], df['ETheta'], color='blue', label='Earth Elevation')
        axs[1].plot(df['datetime_utc'], df['ECritTheta'], color='red', linestyle='--', label='Earth Critical Theta (ECritTheta)')
        axs[1].set_title(f"Elevation of Earth wrt moon surface & Critical Angle — Lat: {phi}°, Lng: {lamb}°", color='#f8fafc', fontsize=11)
        axs[1].tick_params(colors='#94a3b8', labelsize=8)
        axs[1].legend(facecolor='#1e293b', edgecolor='#334155', labelcolor='#f8fafc', fontsize=9)
        axs[1].grid(True, color='#1e293b', alpha=0.5)

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=130, bbox_inches='tight', facecolor=fig.get_facecolor(), edgecolor='none')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        
        return jsonify({"status": "success", "image": f"data:image/png;base64,{img_base64}"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

