'use client';
import type { ScoreBreakdown as SB } from '../lib/types';

const FACTOR_VAR: Record<string, string> = {
  trendMomentum: 'var(--f-trend)', segmentFit: 'var(--f-fit)', seasonalTiming: 'var(--f-season)',
  revenuePotential: 'var(--f-rev)', effortRisk: 'var(--f-risk)',
};

export function ScoreBar({ score }: { score: SB }) {
  return (
    <div className="scorebar" role="img" aria-label={`Score ${score.total} of 100`}>
      {score.factors.map(f => (
        <span key={f.key} style={{ width: `${f.contribution}%`, background: FACTOR_VAR[f.key] }} title={`${f.label}: +${f.contribution}`} />
      ))}
    </div>
  );
}

export default function ScoreBreakdown({ score }: { score: SB }) {
  return (
    <div className="breakdown">
      <table>
        <thead><tr><th>Factor</th><th className="num">Score</th><th className="num">Weight</th><th className="num">Adds</th></tr></thead>
        <tbody>
          {score.factors.map(f => (
            <tr key={f.key}>
              <td>
                <div className="factor-name"><i style={{ background: FACTOR_VAR[f.key] }} />{f.label}</div>
                <div className="factor-expl">{f.explanation}</div>
                <div className="factor-inputs">
                  {Object.entries(f.inputs).map(([k, v]) => <code key={k}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}: {v}</code>)}
                </div>
              </td>
              <td className="num">{f.score}</td>
              <td className="num">{Math.round(f.weight * 100)}%</td>
              <td className="num"><strong>{f.contribution}</strong></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={3}>Total</td><td className="num"><strong>{score.total}</strong></td></tr></tfoot>
      </table>
    </div>
  );
}
