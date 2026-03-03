import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logMiles, getMilesLog, editMilesLog } from '../api/client';
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
  const [editTarget, setEditTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['miles-log', carId],
    queryFn: () => getMilesLog(carId, { limit: 50 }),
    enabled: !!carId,
  });

  const log = data?.log || [];
  // The most recent entry is the first one (sorted descending by logged_at)
  const latestLogId = log.length > 0 ? log[0].log_id : null;

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
      qc.invalidateQueries(['miles', carId]);
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
                  {canWrite && <th></th>}
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
                    {canWrite && (
                      <td>
                        {entry.log_id === latestLogId ? (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setEditTarget(entry)}
                          >
                            Edit
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editTarget && (
        <EditSessionModal
          carId={carId}
          entry={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            qc.invalidateQueries(['miles-log', carId]);
            qc.invalidateQueries(['parts', carId]);
            qc.invalidateQueries(['miles', carId]);
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Edit Session Modal ────────────────────────────────────────────────────────
function EditSessionModal({ carId, entry, onClose, onSaved }) {
  const [miles, setMiles] = useState(parseFloat(entry.miles).toFixed(1));
  const [note, setNote] = useState(entry.note || '');
  const [testDate, setTestDate] = useState(entry.test_date || '');
  const [saving, setSaving] = useState(false);

  const originalMiles = parseFloat(entry.miles);
  const newMiles = parseFloat(miles);
  const delta = isNaN(newMiles) ? 0 : newMiles - originalMiles;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isNaN(newMiles) || newMiles <= 0) {
      toast.error('Miles must be a positive number');
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      if (newMiles !== originalMiles) payload.miles = newMiles;
      if (note !== (entry.note || '')) payload.note = note;
      if (testDate !== entry.test_date) payload.test_date = testDate;

      if (Object.keys(payload).length === 0) {
        toast('No changes made.');
        onClose();
        return;
      }

      const result = await editMilesLog(carId, entry.log_id, payload);
      toast.success(result.message || 'Session updated!');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Test Session</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: 16,
              }}
            >
              <strong>Logged at:</strong> {entry.logged_at?.slice(0, 16).replace('T', ' ')}
              &nbsp;·&nbsp;
              <strong>By:</strong> {entry.logged_by}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Miles Driven *</label>
                <input
                  className="form-control"
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  autoFocus
                  value={miles}
                  onChange={(e) => setMiles(e.target.value)}
                />
                {!isNaN(newMiles) && newMiles !== originalMiles && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      marginTop: 4,
                      color: delta > 0 ? 'var(--warning)' : 'var(--success)',
                    }}
                  >
                    {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} mi delta will be applied to all active parts
                  </div>
                )}
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
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Morning track session, highway test, etc."
              />
            </div>

            {!isNaN(newMiles) && newMiles !== originalMiles && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #f6e05e',
                  borderRadius: 'var(--radius)',
                  padding: '10px 12px',
                  fontSize: '0.8rem',
                  color: '#744210',
                }}
              >
                ⚠️ Changing miles will apply a <strong>{delta > 0 ? '+' : ''}{delta.toFixed(1)} mi</strong> delta
                to all currently active parts on this car. This cannot be undone.
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
