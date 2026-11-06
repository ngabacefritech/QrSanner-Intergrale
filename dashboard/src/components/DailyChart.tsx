/** Petit histogramme SVG « fait maison » : pas de dépendance de graphiques. */
interface DailyChartProps {
  data: { day: string; scans: number }[];
  height?: number;
}

export function DailyChart({ data, height = 140 }: DailyChartProps) {
  if (data.length === 0) return <p className="empty">Aucun scan sur la période.</p>;
  const width = Math.max(320, data.length * 34);
  const max = Math.max(...data.map((d) => d.scans), 1);
  const barW = (width - 16) / data.length;
  const floor = height - 22;

  return (
    <div className="chart-scroll">
      <svg width={width} height={height} role="img" aria-label="Scans par jour">
        {data.map((d, i) => {
          const h = Math.max(3, (d.scans / max) * (floor - 8));
          const x = 8 + i * barW;
          const label = d.day.slice(8, 10) + '/' + d.day.slice(5, 7);
          return (
            <g key={d.day}>
              <rect
                x={x + barW * 0.12}
                y={floor - h}
                width={barW * 0.76}
                height={h}
                rx={3}
                className="bar"
              >
                <title>{`${label} : ${d.scans} scan(s)`}</title>
              </rect>
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="tick">
                {label}
              </text>
            </g>
          );
        })}
        <line x1={8} x2={width - 8} y1={floor + 0.5} y2={floor + 0.5} className="axis" />
      </svg>
    </div>
  );
}

export function ShareBars({ data, total }: { data: { platform: string; scans: number }[]; total: number }) {
  if (total === 0) return <p className="empty">Pas encore de répartition : enregistrez des scans.</p>;
  return (
    <ul className="share">
      {data.map((row) => {
        const pct = Math.round((row.scans / total) * 100);
        return (
          <li key={row.platform}>
            <span className="share-label">
              {row.platform} — <strong>{row.scans}</strong> ({pct} %)
            </span>
            <div className="share-track">
              <div className="share-fill" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
