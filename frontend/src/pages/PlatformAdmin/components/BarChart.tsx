import React from 'react';

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  formatValue?: (n: number) => string;
}

// Graphique en barres dessiné à la main en SVG inline. Pas de bibliothèque :
// Platform Admin voyage dans le même bundle que l'app des cliniques, souvent
// ouverte en mobile sur réseau ivoirien, et ~500 Ko de librairie de graphiques
// se paieraient sur chaque chargement de chaque clinique.
// Les couleurs viennent des variables CSS pour suivre le thème clair/sombre.
export const BarChart: React.FC<BarChartProps> = ({ data, height = 160, formatValue }) => {
  if (data.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aucune donnée sur la période.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
        role="img"
        aria-label="Graphique en barres"
      >
        {data.map((item, index) => {
          const barHeight = (item.value / max) * (height - 24);
          return (
            <rect
              key={item.label + index}
              x={index * barWidth + barWidth * 0.15}
              y={height - 20 - barHeight}
              width={barWidth * 0.7}
              height={Math.max(barHeight, item.value > 0 ? 1 : 0)}
              fill="var(--primary, hsl(174 60% 35%))"
              rx="0.6"
            >
              <title>{`${item.label} : ${formatValue ? formatValue(item.value) : item.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: 'flex', width: '100%' }}>
        {data.map((item, index) => (
          <span
            key={item.label + index}
            style={{
              width: `${barWidth}%`,
              textAlign: 'center',
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default BarChart;
