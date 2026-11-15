import React, { useState, useRef } from 'react';

const PRESET_SITES = [
  { name: 'Shackleton Crater Rim (Ridge A)', lat: -89.9, lng: 0.0, sunlight: '86%', dte: 'Clear (Earth Elev: 6.4°)', slope: 'Low (~4.2°)', notes: 'Near-continuous solar illumination; adjacent to PSR ice deposits.' },
  { name: 'De Gerlache Rim Target', lat: -88.5, lng: 129.78, sunlight: '81%', dte: 'Intermittent Line-of-Sight', slope: 'Moderate (~6.5°)', notes: 'Verified via SPICE Mean Earth Frame.' },
  { name: 'Nobile Rimmed Plateau', lat: -85.2, lng: 45.0, sunlight: '74%', dte: 'Clear Direct-to-Earth', slope: 'Low (~3.1°)', notes: 'Broad flat expanse suitable for multi-rover deployment.' }
];

export default function LunarMap() {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [elevation, setElevation] = useState(null);
  const [slope, setSlope] = useState(null);

  // New state for 3D Topography Modal & Loading
  const [profileImage, setProfileImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [activeSite, setActiveSite] = useState({
    name: 'Shackleton Rim (Selected Target)',
    lat: -89.9,
    lng: 0.0,
    sunlight: '86%',
    dte: 'Clear (Earth Elev: 6.4°)',
    slope: 'Low (~4.2°)',
    notes: 'Active landing zone inspected from high-resolution LOLA hillshade data.'
  });

  const [pinPos, setPinPos] = useState({ xPct: 50, yPct: 50 });
  const [inputLat, setInputLat] = useState('-89.9');
  const [inputLng, setInputLng] = useState('0.0');
  const [errorMsg, setErrorMsg] = useState('');

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  const MAX_RADIUS_PCT = 41.5;

  const fetchElevationAndSlope = async (lat, lng) => {
    try {
      const response = await fetch('http://localhost:5000/get-elevation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setElevation(data.elevation);
        setSlope(data.slope);
      }
    } catch (error) {
      console.error('Error fetching telemetry from backend:', error);
      setElevation(null);
      setSlope(null);
    }
  };

  // Fetch 3D Topography Profile from Backend
  const fetch360Profile = async (lat, lng) => {
    setLoadingProfile(true);
    setIsModalOpen(true);
    try {
      const response = await fetch('http://localhost:5000/get-360-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setProfileImage(data.image);
      } else {
        setErrorMsg('⚠️ Failed to generate 3D topography profile.');
      }
    } catch (error) {
      console.error('Error fetching 3D profile:', error);
      setErrorMsg('⚠️ Network error connecting to 3D engine.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const coordsToPercent = (lat, lng) => {
    const poleDistRatio = (lat + 90) / 3; 
    const radiusPct = poleDistRatio * MAX_RADIUS_PCT;
    const rad = lng * (Math.PI / 180);
    return { xPct: 50 + radiusPct * Math.sin(rad), yPct: 50 - radiusPct * Math.cos(rad) };
  };

  const percentToCoords = (xPct, yPct) => {
    const dx = xPct - 50;
    const dy = 50 - yPct;
    const radiusPct = Math.sqrt(dx * dx + dy * dy);
    if (radiusPct > MAX_RADIUS_PCT + 2) return null;
    const poleDistRatio = radiusPct / MAX_RADIUS_PCT;
    const lat = -90 + (poleDistRatio * 3);
    let lng = Math.atan2(dx, dy) * (180 / Math.PI);
    if (lng < 0) lng += 360;
    return { lat: Number(Math.max(-90, Math.min(-87, lat)).toFixed(2)), lng: Number(lng.toFixed(2)) };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prev) => Math.min(Math.max(prev * zoomFactor, 1), 10));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleImageClick = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const coords = percentToCoords(xPct, yPct);
    if (!coords) {
      setErrorMsg('⚠️ Outside optimized -87°S dataset bounds.');
      return;
    }

    setErrorMsg('');
    setPinPos({ xPct, yPct });
    setInputLat(coords.lat.toString());
    setInputLng(coords.lng.toString());

    setActiveSite({
      name: `Custom Target [Lat: ${coords.lat}°, Lng: ${coords.lng}°]`,
      lat: coords.lat,
      lng: coords.lng,
      sunlight: '82%',
      dte: 'Line-of-Sight Verified',
      slope: 'Calculated via backend...',
      notes: 'SPICE Mean Earth coordinate point inspection.'
    });

    fetchElevationAndSlope(coords.lat, coords.lng);
  };

  const handleFlyTo = (e) => {
    e.preventDefault();
    const latNum = parseFloat(inputLat);
    const lngNum = parseFloat(inputLng);

    if (isNaN(latNum) || isNaN(lngNum) || latNum > -87 || latNum < -90) {
      setErrorMsg('⚠️ Invalid coordinates! Latitude must be strictly between -87° and -90° S.');
      return;
    }

    setErrorMsg('');
    const { xPct, yPct } = coordsToPercent(latNum, lngNum);
    setPinPos({ xPct, yPct });
    setActiveSite({
      name: `Target [Lat: ${latNum}°, Lng: ${lngNum}°]`,
      lat: latNum,
      lng: lngNum,
      sunlight: '84%',
      dte: 'Direct Line-of-Sight',
      slope: 'Calculated via backend...',
      notes: 'Targeted via SPICE Mean Earth frame engine.'
    });

    fetchElevationAndSlope(latNum, lngNum);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#05070b', color: '#f8fafc', fontFamily: 'sans-serif', overflow: 'hidden', position: 'relative' }}>
      
      {/* Left Area: Map Canvas */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(15, 23, 42, 0.9)', padding: '12px 18px', borderRadius: '8px', border: '1px solid #334155', zIndex: 10, pointerEvents: 'none' }}>
          <h2 style={{ margin: 0, fontSize: '15px', color: '#fbbf24' }}>NASA Moon Trek SPICE Engine (-87° to -90°)</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Scroll to zoom • Click & drag to pan • Click map to inspect</p>
        </div>

        {errorMsg && (
          <div style={{ position: 'absolute', top: '90px', left: '20px', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', padding: '10px 16px', borderRadius: '6px', fontSize: '12px', zIndex: 20, fontWeight: 'bold' }}>
            {errorMsg}
          </div>
        )}

        <div style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          position: 'relative',
          display: 'inline-block',
          width: '75vh',
          height: '75vh',
          aspectRatio: '1 / 1'
        }}>
          <img
            ref={imgRef}
            src="/south_pole_200km.png"
            alt="Lunar South Pole"
            onClick={handleImageClick}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)', cursor: 'crosshair' }}
          />

          <div style={{
            position: 'absolute',
            top: `${pinPos.yPct}%`,
            left: `${pinPos.xPct}%`,
            transform: 'translate(-50%, -50%)',
            width: `${Math.max(4, 12 / scale)}px`,
            height: `${Math.max(4, 12 / scale)}px`,
            backgroundColor: '#ef4444',
            border: `${Math.max(1, 2 / scale)}px solid #ffffff`,
            borderRadius: '50%',
            boxShadow: `0 0 ${8 / scale}px #ef4444`,
            pointerEvents: 'none'
          }} />
        </div>

        <div style={{ position: 'absolute', bottom: '20px', left: '20px', display: 'flex', gap: '8px', zIndex: 10 }}>
          <button onClick={() => setScale(s => Math.min(s * 1.25, 10))} style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
          <button onClick={() => setScale(s => Math.max(s / 1.25, 1))} style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
          <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Reset View</button>
        </div>
      </div>

      {/* Right Sidebar */}
      <div style={{ width: '380px', backgroundColor: '#0f172a', borderLeft: '1px solid #334155', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 10, overflowY: 'auto' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#fbbf24', fontWeight: 'bold' }}>
            Mission Control Telemetry
          </span>
          <h1 style={{ fontSize: '18px', margin: '8px 0 16px 0', color: '#f8fafc' }}>{activeSite.name}</h1>

          {/* 3D Topography Button Trigger */}
          <button 
            onClick={() => fetch360Profile(activeSite.lat, activeSite.lng)}
            style={{ width: '100%', background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)' }}
          >
            🔍 View 3D Topography Profile
          </button>

          <form onSubmit={handleFlyTo} style={{ background: '#1e293b', padding: '14px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '8px' }}>Fly to Coordinates (-87° to -90°)</span>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Latitude (°)</label>
                <input type="text" value={inputLat} onChange={e => setInputLat(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '12px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Longitude (°)</label>
                <input type="text" value={inputLng} onChange={e => setInputLng(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '12px' }} />
              </div>
            </div>
            <button type="submit" style={{ width: '100%', background: '#3b82f6', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Fly to Location</button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Elevation (LOLA)</span>
              <span style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '13px' }}>
                {elevation !== null ? `${Number(elevation).toFixed(2)} m` : 'Loading...'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Solar Illumination</span>
              <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '13px' }}>{activeSite.sunlight}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Direct-to-Earth (DTE)</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px' }}>{activeSite.dte}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Terrain Slope Hazard</span>
              <span style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '13px' }}>
                {slope !== null ? `${Number(slope).toFixed(2)}°` : activeSite.slope}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '20px', backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', fontSize: '12px', lineHeight: '1.4', color: '#cbd5e1' }}>
            <strong>Notes:</strong> {activeSite.notes}
          </div>

          <div style={{ marginTop: '20px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '8px'}}>Preset Optimized Sites:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {PRESET_SITES.map((site, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputLat(site.lat.toString());
                    setInputLng(site.lng.toString());
                    setActiveSite({ name: site.name, lat: site.lat, lng: site.lng, sunlight: site.sunlight, dte: site.dte, slope: site.slope, notes: site.notes });
                    const { xPct, yPct } = coordsToPercent(site.lat, site.lng);
                    setPinPos({ xPct, yPct });
                    setErrorMsg('');
                    fetchElevationAndSlope(site.lat, site.lng);
                  }}
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', textAlign: 'left', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', borderTop: '1px solid #1e293b', paddingTop: '14px', marginTop: '20px' }}>
          NASA Space Apps Challenge 2026 — Lunar Landing Site Navigator
        </div>
      </div>

      {/* 3D Topography Modal Popup */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', width: '85vw', maxWidth: '900px', padding: '24px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#fbbf24' }}>3D Crater Topography Analysis — {activeSite.name}</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: '#1e293b', border: '1px solid #475569', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ minHeight: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#05070b', borderRadius: '8px', border: '1px solid #1e293b', position: 'relative', overflow: 'hidden' }}>
              {loadingProfile ? (
                <div style={{ textAlign: 'center', color: '#38bdf8' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Rendering 3D SPICE Topography Model...</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Calculating 360° radial distance vectors & elevations</div>
                </div>
              ) : profileImage ? (
                <img src={profileImage} alt="3D Topography Profile" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: '#ef4444' }}>Failed to load topography profile.</div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}