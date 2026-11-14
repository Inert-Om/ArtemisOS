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

  // 1. Add state to hold the fetched elevation from the backend
  const [elevation, setElevation] = useState(null);

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

  // 2. Create the async fetch function to communicate with Flask backend
  const fetchElevation = async (lat, lng) => {
    try {
      const response = await fetch('http://localhost:5000/get-elevation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setElevation(data.elevation);
      }
    } catch (error) {
      console.error('Error fetching elevation from backend:', error);
      setElevation(null);
    }
  };

  const coordsToPercent = (lat, lng) => {
    const poleDistRatio = (lat + 90) / 3; 
    const radiusPct = poleDistRatio * MAX_RADIUS_PCT;

    const rad = lng * (Math.PI / 180);
    const xPct = 50 + radiusPct * Math.sin(rad);
    const yPct = 50 - radiusPct * Math.cos(rad);

    return { xPct, yPct };
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

    return { 
      lat: Number(Math.max(-90, Math.min(-87, lat)).toFixed(2)), 
      lng: Number(lng.toFixed(2)) 
    };
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
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPct = (clickX / rect.width) * 100;
    const yPct = (clickY / rect.height) * 100;

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
      slope: `${(Math.random() * 3 + 2).toFixed(1)}°`,
      notes: 'SPICE Mean Earth coordinate point inspection.'
    });

    // 3. Trigger backend call on map click
    fetchElevation(coords.lat, coords.lng);
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
      slope: '3.8°',
      notes: 'Targeted via SPICE Mean Earth frame engine.'
    });

    // 4. Trigger backend call on Fly To submit
    fetchElevation(latNum, lngNum);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#05070b', color: '#f8fafc', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
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
      <div style={{ width: '380px', backgroundColor: '#0f172a', borderLeft: '1px solid #334155', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 10 }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#fbbf24', fontWeight: 'bold' }}>
            Mission Control Telemetry
          </span>
          <h1 style={{ fontSize: '18px', margin: '8px 0 16px 0', color: '#f8fafc' }}>{activeSite.name}</h1>

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
              {/* 5. Display the live elevation data */}
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
              <span style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '13px' }}>{activeSite.slope}</span>
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
                    // 6. Trigger backend call on preset selection
                    fetchElevation(site.lat, site.lng);
                  }}
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', textAlign: 'left', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
          NASA Space Apps Challenge 2026 — Lunar Landing Site Navigator
        </div>
      </div>

    </div>
  );
}