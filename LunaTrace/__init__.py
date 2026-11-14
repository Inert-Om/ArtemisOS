import spiceypy as spice
import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import rowcol
from pyproj import Transformer
import os

# Load and store the elevations file
path = os.path.dirname(os.path.realpath(__file__)) + '/'
dem_path = path + "ldem_87s_5mpp.tif"
with rasterio.open(dem_path) as src:
    elevation_grid = src.read(1)
    dem_transform = src.transform
    dem_crs = src.crs
    moon_geo_crs = dem_crs.geodetic_crs
transformer = Transformer.from_crs(moon_geo_crs, dem_crs, always_xy=True)


# Function to get cartesian coordinates, elevation row and column and elevation in mt
def getMoonState(lat, long):
    x_proj, y_proj = transformer.transform(long, lat)
    row, col = rowcol(dem_transform, x_proj, y_proj)

    patch = elevation_grid[max(0,row-1) : min(row+2, elevation_grid.shape[0]), max(0, col-1) : min(col+2, elevation_grid.shape[1])]
    gy, gx = np.gradient(patch)
    local_r, local_c = min(1, row), min(1, col)
    slope_deg = np.degrees(np.arctan(np.hypot(gy[local_r,local_c], gx[local_r,local_c])))

    elev_m = float(elevation_grid[row, col])
    r_km = 1737.4 + (elev_m / 1000.0)
    
    phi_rad = np.radians(lat)
    lamb_rad = np.radians(long)
    
    x = r_km * np.cos(phi_rad) * np.cos(lamb_rad)
    y = r_km * np.cos(phi_rad) * np.sin(lamb_rad)
    z = r_km * np.sin(phi_rad)
    
    return np.array([x, y, z]), np.array([row, col]), elev_m, slope_deg


# takes start, endtime and freq as input, processes time and calculates cartesian coordinates of sun and earth wrt to moon and returns the dataframe
def makeDF(starttime, endtime, freq="2h"):
    start = pd.Timestamp(starttime)
    end = pd.Timestamp(endtime)
    dates = pd.date_range(start=start, end=end, freq=freq)

    df = pd.DataFrame({
        "datetime_utc" : dates,
        "iso_utc_str" : dates.strftime("%Y-%m-%dT%H:%M:%SZ")
    })

    spice.furnsh(path + "naif0012.tls") # leapseconds kernel: converts utc to et
    spice.furnsh(path + "pck00010.tpc") # planetary constants kernel: stores radii, flattening coeff and gravity parameters of celestial bodies
    spice.furnsh(path + "moon_de440_200625.tf") # text frame kernel: defined frame names and relationships for moon
    spice.furnsh(path + "moon_pa_de440_200625.bpc") # Binary pointing/Constants kernel: contains time orientation of moon
    spice.furnsh(path + "de440.bsp") # Ephemeris kernel: contains trajectories of celestial objects

    df['et'] = spice.str2et(df['iso_utc_str'])
    Sstate, _ = spice.spkpos(
        targ="10",            # Target: Sun
        et=df['et'], 
        ref="MOON_ME_DE440_ME421",        # Frame: Moon Mean Earth
        abcorr="LT+S",        # Aberration correction
        obs="301"             # Observer: Moon
    )
    Estate, Elight_time = spice.spkpos(
        targ="399",            # Target: Earth
        et=df['et'], 
        ref="MOON_ME_DE440_ME421",        # Frame: Moon Mean Earth
        abcorr="LT+S",        # Aberration correction
        obs="301"             # Observer: Moon
    )
    df[["SX", "SY", "SZ"]] = np.array(Sstate)
    df[["EX", "EY", "EZ"]] = np.array(Estate)

    spice.kclear()
    return df


# Get angle between observer's normal vector and observer to celestial object vector to find out elevation angle wrt horizon
def findTheta(positionVector, vectors):
    dot_products = np.dot(vectors, positionVector)
    norms = np.linalg.norm(vectors, axis=1) * np.linalg.norm(positionVector)
    cosvalue = np.clip(dot_products/norms, -1.0, 1.0)
    theta = np.degrees(np.arccos(cosvalue))
    return theta


# Calculate vectors relative to position on moon
def calcRVect(lat, long, df):
    df1 = df.copy()
    pos_vector, _, _, _ = getMoonState(lat, long)
    X, Y, Z = pos_vector
    df1['PSX'] = df['SX'] - X
    df1['PSY'] = df['SY'] - Y
    df1['PSZ'] = df['SZ'] - Z

    df1['PEX'] = df['EX'] - X
    df1['PEY'] = df['EY'] - Y
    df1['PEZ'] = df['EZ'] - Z

    Svectors = df1[['PSX', 'PSY', 'PSZ']].to_numpy()
    Evectors = df1[['PEX', 'PEY', 'PEZ']].to_numpy()

    df1['STheta'] = 90 - findTheta(pos_vector, Svectors)
    df1['ETheta'] = 90 - findTheta(pos_vector, Evectors)
    return df1


# Calculate critical angle for each position of sun
def getCritAngle(phi, lamb, objXYZ, elevation_grid, dem_transform, step=5, maxdist=30000, R_moon=1737400.0):
    U, obsRC, obs_elev, _ = getMoonState(phi, lamb)
    U = U * 1000.0
    objXYZ = objXYZ * 1000.0  # shape: (N, 3)

    # Local ENU basis vectors
    u = U / np.linalg.norm(U)
    E = np.cross([0, 0, 1], u)
    e = E / np.linalg.norm(E)
    n = np.cross(u, e)

    # Vectorized projection for all N rows at once
    PS = objXYZ - U                # shape: (N, 3)
    dx = PS @ e                    # shape: (N,)
    dy = PS @ n                    # shape: (N,)

    # Compass azimuth from North (dx=East, dy=North) & map grid angle
    azimuth = np.arctan2(dx, dy)
    theta_map = np.deg2rad(90.0 - lamb) - azimuth  # shape: (N,)

    # Observer pixel to map coordinates
    obs_r, obs_c = obsRC
    X, Y = dem_transform * (obs_c, obs_r)

    # Create 2D grid of (N timestamps, M distances) via broadcasting
    distances = np.arange(step, maxdist, step)     # shape: (M,)
    
    # Use theta_map (or azimuth, depending on your DEM grid orientation)
    x = X + distances[None, :] * np.cos(theta_map[:, None])  # shape: (N, M)
    y = Y + distances[None, :] * np.sin(theta_map[:, None])  # shape: (N, M)

    # Convert map (x, y) to pixel (c, r)
    inv_transform = ~dem_transform
    c, r = inv_transform * (x, y)
    r = np.rint(r).astype(int)
    c = np.rint(c).astype(int)

    # Check bounds for both r and c
    H, W = elevation_grid.shape
    valid = (r >= 0) & (r < H) & (c >= 0) & (c < W)

    # Clip indices safely to sample, then mask out-of-bounds with -inf
    r_safe = np.clip(r, 0, H - 1)
    c_safe = np.clip(c, 0, W - 1)
    elev = elevation_grid[r_safe, c_safe]          # shape: (N, M)

    # Effective elevation accounting for lunar curvature
    eleveff = elev - (distances[None, :] ** 2) / (2.0 * R_moon)
    theta = np.degrees(np.arctan2(eleveff - obs_elev, distances[None, :]))

    # Ignore out-of-bounds pixels and take max along distance axis
    theta = np.where(valid, theta, -np.inf)
    maxTheta = np.maximum(np.max(theta, axis=1), 0.0)

    return maxTheta