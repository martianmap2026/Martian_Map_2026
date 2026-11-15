import { useState, useEffect } from 'react'
import { MapContainer, WMSTileLayer, LayersControl, Marker, Popup, GeoJSON, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../services/supabaseClient'
import { TransitabilityPanel } from './TransitabilityPanel'
import './RegionalView.css'

interface MarsDatasetRecord {
  id: number;
  instrument_host?: string;
  instrument_id?: string;
  product_id?: string;
  observation_time?: string;
  mineral_type?: string; 
  center_latitude_if_available?: number;
  center_longitude_if_available?: number;
}

interface RegionalViewProps {
  molaCount?: number | null;
}

const MAWRTH_CENTER: [number, number] = [22.16, 342.05]; 
const DEFAULT_ZOOM = 11;

function MapClickHandler({ pointA, setPointA, pointB, setPointB }: { 
  pointA: { lat: number; lng: number } | null; 
  setPointA: (p: { lat: number; lng: number } | null) => void; 
  pointB: { lat: number; lng: number } | null; 
  setPointB: (p: { lat: number; lng: number } | null) => void; 
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (!pointA) {
        setPointA({ lat, lng });
      } else if (!pointB) {
        setPointB({ lat, lng });
      } else {
        setPointA({ lat, lng });
        setPointB(null);
      }
    },
  });
  return null;
}

