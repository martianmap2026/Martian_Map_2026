import './HomeLanding.css'

interface HomeLandingProps {
  onSelectRoute: (route: 'region' | 'investigation') => void;
}

export function HomeLanding({ onSelectRoute }: HomeLandingProps) {
  return (
    <div className="landing-container">
      <div className="space-background"></div>

      <div className="landing-header">
        <h1>MARS MAP: MAWRTH VALLIS</h1>
        <p>Interactive Scientific and Geographic Exploration Platform</p>
      </div>

      <div className="landing-split-wrapper">
        
        {/* ZONA IZQUIERDA: RUTA 1 */}
        <div className="landing-card left-card" onClick={() => onSelectRoute('region')}>
          <div className="card-content">
            <span className="route-badge">Route 1</span>
            
            <div className="card-header-flex">
              <img src="/gps-logo.png" alt="Region Logo" className="card-custom-logo" />
              <h2>Explore by Region</h2>
            </div>

            <p>Analyze traverse datasets, topographic slope risks, wheel wear coefficients, and spatial trajectories in Mawrth Vallis.</p>
            <button className="landing-btn">Launch Regional View ➔</button>
          </div>
        </div>

        {/* CENTRO: ESFERA 3D DE MARTE */}
        <div className="mars-sphere-container">
          <div className="mars-globe">
            <div className="mars-texture"></div>
            <div className="mars-atmosphere-glow"></div>
          </div>
          <div className="globe-caption">
            <span>MSL Candidate Landing Ellipse (25 x 20 km)</span>
          </div>
        </div>

        {/* ZONA DERECHA: RUTA 2 */}
        <div className="landing-card right-card" onClick={() => onSelectRoute('investigation')}>
          <div className="card-content">
            <span className="route-badge">Route 2</span>
            
            <div className="card-header-flex">
              <img src="/lupa-logo.png" alt="Investigation Logo" className="card-custom-logo" />
              <h2>Explore by Investigation</h2>
            </div>

            <p>Query scientific research questions regarding aqueous history, clay mineralogy, and stratigraphic boundaries.</p>
            <button className="landing-btn">Launch Investigation ➔</button>
          </div>
        </div>

      </div>
    </div>
  )
}