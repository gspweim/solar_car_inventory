import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import axios from 'axios';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleGoogleSuccess = async (tokenResponse) => {
    try {
      // Exchange access_token for id_token via Google userinfo
      // @react-oauth/google returns an access_token; we need to get the id_token
      // Use the credential flow (one-tap) instead for id_token
      toast.error('Use the Sign in with Google button below');
    } catch (err) {
      toast.error('Login failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>☀️ CalSol</h1>
        <p>Inventory Tracker — UC Berkeley Solar Car Team</p>
        <GoogleSignInButton onLogin={login} navigate={navigate} />
      </div>
    </div>
  );
}

function GoogleSignInButton({ onLogin, navigate }) {
  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      try {
        // Get user info to get the id_token equivalent
        // With implicit flow we get access_token; fetch userinfo
        const userInfo = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        // We need to send the id_token to our backend.
        // With @react-oauth/google credential flow we get credential (id_token)
        toast.error('Please use the credential (one-tap) flow. See LoginPage implementation note.');
      } catch {
        toast.error('Failed to get user info');
      }
    },
    onError: () => toast.error('Google login failed'),
  });

  // Better: use useGoogleLogin with credential flow
  return <CredentialLogin onLogin={onLogin} navigate={navigate} />;
}

function CredentialLogin({ onLogin, navigate }) {
  const { GoogleLogin } = require('@react-oauth/google');

  const handleSuccess = async (credentialResponse) => {
    const id_token = credentialResponse.credential;
    try {
      const user = await onLogin(id_token);
      toast.success(`Welcome, ${user.name}!`);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.error || 'Login failed';
      toast.error(msg);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => toast.error('Google login failed')}
        useOneTap
        theme="outline"
        size="large"
        text="signin_with"
        shape="rectangular"
      />
    </div>
  );
}
