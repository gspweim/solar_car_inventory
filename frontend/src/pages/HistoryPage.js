import { useState, useMemo } from 'react';
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
  const [sortCol, setSortCol] = useState('replaced_at');
  const [sortDir, setSortDir] = useState('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['history', carId, reasonFilter],
    queryFn: () => getPartHistory(carId, {
      ...(reasonFilter && { reason: reasonFilter }),
      limit: 200,
    }),
    enabled: !!carId,
  });

  const filtered = (data?.history || []).filter((h) =>
    !search ||
    h.part_name?.toLowerCase().includes(search.toLowerCase()) ||
    h.part_number?.toLowerCase().includes(search.toLowerCase())
  );

  const history = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortCol] ?? '';
      let bVal = b[sortCol] ?? '';
      if (sortCol === 'miles_at_retirement') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const thStyle = (col) => ({
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    color: sortCol === col ? 'var(--calsol-blue)' : undefined,
  });

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
                  <th style={thStyle('replaced_at')} onClick={() => handleSort('replaced_at')}>
                    Date{sortIcon('replaced_at')}
                  </th>
                  <th style={thStyle('part_number')} onClick={() => handleSort('part_number')}>
                    Part #{sortIcon('part_number')}
                  </th>
                  <th style={thStyle('part_name')} onClick={() => handleSort('part_name')}>
                    Part Name{sortIcon('part_name')}
                  </th>
                  <th style={thStyle('part_group')} onClick={() => handleSort('part_group')}>
                    Group{sortIcon('part_group')}
                  </th>
                  <th style={thStyle('part_location')} onClick={() => handleSort('part_location')}>
                    Location{sortIcon('part_location')}
                  </th>
                  <th style={thStyle('start_date')} onClick={() => handleSort('start_date')}>
                    Start Date{sortIcon('start_date')}
                  </th>
                  <th style={thStyle('end_date')} onClick={() => handleSort('end_date')}>
                    End Date{sortIcon('end_date')}
                  </th>
                  <th style={thStyle('miles_at_retirement')} onClick={() => handleSort('miles_at_retirement')}>
                    Miles{sortIcon('miles_at_retirement')}
                  </th>
                  <th style={thStyle('reason')} onClick={() => handleSort('reason')}>
                    Reason{sortIcon('reason')}
                  </th>
                  <th>Note</th>
                  <th style={thStyle('replaced_by')} onClick={() => handleSort('replaced_by')}>
                    Replaced By{sortIcon('replaced_by')}
                  </th>
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
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{h.start_date || '—'}</td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{h.end_date || '—'}</td>
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
