# ArtemisOS: LunaTrek Engine

**ArtemisOS** is an interactive Lunar South Pole navigation, telemetry, and landing site analysis platform built for the **NASA Space Apps Challenge 2026**. Powered by the **LunaTrek Engine**, it combines high-resolution Lunar Orbiter Laser Altimeter (LOLA) Digital Elevation Models (DEM) with NASA SPICE ephemeris kernels to identify optimal landing windows, terrain hazards, and illumination profiles across the lunar south pole ($-87^\circ\text{S}$ to $-90^\circ\text{S}$).
Download unified or non unified .exe file from (releases)[https://github.com/Inert-Om/ArtemisOS/releases/latest]
---

## Key Features

* **Interactive Lunar South Pole Map**: High-resolution south polar stereographic projection map supporting smooth zoom, pan, click-to-inspect telemetry, and direct coordinate targeting ($-87^\circ\text{S}$ to $-90^\circ\text{S}$).
* **Real-Time Telemetry & Hazard Assessment**:
  * **Elevation (LOLA)**: Exact surface elevation in meters derived from high-resolution `.tif` DEM grids.
  * **Terrain Slope Hazard**: Local surface inclination angle in degrees to evaluate lander touchdown safety.
  * **Solar Illumination**: Percentage of continuous sunlight across a user-defined mission timeline.
  * **Water Ice Possibility**: Automated indicator predicting potential water-ice stability in permanently shadowed regions (PSRs).
* **Optimal Landing Windows Engine**: Analyzes temporal line-of-sight vectors for both the Sun and Earth against local crater rim horizon masks (`SCritTheta` and `ECritTheta`), ranking optimal mission landing windows by duration and Direct-to-Earth (DTE) communication availability.
* **2.5D Isometric Topography Profiles**: Generates on-demand 2.5D surface plots of local crater topography surrounding any selected observer point.
* **Temporal Ephemeris Visualization**:
  * **Elevation vs. Azimuth**: Tracks solar and terrestrial elevation and azimuth angles relative to the lunar surface over custom date ranges.
  * **Elevation vs. Critical Angle**: Compares celestial elevation against local terrain horizon masking angles to pinpoint exact sunrise, sunset, and Earth-visibility transitions.
* **Preset Mission Targets**: Quick-jump navigation to key preset sites including Shackleton Crater (Ridge & Center), de Gerlache, Shoemaker, Faustini, Chandrayaan-1 MIP (2008), and Lunar Prospector (1998).

---

## User Interface
<img width="1280" height="720" alt="Slide4" src="https://github.com/user-attachments/assets/9873f1ad-d73f-4dad-81f1-95000cc94214" />
<img width="1280" height="720" alt="Slide5" src="https://github.com/user-attachments/assets/2d37b9a3-6bb6-4d2b-aa40-7e876fbc5031" />

---

## Tech Stack

* **Frontend**: React, Vite, HTML5/CSS3
* **Backend**: Python, Flask, Matplotlib
* **Astrodynamics & Geospatial Engine (`LunaTrek`)**: `spiceypy` (NASA SPICE Toolkit), `rasterio`, `pyproj`, `numpy`, `pandas`
* **Packaging**: PyInstaller (Single-file standalone Windows `.exe`)

---

## Repository Structure

```text
ArtemisOS/
├── app.py                  # Main Flask application entry point
├── ArtemisOS.spec          # PyInstaller build specification
├── frontend/               # React + Vite web application
│   ├── src/
│   │   ├── LunarMap.jsx    # Interactive map, telemetry sidebar, and modals
│   │   └── LunarMap.css    # Custom UI styling
│   └── dist/               # Production frontend build assets
├── lunar_backend/          # Flask API blueprints and visualization routes
│   ├── __init__.py
│   └── routes.py           # Endpoints for elevation, profiles, and landing windows
└── LunaTrek/               # Core astrodynamics & DEM processing library
    ├── __init__.py         # SPICE calculations, horizon masking, and window scoring
    ├── ldem_87s_5mpp.tif   # LOLA 5m/pixel South Pole DEM dataset
    ├── de440.bsp           # Planetary ephemeris SPICE kernel
    ├── naif0012.tls        # Leapseconds SPICE kernel
    └── pck00010.tpc        # Planetary constants SPICE kernel
```

---

## Installation & Local Development

### 1. Prerequisites
* **Python 3.12+** (Conda or virtual environment recommended)
* **Node.js 18+** and `npm`

### 2. Backend Setup
1. Clone the repository and navigate to the project root:
   ```bash
   git clone <repository-url>
   cd ArtemisOS
   ```
2. Activate your Python environment and install the required packages:
   ```bash
   pip install flask flask-cors numpy pandas matplotlib rasterio pyproj spiceypy
   ```
3. Start the Flask development server:
   ```bash
   flask --app lunar_backend run --debug
   ```
   The backend API will run on `http://localhost:5000`.

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser to launch ArtemisOS.

---

## Building the Standalone Executable (Windows)

ArtemisOS can be compiled into a single, self-contained `.exe` file that bundles the React frontend, Flask server, LOLA DEM grids, and SPICE kernels.

1. **Build the Frontend Production Assets**:
   ```powershell
   cd frontend
   npm run build
   cd ..
   ```

2. **Compile with PyInstaller**:
   ```powershell
   python -m PyInstaller --noconfirm --onefile --console `
     --name "ArtemisOS" `
     --add-data "frontend/dist;frontend/dist" `
     --add-data "LunaTrek;LunaTrek" `
     --collect-all rasterio `
     --collect-all pyproj `
     --collect-all spiceypy `
     app.py
   ```

3. **Run the Application**:
   Locate `ArtemisOS.exe` inside the `dist/` folder. It is completely standalone and can be run anywhere on Windows without external dependencies.

---

## Acknowledgments
* **NASA Lunar Reconnaissance Orbiter (LRO) / LOLA Team and PGDA, Goddard Spaceflight Center (GSFC)** for South Pole Digital Elevation Model datasets.
* **NASA Navigation and Ancillary Information Facility (NAIF), Jet Propulsion Laboratory (JPL)** for the SPICE ephemeris toolkit and kernels.
* Built for the **NASA Space Apps Challenge 2026**.

---

<p align="center">
<b>TEAM GYPSY DANGER</b><br>
<i>Devashrit Sarangi // Om Sai Mohapatra // Swastik Shuvam Behera</i>
</p>
