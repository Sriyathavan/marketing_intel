'use client';
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';

/** Single-hue horizontal bars with value labels at the bar end. */
export default function BarList({ data, unit = '', ariaLabel, max }: {
  data: { name: string; value: number }[]; unit?: string; ariaLabel: string; max?: number;
}) {
  return (
    <div role="img" aria-label={`${ariaLabel}. ${data.map(d => `${d.name} ${d.value}${unit}`).join('; ')}.`} style={{ height: data.length * 50 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, max ?? 'dataMax']} />
          <YAxis type="category" dataKey="name" width={156} tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: '#18181b' }} />
          <Bar dataKey="value" fill="#4338ca" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => `${v}${unit}`} style={{ fontSize: 12, fontWeight: 600, fill: '#18181b' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
