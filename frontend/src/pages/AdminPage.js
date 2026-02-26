import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listUsers, updateUser, listPartFields, createPartField } from '../api/client';
import toast from 'react-hot-toast';

const ROLES = ['admin', 'readonly'];
const STATUSES = ['active', 'rejected'];
const FIELD_TYPES = ['text', 'number', 'dropdown'];

export default function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('users');

  return (
    <div>
      <div className="page-header">
        <h2>👥 Admin Panel</h2>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid var(--border)' }}>
        {['users', 'fields'].map((t) => (
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
            {t === 'users' ? '👥 Users' : '🏷️ Custom Fields'}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab qc={qc} />}
      {tab === 'fields' && <FieldsTab qc={qc} />}
    </div>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ qc }) {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });
  const users = data?.users || [];

  const handleUpdate = async (userId, field, value) => {
    try {
      await updateUser(userId, { [field]: value });
      qc.invalidateQueries(['users']);
      toast.success('User updated');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Update failed');
    }
  };

  if (isLoading) return <div className="loading">Loading users…</div>;

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {u.picture && (
                      <img
                        src={u.picture}
                        alt={u.name}
                        style={{ width: 28, height: 28, borderRadius: '50%' }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span>{u.name}</span>
                  </div>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</td>
                <td>
                  <select
                    className="form-control"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                    value={u.role}
                    onChange={(e) => handleUpdate(u.user_id, 'role', e.target.value)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="form-control"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                    value={u.status}
                    onChange={(e) => handleUpdate(u.user_id, 'status', e.target.value)}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Custom Fields Tab ─────────────────────────────────────────────────────────
function FieldsTab({ qc }) {
  const [showForm, setShowForm] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [options, setOptions] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['part-fields'],
    queryFn: listPartFields,
  });
  const fields = data?.fields || [];

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const optionsArr = fieldType === 'dropdown'
        ? options.split(',').map((o) => o.trim()).filter(Boolean)
        : [];
      await createPartField({ field_name: fieldName, label, field_type: fieldType, options: optionsArr });
      toast.success('Field created!');
      qc.invalidateQueries(['part-fields']);
      setShowForm(false);
      setFieldName(''); setLabel(''); setFieldType('text'); setOptions('');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create field');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Custom fields appear on all part forms. Dropdown fields provide a pre-defined list of options.
        </p>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Field'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>New Custom Field</h3>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label>Field Name (internal key) *</label>
                <input className="form-control" required value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g. wrench_size" />
              </div>
              <div className="form-group">
                <label>Label (shown to users) *</label>
                <input className="form-control" required value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Wrench Size" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Field Type</label>
                <select className="form-control" value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {fieldType === 'dropdown' && (
                <div className="form-group">
                  <label>Options (comma-separated) *</label>
                  <input className="form-control" value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    placeholder="e.g. 10mm, 12mm, 14mm" />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create Field'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading fields…</div>
      ) : fields.length === 0 ? (
        <div className="empty-state">
          <h3>No custom fields yet</h3>
          <p>Add fields like "Wrench Size", "Thread", "Designer", etc.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Field Name</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Options</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.field_id}>
                    <td><code style={{ fontSize: '0.8rem' }}>{f.field_name}</code></td>
                    <td>{f.label}</td>
                    <td><span className="badge badge-unknown">{f.field_type}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {f.options?.length > 0 ? f.options.join(', ') : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{f.created_by}</td>
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
