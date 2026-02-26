import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useQueryClient } from '@tanstack/react-query';
import { uploadSpreadsheet } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const { carId } = useParams();
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const base64 = await fileToBase64(file);
      const data = await uploadSpreadsheet(carId, file.name, base64);
      setResult(data);
      qc.invalidateQueries(['parts', carId]);
      if (data.imported_count > 0) {
        toast.success(`Imported ${data.imported_count} parts!`);
      } else {
        toast.error('No parts were imported. Check the errors below.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [carId, qc]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: !canWrite || uploading,
  });

  return (
    <div>
      <div className="page-header">
        <h2>📤 Upload Parts Spreadsheet</h2>
      </div>

      {!canWrite ? (
        <div className="error-msg">You need write access to upload parts.</div>
      ) : (
        <>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Upload Instructions</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.875rem' }}>
              Upload a <strong>.xlsx</strong> or <strong>.csv</strong> file with the following columns.
              Column names are case-insensitive and spaces/underscores are interchangeable.
            </p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Required</th>
                    <th>Valid Values</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>part_number</code></td><td>✅ Yes</td><td>Any string</td></tr>
                  <tr><td><code>part_name</code></td><td>✅ Yes</td><td>Any string</td></tr>
                  <tr><td><code>part_group</code></td><td>✅ Yes</td><td>suspension, drivetrain, engine, body, electrical, brakes, other</td></tr>
                  <tr><td><code>part_location</code></td><td>✅ Yes</td><td>front_right, front_left, rear_right, rear_left, front_center, rear_center, center_center</td></tr>
                  <tr><td><code>miles_used</code></td><td>No</td><td>Number (default 0)</td></tr>
                  <tr><td><code>purchased_from</code></td><td>No</td><td>Any string</td></tr>
                  <tr><td><code>cost</code></td><td>No</td><td>Any string</td></tr>
                  <tr><td><em>Any other column</em></td><td>No</td><td>Stored as extra_fields</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? 'var(--calsol-blue)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                padding: '48px 24px',
                textAlign: 'center',
                cursor: canWrite && !uploading ? 'pointer' : 'not-allowed',
                background: isDragActive ? '#ebf4ff' : 'var(--bg)',
                transition: 'all 0.2s',
              }}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
                  <p>Uploading and importing parts…</p>
                </div>
              ) : isDragActive ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📂</div>
                  <p>Drop the file here!</p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📤</div>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>
                    Drag & drop a spreadsheet here, or click to select
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Supports .xlsx, .xls, .csv
                  </p>
                </div>
              )}
            </div>
          </div>

          {result && (
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>Import Results</h3>
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--success)' }}>
                    {result.imported_count}
                  </div>
                  <div className="stat-label">Imported</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--text-muted)' }}>
                    {result.skipped_count}
                  </div>
                  <div className="stat-label">Skipped</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: result.error_count > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {result.error_count}
                  </div>
                  <div className="stat-label">Errors</div>
                </div>
              </div>

              {result.errors?.length > 0 && (
                <>
                  <h4 style={{ marginBottom: 8, color: 'var(--danger)' }}>Errors</h4>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Row</th><th>Part #</th><th>Reason</th></tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i}>
                            <td>{e.row}</td>
                            <td>{e.part_number || '—'}</td>
                            <td style={{ color: 'var(--danger)' }}>{e.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {result.skipped?.length > 0 && (
                <>
                  <h4 style={{ marginBottom: 8, marginTop: 16, color: 'var(--text-muted)' }}>Skipped Rows</h4>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Row</th><th>Reason</th></tr>
                      </thead>
                      <tbody>
                        {result.skipped.map((s, i) => (
                          <tr key={i}>
                            <td>{s.row}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
