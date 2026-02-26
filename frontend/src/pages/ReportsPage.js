import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportHighMiles, reportMBF, reportLikelyToFail } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const TABS = ['likely-to-fail', 'high-miles', 'mbf'];
const TAB_LABELS = {
  'likely-to-fail': '⚠️ Likely to Fail',
  'high-miles': '📈 High Miles',
  'mbf': '🔁 Miles Between Failures',
};

const RISK_COLORS = {
  CRITICAL: '#e53e3e',
  HIGH: '#dd6b20',
  MEDIUM: '#d69e2e',
  LOW: '#38a169',
  UNKNOWN: '#a0aec0',
};

export default function ReportsPage() {
  const { carId } = useParams();
  const [tab, setTab] = useState('likely-to-fail');

  return (
    <div>
      <div className="page-header">
        <h2>📊 Engineering Reports</h2>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--calsol-blue)' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--calsol-blue)' : 'var(--text-muted)',
              fontSize: '0.875rem',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'likely-to-fail' && <LikelyToFailReport carId={carId} />}
      {tab === 'high-miles' && <HighMilesReport carId={carId} />}
      {tab === 'mbf' && <MBFReport carId={carId} />}
    </div>
  );
}

// ─── Likely to Fail ────────────────────────────────────────────────────────────
function LikelyToFailReport({ carId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-likely-fail', carId],
    queryFn: () => reportLikelyToFail(carId),
    enabled: !!carId,
  });

  const parts = data?.parts || [];

  if (isLoading) return <div className="loading">Calculating risk scores…</div>;

  const chartData = parts
    .filter((p) => p.risk_score > 0)
    .slice(0, 15)
    .map((p) => ({
      name: p.part_name.length > 18 ? p.part_name.slice(0, 18) + '…' : p.part_name,
      risk: Math.round(p.risk_score * 100),
      label: p.risk_label,
    }));

  return (
    <div>
      <div className="card">
        <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.875rem' }}>
          Risk score = current miles ÷ average miles-between-failures for that part type.
          Score ≥ 1.0 means the part has exceeded its average failure mileage.
        </p>
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 60 }}>
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="risk" name="Risk %">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={RISK_COLORS[entry.label] || '#a0aec0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Group</th>
                <th>Location</th>
                <th>Current Miles</th>
                <th>Avg MBF</th>
                <th>Risk Score</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.part_id}>
                  <td>
                    <div>{p.part_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.part_number}</div>
                  </td>
                  <td><span className="badge badge-unknown">{p.part_group}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>{p.part_location?.replace(/_/g, ' ')}</td>
                  <td>{p.current_miles.toFixed(1)}</td>
                  <td>{p.avg_mbf ? p.avg_mbf.toFixed(1) : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="risk-bar">
                        <div
                          className="risk-bar-fill"
                          style={{
                            width: `${Math.min(p.risk_score * 100, 100)}%`,
                            background: RISK_COLORS[p.risk_label] || '#a0aec0',
                          }}
                        />
                      </div>
                      {(p.risk_score * 100).toFixed(0)}%
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${p.risk_label.toLowerCase()}`}>
                      {p.risk_label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── High Miles ────────────────────────────────────────────────────────────────
function HighMilesReport({ carId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-high-miles', carId],
    queryFn: () => reportHighMiles(carId, { limit: 30 }),
    enabled: !!carId,
  });

  const parts = data?.parts || [];

  if (isLoading) return <div className="loading">Loading…</div>;

  const chartData = parts.slice(0, 15).map((p) => ({
    name: p.part_name.length > 18 ? p.part_name.slice(0, 18) + '…' : p.part_name,
    miles: parseFloat(p.miles_used || 0),
  }));

  return (
    <div>
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Top Parts by Miles Used</h3>
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 60 }}>
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="miles" name="Miles" fill="var(--calsol-blue)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Part</th>
                <th>Group</th>
                <th>Location</th>
                <th>Miles Used</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p, i) => (
                <tr key={p.part_id}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>#{i + 1}</td>
                  <td>
                    <div>{p.part_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.part_number}</div>
                  </td>
                  <td><span className="badge badge-unknown">{p.part_group}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>{p.part_location?.replace(/_/g, ' ')}</td>
                  <td><strong>{parseFloat(p.miles_used || 0).toFixed(1)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Miles Between Failures ────────────────────────────────────────────────────
function MBFReport({ carId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-mbf', carId],
    queryFn: () => reportMBF(carId),
    enabled: !!carId,
  });

  const mbfData = data?.data || [];

  if (isLoading) return <div className="loading">Calculating MBF…</div>;

  if (mbfData.length === 0) {
    return (
      <div className="empty-state">
        <h3>No failure data yet</h3>
        <p>MBF is calculated from parts replaced due to "failure". Log some failures first.</p>
      </div>
    );
  }

  const chartData = mbfData.slice(0, 12).map((d) => ({
    name: d.part_name.length > 18 ? d.part_name.slice(0, 18) + '…' : d.part_name,
    avg: d.avg_miles_between_failures,
    min: d.min_miles_at_failure,
    max: d.max_miles_at_failure,
  }));

  return (
    <div>
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Average Miles Between Failures</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
          Sorted by lowest MBF (most failure-prone first).
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 60 }}>
            <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="avg" name="Avg MBF" fill="var(--calsol-gold)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Failures</th>
                <th>Avg MBF</th>
                <th>Min Miles</th>
                <th>Max Miles</th>
                <th>Current Active Miles</th>
                <th>% of Avg MBF</th>
              </tr>
            </thead>
            <tbody>
              {mbfData.map((d) => (
                <tr key={d.part_number}>
                  <td>
                    <div>{d.part_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.part_number}</div>
                  </td>
                  <td>{d.failure_count}</td>
                  <td><strong>{d.avg_miles_between_failures.toFixed(1)}</strong></td>
                  <td>{d.min_miles_at_failure.toFixed(1)}</td>
                  <td>{d.max_miles_at_failure.toFixed(1)}</td>
                  <td>
                    {d.current_active_miles.length > 0
                      ? d.current_active_miles.map((m) => m.toFixed(1)).join(', ')
                      : '—'}
                  </td>
                  <td>
                    {d.highest_active_pct_of_avg_mbf != null ? (
                      <span style={{
                        color: d.highest_active_pct_of_avg_mbf >= 100 ? 'var(--danger)'
                          : d.highest_active_pct_of_avg_mbf >= 80 ? 'var(--warning)'
                          : 'var(--success)',
                        fontWeight: 600,
                      }}>
                        {d.highest_active_pct_of_avg_mbf}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
