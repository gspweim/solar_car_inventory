import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listParts, createPart, deletePart, listPartFields, replacePart, updatePart
} from '../api/client';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const GROUPS = ['suspension', 'drivetrain', 'engine', 'body', 'electrical', 'brakes', 'other'];
const LOCATIONS = [
  'front_right', 'front_left', 'rear_right', 'rear_left',
  'front_center', 'rear_center', 'center_center',
];
const REPLACE_REASONS = ['failure', 'upgrade', 'routine_maintenance', 'other'];

export default function PartsPage() {
  const { carId } = useParams();
  const { canWrite, canDelete } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [groupFilter, setGroupFilter] = useState(searchParams.get('group') || '');
  const [locationFilter, setLocationFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [editMilesTarget, setEditMilesTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['parts', carId, groupFilter, locationFilter],
    queryFn: () => listParts(carId, {
      ...(groupFilter && { group: groupFilter }),
      ...(locationFilter && { location: locationFilter }),
    }),
    enabled: !!carId,
  });

  const { data: fieldsData } = useQuery({
    queryKey: ['part-fields'],
    queryFn: listPartFields,
  });

  const parts = (data?.parts || []).filter((p) =>
    !search ||
    p.part_name.toLowerCase().includes(search.toLowerCase()) ||
    p.part_number.toLowerCase().includes(search.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: (partId) => deletePart(carId, partId),
    onSuccess: () => {
      qc.invalidateQueries(['parts', carId]);
      toast.success('Part deleted');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Delete failed'),
  });

  const handleDelete = (part) => {
    if (window.confirm(`Delete "${part.part_name}"? This cannot be undone.`)) {
      deleteMutation.mutate(part.part_id);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>🔩 Parts Inventory</h2>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Part
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          className="form-control"
          style={{ maxWidth: 220 }}
          placeholder="Search name or part #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-control"
          style={{ maxWidth: 160 }}
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="">All Groups</option>
          {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          className="form-control"
          style={{ maxWidth: 180 }}
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
        >
          <option value="">All Locations</option>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {parts.length} part{parts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="loading">Loading parts…</div>
      ) : parts.length === 0 ? (
        <div className="empty-state">
          <h3>No parts found</h3>
          <p>Add parts manually or upload a spreadsheet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Part #</th>
                  <th>Name</th>
                  <th>Group</th>
                  <th>Location</th>
                  <th>Miles Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.part_id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.part_number}</td>
                    <td>
                      <Link to={`/cars/${carId}/parts/${p.part_id}`}>{p.part_name}</Link>
                    </td>
                    <td><span className="badge badge-unknown">{p.part_group}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{p.part_location?.replace(/_/g, ' ')}</td>
                    <td>{parseFloat(p.miles_used || 0).toFixed(1)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Link
                          to={`/cars/${carId}/parts/${p.part_id}`}
                          className="btn btn-outline btn-sm"
                        >
                          Edit
                        </Link>
                        {canWrite && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setEditMilesTarget(p)}
                          >
                            Miles
                          </button>
                        )}
                        {canWrite && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setReplaceTarget(p)}
                          >
                            Replace
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(p)}
                          >
                            Del
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddPartModal
          carId={carId}
          fields={fieldsData?.fields || []}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            qc.invalidateQueries(['parts', carId]);
            setShowAddModal(false);
          }}
        />
      )}

      {replaceTarget && (
        <ReplacePartModal
          carId={carId}
          part={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onSaved={() => {
            qc.invalidateQueries(['parts', carId]);
            setReplaceTarget(null);
          }}
        />
      )}

      {editMilesTarget && (
        <EditMilesModal
          carId={carId}
          part={editMilesTarget}
          onClose={() => setEditMilesTarget(null)}
          onSaved={() => {
            qc.invalidateQueries(['parts', carId]);
            setEditMilesTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Add Part Modal ────────────────────────────────────────────────────────────
function AddPartModal({ carId, fields, onClose, onSaved }) {
  const [form, setForm] = useState({
    part_number: '', part_name: '', part_group: 'suspension',
    part_location: 'front_right', miles_used: 0,
    purchased_from: '', cost: '',
  });
  const [extraFields, setExtraFields] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createPart(carId, { ...form, extra_fields: extraFields });
      toast.success('Part added!');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add part');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add New Part</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Part Number *</label>
                <input className="form-control" required value={form.part_number}
                  onChange={(e) => set('part_number', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Part Name *</label>
                <input className="form-control" required value={form.part_name}
                  onChange={(e) => set('part_name', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Group *</label>
                <select className="form-control" value={form.part_group}
                  onChange={(e) => set('part_group', e.target.value)}>
                  {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Location *</label>
                <select className="form-control" value={form.part_location}
                  onChange={(e) => set('part_location', e.target.value)}>
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Miles Used</label>
                <input className="form-control" type="number" min="0" step="0.1"
                  value={form.miles_used}
                  onChange={(e) => set('miles_used', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Cost</label>
                <input className="form-control" value={form.cost}
                  onChange={(e) => set('cost', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Purchased From</label>
              <input className="form-control" value={form.purchased_from}
                onChange={(e) => set('purchased_from', e.target.value)} />
            </div>

            {/* Dynamic extra fields */}
            {fields.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0', paddingTop: '12px' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ADDITIONAL FIELDS
                  </strong>
                </div>
                {fields.map((f) => (
                  <div className="form-group" key={f.field_id}>
                    <label>{f.label}</label>
                    {f.field_type === 'dropdown' ? (
                      <select className="form-control"
                        value={extraFields[f.field_name] || ''}
                        onChange={(e) => setExtraFields((ef) => ({ ...ef, [f.field_name]: e.target.value }))}>
                        <option value="">— Select —</option>
                        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className="form-control"
                        type={f.field_type === 'number' ? 'number' : 'text'}
                        value={extraFields[f.field_name] || ''}
                        onChange={(e) => setExtraFields((ef) => ({ ...ef, [f.field_name]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Add Part'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Miles Modal ─────────────────────────────────────────────────────────
function EditMilesModal({ carId, part, onClose, onSaved }) {
  const [miles, setMiles] = useState(parseFloat(part.miles_used || 0).toFixed(1));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(miles);
    if (isNaN(val) || val < 0) {
      toast.error('Please enter a valid miles value (≥ 0)');
      return;
    }
    setSaving(true);
    try {
      await updatePart(carId, part.part_id, { miles_used: val });
      toast.success('Miles updated!');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Miles — {part.part_name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              <strong>Part #:</strong> {part.part_number} &nbsp;·&nbsp;
              <strong>Location:</strong> {part.part_location?.replace(/_/g, ' ')}
            </div>
            <div className="form-group">
              <label>Miles Used *</label>
              <input
                className="form-control"
                type="number"
                min="0"
                step="0.1"
                required
                autoFocus
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Current value: {parseFloat(part.miles_used || 0).toFixed(1)} mi
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Miles'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Replace Part Modal ────────────────────────────────────────────────────────
function ReplacePartModal({ carId, part, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [replaceWithSame, setReplaceWithSame] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) { toast.error('Please select a reason'); return; }
    setSaving(true);
    try {
      await replacePart(carId, part.part_id, {
        reason, note, replace_with_same: replaceWithSame,
      });
      toast.success('Part replaced and logged!');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Replace failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Replace Part: {part.part_name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Reason for Replacement *</label>
              <select className="form-control" value={reason}
                onChange={(e) => setReason(e.target.value)} required>
                <option value="">— Select reason —</option>
                {REPLACE_REASONS.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" rows={3} value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Describe what happened, what was observed, etc." />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={replaceWithSame}
                  onChange={(e) => setReplaceWithSame(e.target.checked)} />
                Replace with the same model (adds a new copy with 0 miles)
              </label>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong>Part:</strong> {part.part_number} — {part.part_name}<br />
              <strong>Current miles:</strong> {parseFloat(part.miles_used || 0).toFixed(1)}<br />
              <strong>Location:</strong> {part.part_location?.replace(/_/g, ' ')}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Processing…' : 'Confirm Replacement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
