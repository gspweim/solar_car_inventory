import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listCars, createCar, updateCar, deleteCar } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function CarsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editCar, setEditCar] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cars'],
    queryFn: listCars,
  });
  const cars = data?.cars || [];

  const handleDelete = async (car) => {
    if (!window.confirm(`Delete "${car.name}"? This will NOT delete its parts.`)) return;
    try {
      await deleteCar(car.car_id);
      qc.invalidateQueries(['cars']);
      toast.success('Car deleted');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>🚗 Cars</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { setEditCar(null); setShowModal(true); }}>
            + Add Car
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="loading">Loading…</div>
      ) : cars.length === 0 ? (
        <div className="empty-state">
          <h3>No cars yet</h3>
          {isAdmin && <p>Add your first car to get started.</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {cars.map((car) => (
            <div key={car.car_id} className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>{car.name}</h3>
                  {car.year && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{car.year}</div>}
                  {car.description && (
                    <p style={{ marginTop: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {car.description}
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Link to={`/cars/${car.car_id}/parts`} className="btn btn-primary btn-sm">
                  View Parts
                </Link>
                {isAdmin && (
                  <>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => { setEditCar(car); setShowModal(true); }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(car)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CarModal
          car={editCar}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            qc.invalidateQueries(['cars']);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function CarModal({ car, onClose, onSaved }) {
  const [name, setName] = useState(car?.name || '');
  const [description, setDescription] = useState(car?.description || '');
  const [year, setYear] = useState(car?.year || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (car) {
        await updateCar(car.car_id, { name, description, year });
        toast.success('Car updated!');
      } else {
        await createCar({ name, description, year });
        toast.success('Car created!');
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{car ? 'Edit Car' : 'Add Car'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Car Name *</label>
              <input className="form-control" required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zephyr" />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input className="form-control" value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2024" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" rows={2} value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Main race car, backup car, etc." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : car ? 'Save Changes' : 'Create Car'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
