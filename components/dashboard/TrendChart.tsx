'use client';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { DashboardData } from '../../lib/dashboard';

// Few, muted hues, ordered by YoY rank. Direct labels at line ends; no legend.
const COLORS = ['#4338ca', '#0e7490', '#b45309', '#be185d', '#52525b'];
const HEIGHT = 400;
const MARGIN = { top: 8, right: 132, bottom: 4, left: 0 };
const AXIS_H = 34;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom - AXIS_H;
const MIN_GAP_PX = 15;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMonth = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ’${m.slice(2, 4)}`;

/** Vertical pixel offsets so end labels never overlap. */
function labelOffsets(top: DashboardData['trends']['top'], last: Record<string, number | string>) {
  const items = top.map(t => ({ id: t.id, y: (100 - Number(last[t.id])) * (PLOT_H / 100) })).sort((a, b) => a.y - b.y);
  const placed = items.map(i => ({ ...i, py: i.y }));
  for (let i = 1; i < placed.length; i++) placed[i].py = Math.max(placed[i].py, placed[i - 1].py + MIN_GAP_PX);
  return Object.fromEntries(placed.map(p => [p.id, p.py - p.y]));
}

export default function TrendChart({ trends }: { trends: DashboardData['trends'] }) {
  const last = trends.chart[trends.chart.length - 1];
  const offs = labelOffsets(trends.top, last);
  const summary = trends.top.map(t => `${t.term}, up ${t.yoyPct} percent year over year`).join('; ');
  return (
    <div role="img" aria-label={`Search interest over 24 months, index 0 to 100. ${summary}.`} style={{ height: HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trends.chart} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="#cfdcd7" />
          <XAxis dataKey="month" tickFormatter={fmtMonth} interval={5} tickLine={false} axisLine={{ stroke: '#b4c6bf' }} padding={{ left: 20, right: 0 }} tickMargin={12}
            tick={{ fontSize: 12, fill: '#4a5953' }} height={AXIS_H} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={36} tickMargin={4}
            tick={{ fontSize: 12, fill: '#4a5953' }} />
          {trends.top.map((t, i) => (
            <Line key={t.id} type="monotone" dataKey={t.id} name={t.term} stroke={COLORS[i % COLORS.length]}
              strokeWidth={i === 0 ? 2.5 : 1.75} dot={false} isAnimationActive={false}
              label={(p: { x?: number | string; y?: number | string; index?: number }) => p.index === trends.chart.length - 1 && p.x != null && p.y != null ? (
                <text key={t.id} x={Number(p.x) + 8} y={Number(p.y) + (offs[t.id] ?? 0)} dy={4} fontSize={12} fontWeight={600} fill={COLORS[i % COLORS.length]}>
                  {t.term}
                </text>
              ) : <g key={`${t.id}-${p.index}`} />} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
