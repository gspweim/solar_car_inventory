import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPartHistory } from '../api/client';

const REASONS = ['failure', 'upgrade', 'routine_maintenance', 'other'];

const reasonBadge = {
  failure: 'badge-critical',
  upgrade: 'badge-low',
  routine_maintenance: 'badge-medium',
  other: 'badge-unknown',
};

export default function HistoryPage() {
  const { carId } = useParams();
  const [reasonFilter, setReasonFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['history', carId, reasonFilter],
    queryFn: () => getPartHistory(carId, {
      ...(reasonFilter && { reason: reasonFilter }),
      limit: 200,
    }),
    enabled: !!carId,
  });

  const history = (data?.history || []).filter((h) =>
    !search ||
    h.part_name?.toLowerCase().includes(search.toLowerCase()) ||
    h.part_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h2>📋 Part Replacement History</h2>
      </div>

      <div className="filter-bar">
        <input
          className="form-control"
          style={{ maxWidth: 220 }}
          placeholder="Search part name or #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-control"
          style={{ maxWidth: 200 }}
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
        >
          <option value="">All Reasons</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {history.length} record{history.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="loading">Loading history…</div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <h3>No replacement history yet</h3>
          <p>History is recorded when you replace a part from the Parts page.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Part #</th>
                  <th>Part Name</th>
                  <th>Group</th>
                  <th>Location</th>
                  <th>Miles at Retirement</th>
                  <th>Reason</th>
                  <th>Note</th>
                  <th>Replaced By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.history_id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{h.replaced_at?.slice(0, 10)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{h.part_number}</td>
                    <td>{h.part_name}</td>
                    <td><span className="badge badge-unknown">{h.part_group}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{h.part_location?.replace(/_/g, ' ')}</td>
                    <td><strong>{parseFloat(h.miles_at_retirement || 0).toFixed(1)}</strong></td>
                    <td>
                      <span className={`badge ${reasonBadge[h.reason] || 'badge-unknown'}`}>
                        {h.reason?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.note || '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{h.replaced_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
