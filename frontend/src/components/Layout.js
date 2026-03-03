import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { listCars } from '../api/client';
import { useQuery } from '@tanstack/react-query';

export default function Layout() {
  const { user, logout, isAdmin, canWrite } = useAuth();
  const navigate = useNavigate();
  const [selectedCarId, setSelectedCarId] = useState(
    () => localStorage.getItem('calsol_car_id') || ''
  );

  const { data: carsData } = useQuery({
    queryKey: ['cars'],
    queryFn: listCars,
  });
  const cars = carsData?.cars || [];

  useEffect(() => {
    if (cars.length > 0 && !selectedCarId) {
      const first = cars[0].car_id;
      setSelectedCarId(first);
      localStorage.setItem('calsol_car_id', first);
    }
  }, [cars, selectedCarId]);

  const handleCarChange = (e) => {
    const id = e.target.value;
    setSelectedCarId(id);
    localStorage.setItem('calsol_car_id', id);
    navigate(`/cars/${id}/parts`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const carId = selectedCarId;

  // Role badge display
  const roleBadge = {
    admin: '🔑 ADMIN',
    normal: '✏️ NORMAL',
    readonly: '👁️ READ ONLY',
  }[user?.role] || user?.role?.toUpperCase();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>☀️ CalSol</h1>
          <p>Inventory Tracker</p>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>🏠 Dashboard</NavLink>
          <NavLink to="/cars">🚗 Cars</NavLink>

          {carId && (
            <>
              <div className="nav-section">Current Car</div>
              <NavLink to={`/cars/${carId}/parts`}>🔩 Parts</NavLink>
              {canWrite && (
                <NavLink to={`/cars/${carId}/miles`}>📏 Log Miles</NavLink>
              )}
              {!canWrite && (
                <NavLink to={`/cars/${carId}/miles`}>📏 Miles Log</NavLink>
              )}
              <NavLink to={`/cars/${carId}/history`}>📋 History</NavLink>
              <NavLink to={`/cars/${carId}/reports`}>📊 Reports</NavLink>
              {canWrite && (
                <NavLink to={`/cars/${carId}/upload`}>📤 Upload</NavLink>
              )}
            </>
          )}

          {/* All authenticated users can view the users page */}
          <div className="nav-section">{isAdmin ? 'Admin' : 'Team'}</div>
          <NavLink to="/admin">👥 Users</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div>{user?.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>
            {roleBadge}
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-car-select">
            <select value={selectedCarId} onChange={handleCarChange}>
              <option value="">— Select a car —</option>
              {cars.map((c) => (
                <option key={c.car_id} value={c.car_id}>
                  {c.name} {c.year ? `(${c.year})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="topbar-user">
            {user?.picture && (
              <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
            )}
            <span>{user?.name}</span>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="page-content">
          <Outlet context={{ carId, cars }} />
        </main>
      </div>
    </div>
  );
}
