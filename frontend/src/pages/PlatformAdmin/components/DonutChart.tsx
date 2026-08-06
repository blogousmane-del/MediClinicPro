import React from 'react';

interface DonutChartProps {
  data: { label: string; value: number }[];
  size?: number;
  formatValue?: (n: number) => string;
}

// Palette fixe et distinguable, partagée par tous les donuts de la section
// pour qu'une même catégorie garde la même couleur d'un graphique à l'autre.
const COLORS = [
  'hsl(174 60% 35%)',
  'hsl(210 70% 50%)',
  'hsl(38 85% 55%)',
  'hsl(340 60% 55%)',
  'hsl(265 55% 58%)'
];

// Donut en SVG inline : un cercle par tranche, découpé avec stroke-dasharray.
// Aucune bibliothèque — voir BarChart pour le pourquoi.
export const DonutChart: React.FC<DonutChartProps> = ({ data, size = 140, formatValue }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aucune donnée.</p>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <svg
        viewBox="0 0 160 160"
        style={{ width: size, height: size, flexShrink: 0 }}
        role="img"
        aria-label="Répartition"
      >
        {data.map((item, index) => {
          const fraction = item.value / total;
          const dash = fraction * circumference;
          const circle = (
            <circle
              key={item.label + index}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth="22"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            >
              <title>{`${item.label} : ${formatValue ? formatValue(item.value) : item.value}`}</title>
            </circle>
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
        {data.map((item, index) => (
          <span key={item.label + index} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: COLORS[index % COLORS.length],
                flexShrink: 0
              }}
            />
            {item.label} — {formatValue ? formatValue(item.value) : item.value}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
