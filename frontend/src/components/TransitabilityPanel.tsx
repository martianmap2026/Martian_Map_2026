import './TransitabilityPanel.css'

interface TransitabilityProps {
  selectedDistance?: number; // Distancia de la ruta seleccionada en Ruta 1
}

export function TransitabilityPanel({ selectedDistance = 1.25 }: TransitabilityProps) {
  // Cálculo analítico simulado basado en el reporte técnico (Pendientes y abrasión)
  const slopeRiskValue = Math.min(Math.round(selectedDistance * 4.5 + 8), 28); // Grados estimados
  const wheelWearScore = Math.min(Math.round(selectedDistance * 12 + 15), 85); // Porcentaje de abrasión
  const roughnessIndex = (selectedDistance * 0.34 + 0.12).toFixed(2);

  let riskLevel = "SAFE TRAVERSAL";
  let riskClass = "risk-badge-safe";
  let barColor = "#10b981";

  if (wheelWearScore > 60) {
    riskLevel = "HIGH ABRASIVE RISK";
    riskClass = "risk-badge-high";
    barColor = "#dc2626";
  } else if (wheelWearScore > 35) {
    riskLevel = "MODERATE WEAR";
    riskClass = "risk-badge-moderate";
    barColor = "#f59e0b";
  }

  return (
    <div className="transitability-container">
      <div className="transitability-header">
        <h4>Terrain Transitability & Wheel Wear Analysis (Module 3)</h4>
        <span className={riskClass}>{riskLevel}</span>
      </div>

      <div className="transit-metrics-grid">
        
        {/* Métrica 1: Pendiente */}
        <div className="transit-card">
          <span className="card-title">Max Slope Gradient</span>
          <span className="card-value">{slopeRiskValue}°</span>
          <p className="card-desc">
            Derived from MOLA/HiRISE DTMs. Threshold limit for rover stability is set to 15°.
          </p>
        </div>

        {/* Métrica 2: Rugosidad */}
        <div className="transit-card">
          <span className="card-title">Terrain Roughness Proxy</span>
          <span className="card-value">{roughnessIndex} m</span>
          <p className="card-desc">
            Measures meter-scale bedrock distribution and potential traction loss obstacles.
          </p>
        </div>

        {/* Métrica 3: Riesgo de Desgaste */}
        <div className="transit-card">
          <span className="card-title">Wheel Abrasion Index</span>
          <span className="card-value">{wheelWearScore}%</span>
          <p className="card-desc">
            Estimated mechanical wear on aluminum-grousers based on sharp basaltic outcrop density.
          </p>
        </div>

      </div>

      {/* Simulación de Desgaste Acumulado */}
      <div className="wear-simulation-box">
        <h6>Locomotion Risk & Mechanical Wear Projection</h6>
        <div className="wear-bar-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#44403c' }}>
            <span>Path Traversal Wear Coefficient</span>
            <span>{wheelWearScore}% of Max Tolerance</span>
          </div>
          <div className="wear-bar-track">
            <div className="wear-bar-fill" style={{ width: `${wheelWearScore}%`, background: barColor }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}