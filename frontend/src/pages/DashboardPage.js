import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listParts, getMilesLog, reportLikelyToFail } from '../api/client';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { carId, cars } = useOutletContext();

  const { data: partsData } = useQuery({
    queryKey: ['parts', carId],
    queryFn: () => listParts(carId),
    enabled: !!carId,
  });

  const { data: milesData } = useQuery({
    queryKey: ['miles', carId],
    queryFn: () => getMilesLog(carId, { limit: 10 }),
    enabled: !!carId,
  });

  const { data: failData } = useQuery({
    queryKey: ['likely-fail', carId],
    queryFn: () => reportLikelyToFail(carId),
    enabled: !!carId,
  });

  const parts = partsData?.parts || [];
  const milesLog = milesData?.log || [];
  const atRisk = (failData?.parts || []).filter(
    (p) => p.risk_label === 'CRITICAL' || p.risk_label === 'HIGH'
  );

  const totalMiles = parts.reduce((sum, p) => {
    const m = parseFloat(p.miles_used || 0);
    return sum > m ? sum : m;
  }, 0);

  const groupCounts = parts.reduce((acc, p) => {
    acc[p.part_group] = (acc[p.part_group] || 0) + 1;
    return acc;
  }, {});

  if (!carId) {
    return (
      <div className="empty-state">
        <h3>No car selected</h3>
        <p>Select a car from the dropdown above, or <Link to="/cars">create one</Link>.</p>
      </div>
    );
  }

  const selectedCar = cars.find((c) => c.car_id === carId);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard — {selectedCar?.name || 'Car'}</h2>
        <Link to={`/cars/${carId}/miles`} className="btn btn-gold">
          + Log Miles
        </Link>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{parts.length}</div>
          <div className="stat-label">Active Parts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalMiles.toFixed(1)}</div>
          <div className="stat-label">Max Part Miles</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: atRisk.length > 0 ? 'var(--danger)' : undefined }}>
            {atRisk.length}
          </div>
          <div className="stat-label">At-Risk Parts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{milesLog.length}</div>
          <div className="stat-label">Recent Sessions</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* At-Risk Parts */}
        <div className="card">
          <div className="card-header">
            <h3>⚠️ At-Risk Parts</h3>
            <Link to={`/cars/${carId}/reports`} className="btn btn-outline btn-sm">
              Full Report
            </Link>
          </div>
          {atRisk.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No parts at high risk. 🎉</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Miles</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.slice(0, 5).map((p) => (
                  <tr key={p.part_id}>
                    <td>
                      <Link to={`/cars/${carId}/parts/${p.part_id}`}>
                        {p.part_name}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {p.part_number}
                      </div>
                    </td>
                    <td>{p.current_miles.toFixed(1)}</td>
                    <td>
                      <span className={`badge badge-${p.risk_label.toLowerCase()}`}>
                        {p.risk_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Miles Sessions */}
        <div className="card">
          <div className="card-header">
            <h3>📏 Recent Test Sessions</h3>
            <Link to={`/cars/${carId}/miles`} className="btn btn-outline btn-sm">
              View All
            </Link>
          </div>
          {milesLog.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No miles logged yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Miles</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {milesLog.slice(0, 6).map((m) => (
                  <tr key={m.log_id}>
                    <td>{m.test_date}</td>
                    <td>{parseFloat(m.miles).toFixed(1)}</td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Parts by Group */}
      <div className="card">
        <div className="card-header">
          <h3>🔩 Parts by Group</h3>
          <Link to={`/cars/${carId}/parts`} className="btn btn-outline btn-sm">
            View All Parts
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {Object.entries(groupCounts).map(([group, count]) => (
            <Link
              key={group}
              to={`/cars/${carId}/parts?group=${group}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="stat-card" style={{ minWidth: 120, cursor: 'pointer' }}>
                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{count}</div>
                <div className="stat-label">{group}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
