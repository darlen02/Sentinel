import { useState, useEffect } from 'react';
import type { User } from './types';
import { api, getStoredToken } from './services/api';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await api.getMe();
        setUser(userData);
      } catch (err) {
        // Token invalid or expired
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen to unauthorized event dispatched from api or ws
    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('sentinel:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('sentinel:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070a11] flex flex-col items-center justify-center text-slate-800 dark:text-slate-300">
        <Loader2 className="w-8 h-8 text-cyan-600 dark:text-cyan-400 animate-spin mb-3" />
        <span className="text-xs font-mono tracking-wider text-slate-500 dark:text-slate-400">SENTINEL BAŞLATILIYOR...</span>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
