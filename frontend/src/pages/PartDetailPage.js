import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPart, updatePart, listPartFields } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const GROUPS = ['suspension', 'drivetrain', 'engine', 'body', 'electrical', 'brakes', 'other'];
const LOCATIONS = [
  'front_right', 'front_left', 'rear_right', 'rear_left',
  'front_center', 'rear_center', 'center_center',
];

export default function PartDetailPage() {
  const { carId, partId } = useParams();
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [extraFields, setExtraFields] = useState({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['part', carId, partId],
    queryFn: () => getPart(carId, partId),
    onSuccess: (d) => {
      setForm({ ...d.part });
      setExtraFields(d.part.extra_fields || {});
    },
  });

  const { data: fieldsData } = useQuery({
    queryKey: ['part-fields'],
    queryFn: listPartFields,
  });

  const part = data?.part;
  const fields = fieldsData?.fields || [];

  const startEdit = () => {
    setForm({ ...part });
    setExtraFields(part.extra_fields || {});
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updatePart(carId, partId, { ...form, extra_fields: extraFields });
      qc.invalidateQueries(['part', carId, partId]);
      qc.invalidateQueries(['parts', carId]);
      toast.success('Part updated!');
      setEditing(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) return <div className="loading">Loading…</div>;
  if (error || !part) return (
    <div className="error-msg">Part not found. <Link to={`/cars/${carId}/parts`}>Back to parts</Link></div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to={`/cars/${carId}/parts`} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ← Back to Parts
          </Link>
          <h2 style={{ marginTop: 4 }}>{part.part_name}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {part.part_number} · {part.part_group} · {part.part_location?.replace(/_/g, ' ')}
          </div>
        </div>
        {canWrite && !editing && (
          <button className="btn btn-primary" onClick={startEdit}>Edit Part</button>
        )}
      </div>

      {!editing ? (
        <div>
          {/* Core fields */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Part Details</h3>
            <div className="form-row">
              <Field label="Part Number" value={part.part_number} />
              <Field label="Part Name" value={part.part_name} />
              <Field label="Group" value={part.part_group} />
              <Field label="Location" value={part.part_location?.replace(/_/g, ' ')} />
              <Field label="Miles Used" value={parseFloat(part.miles_used || 0).toFixed(1)} />
              <Field label="Status" value={part.active ? '✅ Active' : '🔴 Retired'} />
              <Field label="Purchased From" value={part.purchased_from || '—'} />
              <Field label="Cost" value={part.cost || '—'} />
            </div>
          </div>

          {/* Extra fields */}
          {Object.keys(part.extra_fields || {}).length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Additional Fields</h3>
              <div className="form-row">
                {Object.entries(part.extra_fields).map(([k, v]) => (
                  <Field key={k} label={k.replace(/_/g, ' ')} value={v} />
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Metadata</h3>
            <div className="form-row">
              <Field label="Created By" value={part.created_by} />
              <Field label="Created At" value={part.created_at?.slice(0, 10)} />
              <Field label="Last Updated" value={part.updated_at?.slice(0, 10)} />
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Edit Part</h3>
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
                <label>Group</label>
                <select className="form-control" value={form.part_group}
                  onChange={(e) => set('part_group', e.target.value)}>
                  {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Location</label>
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
                <input className="form-control" value={form.cost || ''}
                  onChange={(e) => set('cost', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Purchased From</label>
              <input className="form-control" value={form.purchased_from || ''}
                onChange={(e) => set('purchased_from', e.target.value)} />
            </div>

            {/* Dynamic extra fields */}
            {fields.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0', paddingTop: '12px' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ADDITIONAL FIELDS</strong>
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
                      <input className="form-control"
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
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={cancelEdit}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
        {label}
      </div>
      <div>{value || '—'}</div>
    </div>
  );
}
