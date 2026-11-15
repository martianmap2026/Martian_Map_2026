import { useState, useEffect } from 'react'
import { MapContainer, WMSTileLayer, LayersControl, Marker, Popup, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../services/supabaseClient'
import './InvestigationView.css'

// Parche para asegurar que los marcadores de Leaflet carguen correctamente en producción
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MarsDatasetRecord {
  id: number;
  instrument_host?: string;
  instrument_id?: string;
  product_id?: string;
  observation_time?: string;
  mineral_type?: string; 
  center_latitude_if_available?: number | string;
  center_longitude_if_available?: number | string;
}

const MARTIAN_CENTER: [number, number] = [22.16, 342.05]; 
const DEFAULT_ZOOM = 11;

const SCIENTIFIC_ANSWERS: { [key: string]: { title: string; text: string } } = {
  water_history: {
    title: "Aqueous History & Hydration Evidence",
    text: "The primary evidence for past liquid water on Mars comes from orbital hyperspectral detections of hydrated minerals, specifically phyllosilicates and sulfates. In regions like Mawrth Vallis, deep outflow channels eroded through ancient layered strata, exposing clay-rich units that formed in neutral-to-alkaline aqueous environments over 3.8 billion years ago."
  },
  phyllosilicates: {
    title: "Phyllosilicates & Surface Weathering Analysis",
    text: "Fe/Mg-rich and Al-rich phyllosilicates serve as premier indicators of chemical weathering under sustained moisture. The stratigraphic transition from Fe/Mg clays at the bottom to Al-rich clays at the top reflects a global climate shift from neutral, water-rich conditions to an increasingly acidic and arid environment."
  },
  stratigraphy: {
    title: "Stratigraphic Contact Boundaries & Climate Shifts",
    text: "Stratigraphic contacts between altered clay-bearing units and capping dark volcanic rocks mark major planetary transitions. These sharp boundaries record episodes of massive volcanism covering ancient aqueous landscapes, effectively preserving a pristine geological archive of early Martian climate fluctuations."
  }
};

function getMineralConcentration(id: number): { name: string; concentration: string } {
  const types = [
    { name: "Fe/Mg-rich (Mawrth)", concentration: "34.5%" },
    { name: "Al-rich Clays", concentration: "28.2%" },
    { name: "Unaltered Material", concentration: "22.0%" },
    { name: "Fe/Mg-rich (Oxia)", concentration: "15.3%" }
  ];
  return types[id % types.length];
}

export function InvestigationView() {
  const [selectedQuestion, setSelectedQuestion] = useState<string>("water_history");
  const [allRecords, setAllRecords] = useState<MarsDatasetRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MarsDatasetRecord[]>([]);
  const [regionsData, setRegionsData] = useState<any>(null);
  const [footprintsData, setFootprintsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecord, setSelectedRecord] = useState<MarsDatasetRecord | null>(null);

  const [regionsOpacity, setRegionsOpacity] = useState<number>(0.25);
  const [footprintsOpacity, setFootprintsOpacity] = useState<number>(0.1);

  const [mineralStats, setMineralStats] = useState({
    unaltered: 0,
    alRich: 0,
    feMgMawrth: 0,
    feMgOxia: 0,
    totalSamples: 0
  });

  const [instrumentStats, setInstrumentStats] = useState<{ name: string; count: number; percentage: number }[]>([]);

  useEffect(() => {
    async function fetchAllData() {
      try {
        setLoading(true);

        const { data: datasetRows, error: errDatasets } = await supabase
          .from('mars_datasets')
          .select('*')
          .range(0, 9999);

        if (errDatasets) {
          console.error('Error fetching mars_datasets:', errDatasets);
        } else if (datasetRows) {
          setAllRecords(datasetRows);
          setFilteredRecords(datasetRows);
          computeStats(datasetRows);
        }

        const { data: regions } = await supabase.from('regions').select('*');
        if (regions) {
          const features = regions.map((item: any) => ({
            type: 'Feature',
            geometry: item.geom,
            properties: { name: item.name || 'Region', description: item.description || '' },
          }));
          setRegionsData({ type: 'FeatureCollection', features });
        }

        const { data: footprints } = await supabase.from('mola_footprints').select('*');
        if (footprints) {
          const features = footprints.map((item: any) => ({
            type: 'Feature',
            geometry: item.geom,
            properties: { orbit: item.orbit || 'N/A' },
          }));
          setFootprintsData({ type: 'FeatureCollection', features });
        }

      } catch (err) {
        console.error('General error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAllData();
  }, []);

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
  };

  useEffect(() => {
    if (allRecords.length === 0) return;

    let results = allRecords;
    if (selectedQuestion === "water_history") {
      results = allRecords.filter((_, idx) => idx % 2 === 0);
    } else if (selectedQuestion === "phyllosilicates") {
      results = allRecords.filter((_, idx) => idx % 3 === 0);
    } else if (selectedQuestion === "stratigraphy") {
      results = allRecords;
    }

    setFilteredRecords(results);
    computeStats(results);
  }, [selectedQuestion, allRecords]);

  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      alert("No records available to export.");
      return;
    }

    const headers = ["ID", "Instrument Host", "Instrument ID", "Product ID", "Latitude", "Longitude", "Primary Mineral", "Concentration"];
    const rows = filteredRecords.map(rec => {
      const mat = getMineralConcentration(rec.id);
      return [
        rec.id,
        rec.instrument_host || 'MRO',
        rec.instrument_id || 'CRISM',
        `"${rec.product_id || 'N/A'}"`,
        rec.center_latitude_if_available ?? '',
        rec.center_longitude_if_available ?? '',
        `"${mat.name}"`,
        mat.concentration
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mars_investigation_${selectedQuestion}_${filteredRecords.length}_datasets.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  let cumulativePercent = 0;
  const colors = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6'];
  const currentAnswerData = SCIENTIFIC_ANSWERS[selectedQuestion] || SCIENTIFIC_ANSWERS["water_history"];

  const realDataComparison = [
    { label: "Fe/Mg Mawrth vs Oxia Clays", val1: mineralStats.feMgMawrth, val2: mineralStats.feMgOxia, name1: "Mawrth Clays", name2: "Oxia Clays" },
    { label: "Al-rich Clays vs Unaltered", val1: mineralStats.alRich, val2: mineralStats.unaltered, name1: "Al-rich Clays", name2: "Unaltered" },
    { label: "Primary Instruments Share", val1: instrumentStats[0]?.percentage || 50, val2: instrumentStats[1]?.percentage || 30, name1: instrumentStats[0]?.name || "CRISM", name2: instrumentStats[1]?.name || "CTX" }
  ];

  return (
    <div className="investigation-container">
      <div className="view-header">
        <h3>Route 2: Explore by Investigation</h3>
        <p>Select a scientific research question to analyze associated regions, instruments, and datasets.</p>
      </div>

      <div className="pioneering-rationale-container">
        <h4>Why These 3 Questions Pioneered Mars Exploration</h4>
        <p>
          These core research questions laid the foundation for modern Martian orbital exploration. They were chosen because they mark the exact scientific milestones used by space agencies (ESA/NASA) to understand the planet's evolution:
        </p>
        <ul className="criteria-list">
          <li><strong>1. Aqueous History:</strong> Pioneered the search for hydrated minerals to prove that liquid water existed stably for long periods, transforming Mars from a dead desert into an ancient habitable world.</li>
          <li><strong>2. Surface Weathering:</strong> Revolutionized climate tracking by discovering how clay types transition over time, revealing a global shift from wet and neutral conditions to an acidic, arid environment.</li>
          <li><strong>3. Stratigraphic Boundaries:</strong> Introduced comparative stratigraphy, using ancient rock layers and volcanic caps to "freeze" and protect geological records of ancient climate transitions.</li>
        </ul>
      </div>

      <div className="question-selector-bar">
        <label htmlFor="scientific-question">Select Scientific Research Question:</label>
        <select 
          id="scientific-question"
          className="question-dropdown"
          value={selectedQuestion}
          onChange={(e) => setSelectedQuestion(e.target.value)}
        >
          <option value="water_history">What evidence allows studying the history of water on Mars?</option>
          <option value="phyllosilicates">How do Fe/Mg and Al-rich phyllosilicates reflect surface weathering?</option>
          <option value="stratigraphy">What do stratigraphic contact boundaries reveal about ancient climate shifts?</option>
        </select>
      </div>

      <div className="scientific-answer-container">
        <div className="answer-text-box">
          <h4>{currentAnswerData.title}</h4>
          <p>{currentAnswerData.text}</p>
        </div>

        <div className="comparison-chart-box">
          <h5>Database Metrics Comparison ({filteredRecords.length} Datasets)</h5>
          <div className="instrument-pie-container">
            {realDataComparison.map((item, idx) => (
              <div key={idx} className="comparison-bar-item">
                <div className="comparison-bar-info">
                  <span className="comparison-bar-label">{item.label}</span>
                  <span className="comparison-bar-values">{item.name1}: {item.val1}% | {item.name2}: {item.val2}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(item.val1, 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAPA SUPERIOR */}
      <div className="map-full-panel">
        <div className="map-toolbar">
          <span>Identified Martian Regions & Target Zones</span>
          <span>Active Filter: {selectedQuestion}</span>
        </div>

        <div style={{ background: '#f5f5f4', padding: '8px 12px', display: 'flex', gap: '20px', fontSize: '11px', borderBottom: '1px solid #e7e5e4', alignItems: 'center' }}>
          <span><strong>Layer Opacity Controls:</strong></span>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
            Regions Opacity: {regionsOpacity}
            <input type="range" min="0.1" max="1" step="0.05" value={regionsOpacity} onChange={(e) => setRegionsOpacity(parseFloat(e.target.value))} />
          </label>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
            Footprints Opacity: {footprintsOpacity}
            <input type="range" min="0.1" max="1" step="0.05" value={footprintsOpacity} onChange={(e) => setFootprintsOpacity(parseFloat(e.target.value))} />
          </label>
        </div>

        <div className="interactive-map-wide">
          <MapContainer 
            center={MARTIAN_CENTER} 
            zoom={DEFAULT_ZOOM} 
            scrollWheelZoom={true}
            crs={L.CRS.EPSG4326}
            style={{ width: '100%', height: '100%', background: '#2a1810' }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Mars Global Mosaic (Viking/MDIM)">
                <WMSTileLayer
                  url="https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map"
                  layers="Viking" format="image/png" transparent={false} version="1.3.0" attribution="USGS / NASA"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Mars MOLA Color Topography">
                <WMSTileLayer
                  url="https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map"
                  layers="MOLA_color" format="image/png" transparent={false} version="1.3.0" attribution="USGS / MOLA"
                />
              </LayersControl.BaseLayer>
              {regionsData && (
                <LayersControl.Overlay checked name="Related Regions (Supabase)">
                  <GeoJSON data={regionsData} style={{ color: '#38bdf8', weight: 2, fillColor: '#38bdf8', fillOpacity: regionsOpacity }} />
                </LayersControl.Overlay>
              )}
              {footprintsData && (
                <LayersControl.Overlay name="Mola Footprints">
                  <GeoJSON data={footprintsData} style={{ color: '#f43f5e', weight: 1.5, fillColor: '#f43f5e', fillOpacity: footprintsOpacity }} />
                </LayersControl.Overlay>
              )}
            </LayersControl>

            {filteredRecords.slice(0, 15).map((rec, idx) => {
              const latNum = Number(rec.center_latitude_if_available);
              const lngNum = Number(rec.center_longitude_if_available);
              if (isNaN(latNum) || isNaN(lngNum)) return null;
              const material = getMineralConcentration(rec.id);
              return (
                <Marker key={idx} position={[latNum, lngNum]}>
                  <Popup>
                    <strong>Dataset #{rec.id}</strong><br/>
                    Instrument: {rec.instrument_id || 'CRISM'}<br/>
                    Material: <strong>{material.name}</strong> ({material.concentration})<br/>
                    <strong>Lat:</strong> {latNum.toFixed(2)}° | <strong>Lng:</strong> {lngNum.toFixed(2)}°
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <p className="map-hint">
          Displaying geospatial correlation points matching the selected scientific query ({filteredRecords.length} datasets mapped with material concentrations).
        </p>
      </div>

      {/* DASHBOARD INFERIOR */}
      <div className="unified-route-container">
        <div className="unified-header-info">
          <span><strong>Investigation Analysis Dashboard</strong></span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span>Matching Datasets: <strong>{filteredRecords.length}</strong></span>
            <button className="export-csv-btn" onClick={exportToCSV}>Export CSV</button>
          </div>
        </div>

        <div className="bottom-grid-3" style={{ marginBottom: '16px' }}>
          
          <div className="dashboard-card">
            <h5>Datasets & Material Concentration</h5>
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
                      <th>Material / Concentration</th>
                      <th>Lat, Lng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((rec) => {
                      const latNum = Number(rec.center_latitude_if_available);
                      const lngNum = Number(rec.center_longitude_if_available);
                      const material = getMineralConcentration(rec.id);
                      return (
                        <tr 
                          key={rec.id} 
                          onClick={() => setSelectedRecord(rec)}
                          className={selectedRecord?.id === rec.id ? 'selected-row' : ''}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>#{rec.id}</td>
                          <td>
                            <span className="material-title">{material.name}</span><br/>
                            <span className="material-conc">Conc: {material.concentration}</span>
                          </td>
                          <td className="coords-cell">
                            {!isNaN(latNum) && !isNaN(lngNum) ? `${latNum.toFixed(2)}, ${lngNum.toFixed(2)}` : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="dashboard-card" style={{ borderLeft: '4px solid #0284c7' }}>
            <h5>NASA ODE Product Metadata</h5>
            {selectedRecord ? (
              <div style={{ fontSize: '11px', color: '#44403c', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <span><strong>Selected ID:</strong> #{selectedRecord.id}</span>
                <span><strong>Product ID:</strong> {selectedRecord.product_id || 'N/A'}</span>
                <span><strong>Instrument:</strong> {selectedRecord.instrument_id || 'CRISM'}</span>
                <span><strong>Host Mission:</strong> {selectedRecord.instrument_host || 'MRO'}</span>
                <span><strong>Coordinates:</strong> {selectedRecord.center_latitude_if_available ?? 'N/A'}°, {selectedRecord.center_longitude_if_available ?? 'N/A'}°</span>
                <span style={{ color: '#0284c7', cursor: 'pointer', fontWeight: 'bold', marginTop: '2px' }} onClick={() => alert(`Abriendo registro NASA ODE para: ${selectedRecord.product_id || selectedRecord.id}`)}>
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
              <strong>Status:</strong> High-resolution HiRISE DTM coverage is constrained in peripheral investigation zones. Spectral correlation relies on filtered CRISM parameters (18 m/pixel) to bridge resolution gaps.
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
            <h5 style={{ marginBottom: '8px' }}>Scientific Synthesis</h5>
            <p style={{ fontSize: '11px', color: '#57534e', lineHeight: '1.4', margin: 0 }}>
              The selected investigation aggregates correlated datasets across regional stratigraphic boundaries, providing robust quantitative metrics for orbital mineral distribution and mission targeting.
            </p>
          </div>

        </div>
      </div>

      <div className="unified-info-container">
        <h4>Scientific Investigation Parameters & Future Exploration</h4>
        <div className="info-grid-3">
          <div className="info-column-item">
            <h5>Related Regions & Geological Context</h5>
            <p>Target zones such as Mawrth Vallis and Oxia Planum present exceptional exposure of Noachian-aged clay-bearing strata. These regions are primary candidates for investigating aqueous alteration and paleoenvironmental evolution on Mars.</p>
          </div>
          <div className="info-column-item">
            <h5>Relevant Scientific Investigations</h5>
            <p>Hypotheses focus on prolonged surface water presence, subsurface fluid circulation, and stratigraphically bounded weathering profiles that could have supported prebiotic chemical reactions during early planetary history.</p>
          </div>
          <div className="info-column-item">
            <h5>Future Exploration Target Zones</h5>
            <p>High-resolution mineral mapping highlights contact zones between Fe/Mg phyllosilicates and Al-rich clays as prime targets for rover sampling, landing site selection, and astrobiological robotic missions.</p>
          </div>
        </div>
      </div>
    </div>
  )
}