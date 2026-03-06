import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function PendingApprovalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '48px 40px',
        maxWidth: '520px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>☀️</div>
        <h1 style={{
          fontSize: '1.6rem',
          fontWeight: 700,
          color: '#1a1a2e',
          marginBottom: '12px',
        }}>
          Welcome to CalSol Inventory
        </h1>
        <div style={{
          display: 'inline-block',
          background: '#fff8e1',
          border: '1px solid #ffe082',
          borderRadius: '8px',
          padding: '6px 14px',
          fontSize: '0.85rem',
          color: '#f59e0b',
          fontWeight: 600,
          marginBottom: '24px',
        }}>
          ⏳ Pending Approval
        </div>
        <p style={{
          fontSize: '1.05rem',
          color: '#4b5563',
          lineHeight: 1.7,
          marginBottom: '32px',
        }}>
          Thank you for your interest — you will gain full access once you are
          approved by the software team.
        </p>
        {user && (
          <p style={{
            fontSize: '0.875rem',
            color: '#9ca3af',
            marginBottom: '28px',
          }}>
            Signed in as <strong style={{ color: '#6b7280' }}>{user.email}</strong>
          </p>
        )}
        <button
          onClick={handleLogout}
          style={{
            background: '#1a1a2e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 32px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