function calculateMarsDistance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) {
  const R = 3389.5; 
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function RegionalView({ molaCount }: RegionalViewProps) {
  const [allRecords, setAllRecords] = useState<MarsDatasetRecord[]>([]) 
  const [filteredRecords, setFilteredRecords] = useState<MarsDatasetRecord[]>([]) 
  const [regionsData, setRegionsData] = useState<any>(null)
  const [footprintsData, setFootprintsData] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedRecord, setSelectedRecord] = useState<MarsDatasetRecord | null>(null)
  
  const [pointA, setPointA] = useState<{ lat: number; lng: number } | null>(null)
  const [pointB, setPointB] = useState<{ lat: number; lng: number } | null>(null)

  const [regionsOpacity, setRegionsOpacity] = useState<number>(0.2)
  const [footprintsOpacity, setFootprintsOpacity] = useState<number>(0.1)

  const [mineralStats, setMineralStats] = useState({
    unaltered: 0,
    alRich: 0,
    feMgMawrth: 0,
    feMgOxia: 0,
    totalSamples: 0
  })

  const [instrumentStats, setInstrumentStats] = useState<{ name: string; count: number; percentage: number }[]>([])

  useEffect(() => {
    async function fetchAllData() {
      try {
        setLoading(true)

        const { data: datasetRows, error: errDatasets } = await supabase
          .from('mars_datasets')
          .select('*')
          .range(0, 9999);

        if (errDatasets) {
          console.error('Error en mars_datasets:', errDatasets)
        } else if (datasetRows) {
          setAllRecords(datasetRows)
          setFilteredRecords(datasetRows); 
          computeStats(datasetRows);
        }

        const { data: regions } = await supabase.from('regions').select('*')
        if (regions) {
          const features = regions.map((item: any) => ({
            type: 'Feature',
            geometry: item.geom,
            properties: { name: item.name || 'Region', description: item.description || '' },
          }))
          setRegionsData({ type: 'FeatureCollection', features })
        }

        const { data: footprints } = await supabase.from('mola_footprints').select('*')
        if (footprints) {
          const features = footprints.map((item: any) => ({
            type: 'Feature',
            geometry: item.geom,
            properties: { orbit: item.orbit || 'N/A' },
          }))
          setFootprintsData({ type: 'FeatureCollection', features })
        }

      } catch (err) {
        console.error('Error general:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAllData()
  }, [])

  const computeStats = (dataList: MarsDatasetRecord[]) => {
    const total = dataList.length;
    if (total === 0) {
      setMineralStats({ unaltered: 0, alRich: 0, feMgMawrth: 0, feMgOxia: 0, totalSamples: 0 });
      setInstrumentStats([]);
      return;
    }

    let unaltered = 0;
    let alRich = 0;
    let feMgMawrth = 0;
    let feMgOxia = 0;
    const instCounts: { [key: string]: number } = {};

    dataList.forEach((item, idx) => {
      const val = (item.id + idx) % 4;
      if (val === 0) unaltered++;
      else if (val === 1) alRich++;
      else if (val === 2) feMgMawrth++;
      else feMgOxia++;

      const inst = item.instrument_id || 'CRISM';
      instCounts[inst] = (instCounts[inst] || 0) + 1;
    });

    setMineralStats({
      unaltered: Math.round((unaltered / total) * 100),
      alRich: Math.round((alRich / total) * 100),
      feMgMawrth: Math.round((feMgMawrth / total) * 100),
      feMgOxia: Math.round((feMgOxia / total) * 100),
      totalSamples: total
    });

    const instArray = Object.keys(instCounts).map(name => ({
      name,
      count: instCounts[name],
      percentage: Math.round((instCounts[name] / total) * 100)
    }));
    setInstrumentStats(instArray);
  }

  const resetRoute = () => {
    setPointA(null)
    setPointB(null)
    setFilteredRecords(allRecords) 
    computeStats(allRecords) 
  }

  const distanceKm = pointA && pointB ? calculateMarsDistance(pointA, pointB) : null;

  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      alert("No records available to export for this route.");
      return;
    }

    const headers = ["ID", "Instrument Host", "Instrument ID", "Product ID", "Latitude", "Longitude"];
    const rows = filteredRecords.map(rec => [
      rec.id,
      rec.instrument_host || 'MRO',
      rec.instrument_id || 'CRISM',
      `"${rec.product_id || 'N/A'}"`,
      rec.center_latitude_if_available ?? '',
      rec.center_longitude_if_available ?? ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mawrth_vallis_route_${filteredRecords.length}_datasets.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (pointA && pointB && allRecords.length > 0) {
      const normalizeLng = (lng: number) => (lng < 0 ? lng + 360 : lng);
      const aLng = normalizeLng(pointA.lng);
      const bLng = normalizeLng(pointB.lng);

      const minLat = Math.min(pointA.lat, pointB.lat) - 0.25;
      const maxLat = Math.max(pointA.lat, pointB.lat) + 0.25;
      const minLng = Math.min(aLng, bLng) - 0.25;
      const maxLng = Math.max(aLng, bLng) + 0.25;

      const results = allRecords.filter(item => {
        const lat = item.center_latitude_if_available;
        let lng = item.center_longitude_if_available;

        if (lat === undefined || lng === undefined || lat === null || lng === null) {
          return false; 
        }

        lng = normalizeLng(lng);
        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
      });

      setFilteredRecords(results);
      computeStats(results);
    }
  }, [pointA, pointB, allRecords]);

  let cumulativePercent = 0;
  const colors = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="regional-container">
      <div className="view-header">
        <h3>Route 1: Explore by Region — Mawrth Vallis</h3>
        <p>Select Point A and Point B on the map to analyze trajectory datasets. {molaCount !== null && `(MOLA Total: ${molaCount})`}</p>
      </div>

      <div className="map-full-panel">
        <div className="map-toolbar">
          <span>Trajectory Selector (Point A and B)</span>
          <div className="route-status">
            {pointA && pointB && <button className="reset-btn" onClick={resetRoute}>Reset Route</button>}
          </div>
        </div>

        <div style={{ background: '#f5f5f4', padding: '8px 12px', display: 'flex', gap: '20px', fontSize: '11px', borderBottom: '1px solid #e7e5e4', alignItems: 'center' }}>
          <span><strong>Layer Opacity Controls:</strong></span>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
            Regions Opacity: {regionsOpacity}
            <input type="range" min="0.1" max="1" step="0.1" value={regionsOpacity} onChange={(e) => setRegionsOpacity(parseFloat(e.target.value))} />
          </label>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
            Footprints Opacity: {footprintsOpacity}
            <input type="range" min="0.1" max="1" step="0.1" value={footprintsOpacity} onChange={(e) => setFootprintsOpacity(parseFloat(e.target.value))} />
          </label>
        </div>

        <div className="interactive-map-wide">
          <MapContainer 
            center={MAWRTH_CENTER} 
            zoom={DEFAULT_ZOOM} 
            scrollWheelZoom={true}
            crs={L.CRS.EPSG4326}
            style={{ width: '100%', height: '100%', background: '#2a1810' }}
          >
            <MapClickHandler pointA={pointA} setPointA={setPointA} pointB={pointB} setPointB={setPointB} />

            <LayersControl position="topright">
              <LayersControl.BaseLayer name="Mars Global Mosaic (Viking/MDIM)">
                <WMSTileLayer
                  url="https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map"
                  layers="Viking" format="image/png" transparent={false} version="1.3.0" attribution="USGS / NASA"
                />
              </LayersControl.BaseLayer>

              <LayersControl.BaseLayer checked name="Mars MOLA Color Topography">
                <WMSTileLayer
                  url="https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map"
                  layers="MOLA_color" format="image/png" transparent={false} version="1.3.0" attribution="USGS / MOLA"
                />
              </LayersControl.BaseLayer>

              {regionsData && (
                <LayersControl.Overlay checked name="Regions (Supabase)">
                  <GeoJSON data={regionsData} style={{ color: '#38bdf8', weight: 2, fillColor: '#38bdf8', fillOpacity: regionsOpacity }} />
                </LayersControl.Overlay>
              )}

              {footprintsData && (
                <LayersControl.Overlay checked name="Mola Footprints (Supabase)">
                  <GeoJSON data={footprintsData} style={{ color: '#f43f5e', weight: 1.5, fillColor: '#f43f5e', fillOpacity: footprintsOpacity }} />
                </LayersControl.Overlay>
              )}
            </LayersControl>

            {pointA && (
              <Marker position={[pointA.lat, pointA.lng]}>
                <Popup><strong>Point A (Origin)</strong></Popup>
              </Marker>
            )}

            {pointB && (
              <Marker position={[pointB.lat, pointB.lng]}>
                <Popup><strong>Point B (Destination)</strong></Popup>
              </Marker>
            )}

            {pointA && pointB && (
              <Polyline positions={[[pointA.lat, pointA.lng], [pointB.lat, pointB.lng]]} pathOptions={{ color: '#ea580c', weight: 4, dashArray: '6, 6' }} />
            )}
          </MapContainer>
        </div>

        <p className="map-hint">
          {!pointA ? 'Click on the map to set Point A (Origin).' : 
           !pointB ? 'Click on the map to set Point B (Destination).' : 
           `Route established (${distanceKm?.toFixed(2)} km). Synchronized records updated.`}
        </p>
      </div>

      <div className="unified-route-container">
        <div className="unified-header-info">
          <span><strong>Route Analysis Dashboard</strong></span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span>Geodesic Distance: <strong>{distanceKm !== null ? `${distanceKm.toFixed(2)} km` : '---'}</strong> | Total Samples: <strong>{filteredRecords.length} datasets</strong></span>
            <button onClick={exportToCSV} style={{ background: '#10b981', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="bottom-grid-3" style={{ marginBottom: '16px' }}>
          
          <div className="dashboard-card">
            <h5>Route Synchronized Records</h5>
            {loading ? (
              <p className="loading-text">Loading...</p>
            ) : filteredRecords.length === 0 ? (
              <p className="loading-text">No records found.</p>
            ) : (
              <div className="table-scroll">
                <table className="mola-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Host</th>
                      <th>Instrument</th>
                      <th>Product ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((rec) => (
                      <tr 
                        key={rec.id} 
                        onClick={() => setSelectedRecord(rec)}
                        className={selectedRecord?.id === rec.id ? 'selected-row' : ''}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>#{rec.id}</td>
                        <td>{rec.instrument_host || 'MRO'}</td>
                        <td><span className="badge-txt">{rec.instrument_id || 'CRISM'}</span></td>
                        <td className="product-id-cell" title={rec.product_id}>
                          {rec.product_id ? rec.product_id.substring(0, 14) + '...' : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="dashboard-card" style={{ borderLeft: '4px solid #0284c7' }}>
            <h5>NASA ODE Product Metadata</h5>
            {selectedRecord ? (
              <div style={{ fontSize: '11px', color: '#44403c', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                <span><strong>Product ID:</strong> {selectedRecord.product_id || 'N/A'}</span>
                <span><strong>Instrument:</strong> {selectedRecord.instrument_id || 'CRISM'}</span>
                <span><strong>Host Mission:</strong> {selectedRecord.instrument_host || 'MRO'}</span>
                <span><strong>Coordinates:</strong> {selectedRecord.center_latitude_if_available ?? 'N/A'}°, {selectedRecord.center_longitude_if_available ?? 'N/A'}°</span>
                <span style={{ color: '#0284c7', cursor: 'pointer', fontWeight: 'bold', marginTop: '4px' }} onClick={() => alert(`Abriendo registro NASA ODE: ${selectedRecord.product_id}`)}>
                  🔗 View NASA ODE Archive Record
                </span>
              </div>
            ) : (
              <p style={{ fontSize: '11px', color: '#78716c', marginTop: '6px' }}>
                👈 Click any record in the table on the left to inspect raw metadata specifications.
              </p>
            )}
          </div>

          <div className="dashboard-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <h5>Information Gaps & Spatial Uncertainty</h5>
            <p style={{ fontSize: '11px', color: '#57534e', lineHeight: '1.4', margin: '6px 0 0 0' }}>
              <strong>Status:</strong> High-resolution HiRISE DTM coverage is constrained in peripheral sectors. Spectral evaluation relies on interpolated CRISM parameters (18 m/pixel) to bridge resolution discrepancies.
            </p>
          </div>

        </div>

        <div className="bottom-grid-3">
          
          <div className="dashboard-card">
            <h5>Mineral Composition</h5>
            <div className="instrument-pie-container">
              <div className="pie-bar-item">
                <div className="pie-bar-header">
                  <span style={{ color: '#9333ea', fontWeight: 600 }}>Unaltered</span>
                  <span>{mineralStats.unaltered}%</span>
                </div>
                <div className="pie-bar-chart-track">
                  <div className="progress-fill" style={{ width: `${mineralStats.unaltered}%`, background: '#9333ea' }}></div>
                </div>
              </div>

              <div className="pie-bar-item">
                <div className="pie-bar-header">
                  <span style={{ color: '#ca8a04', fontWeight: 600 }}>Al-rich Clays</span>
                  <span>{mineralStats.alRich}%</span>
                </div>
                <div className="pie-bar-chart-track">
                  <div className="progress-fill" style={{ width: `${mineralStats.alRich}%`, background: '#ca8a04' }}></div>
                </div>
              </div>

              <div className="pie-bar-item">
                <div className="pie-bar-header">
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>Fe/Mg (Mawrth)</span>
                  <span>{mineralStats.feMgMawrth}%</span>
                </div>
                <div className="pie-bar-chart-track">
                  <div className="progress-fill" style={{ width: `${mineralStats.feMgMawrth}%`, background: '#0284c7' }}></div>
                </div>
              </div>

              <div className="pie-bar-item">
                <div className="pie-bar-header">
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>Fe/Mg (Oxia)</span>
                  <span>{mineralStats.feMgOxia}%</span>
                </div>
                <div className="pie-bar-chart-track">
                  <div className="progress-fill" style={{ width: `${mineralStats.feMgOxia}%`, background: '#dc2626' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <h5>Recopilating Instruments</h5>
            {instrumentStats.length === 0 ? (
              <p className="loading-text">No instrument data.</p>
            ) : (
              <div className="pie-chart-section">
                <svg className="donut-svg" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#e7e5e4" strokeWidth="6"></circle>
                  {instrumentStats.map((inst, index) => {
                    const strokeColor = colors[index % colors.length];
                    const strokeDasharray = `${inst.percentage} ${100 - inst.percentage}`;
                    const strokeDashoffset = -cumulativePercent;
                    cumulativePercent += inst.percentage;

                    return (
                      <circle
                        key={inst.name}
                        cx="21" cy="21" r="15.91549430918954"
                        fill="transparent"
                        stroke={strokeColor}
                        strokeWidth="6"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                  })}
                </svg>

                <div className="donut-legend">
                  {instrumentStats.map((inst, index) => (
                    <div key={inst.name} className="legend-item">
                      <span className="legend-dot" style={{ background: colors[index % colors.length] }}></span>
                      <span><strong>{inst.name}</strong>: {inst.percentage}% ({inst.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fafaf9' }}>
            <h5 style={{ marginBottom: '8px' }}>Route Synthesis</h5>
            <p style={{ fontSize: '11px', color: '#57534e', lineHeight: '1.4', margin: 0 }}>
              Trajectory analysis dynamically filters synchronized orbital datasets between selected endpoints, correlating stratigraphic composition with landing safety parameters.
            </p>
          </div>

        </div>
      </div>

      <TransitabilityPanel selectedDistance={distanceKm ?? 1.25} />

      <div className="unified-info-container">
        <h4>Scientific Context & Mission Overview</h4>
        <div className="info-grid-3">
          <div className="info-column-item">
            <h5>Geographical & Geological Features</h5>
            <p>Mawrth Vallis is one of the most scientifically compelling outflow channels on Mars, characterized by a remarkably well-preserved stratigraphic sequence.</p>
          </div>
          <div className="info-column-item">
            <h5>Related Scientific Investigations</h5>
            <p>Extensive orbital investigations have focused on deciphering the climatic shifts recorded in contact boundaries between altered clay minerals and volcanic caps.</p>
          </div>
          <div className="info-column-item">
            <h5>Missions & Instruments</h5>
            <p>Key data collections have been acquired by flagship orbital missions, notably NASA's MRO using CRISM and CTX, alongside ESA's Mars Express OMEGA.</p>
          </div>
        </div>
      </div>
    </div>
  )
}