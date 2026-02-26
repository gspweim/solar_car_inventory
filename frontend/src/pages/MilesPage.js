import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logMiles, getMilesLog } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function MilesPage() {
  const { carId } = useParams();
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [miles, setMiles] = useState('');
  const [note, setNote] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['miles-log', carId],
    queryFn: () => getMilesLog(carId, { limit: 50 }),
    enabled: !!carId,
  });

  const log = data?.log || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!miles || parseFloat(miles) <= 0) {
      toast.error('Enter a positive miles value');
      return;
    }
    setSubmitting(true);
    try {
      const result = await logMiles(carId, {
        miles: parseFloat(miles),
        note,
        test_date: testDate,
      });
      toast.success(result.message);
      setMiles('');
      setNote('');
      qc.invalidateQueries(['miles-log', carId]);
      qc.invalidateQueries(['parts', carId]);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to log miles');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>📏 Log Test Miles</h2>
      </div>

      {canWrite && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h3 style={{ marginBottom: 16 }}>New Test Session</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Miles Driven *</label>
                <input
                  className="form-control"
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="e.g. 12.5"
                  value={miles}
                  onChange={(e) => setMiles(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Test Date</label>
                <input
                  className="form-control"
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Morning track session, highway test, etc."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-gold" disabled={submitting}>
              {submitting ? 'Logging…' : '+ Log Miles'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Test Session History</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {log.length} session{log.length !== 1 ? 's' : ''}
            {data?.total_miles_shown ? ` · ${data.total_miles_shown} total miles shown` : ''}
          </span>
        </div>
        {isLoading ? (
          <div className="loading">Loading…</div>
        ) : log.length === 0 ? (
          <div className="empty-state">
            <h3>No sessions logged yet</h3>
            <p>Log your first test session above.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Miles</th>
                  <th>Note</th>
                  <th>Logged By</th>
                  <th>Logged At</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry) => (
                  <tr key={entry.log_id}>
                    <td>{entry.test_date}</td>
                    <td><strong>{parseFloat(entry.miles).toFixed(1)}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{entry.note || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{entry.logged_by}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {entry.logged_at?.slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
