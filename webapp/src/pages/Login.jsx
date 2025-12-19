import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithPassword } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/account', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await loginWithPassword(password);
    setLoading(false);

    if (response?.error) {
      setError(response.error);
      return;
    }

    if (response?.token) {
      login(response.token, response.user || null);
      navigate('/account', { replace: true });
      return;
    }

    setError('Invalid server response. Please try again.');
  };

  return (
    <div className="p-4 text-text flex justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 bg-surface border border-border rounded-xl p-4"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Login</h1>
          <p className="text-subtext text-sm">Enter your password to continue.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full px-4 py-2 rounded-lg bg-primary text-background font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
