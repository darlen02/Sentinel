import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Info, Server } from 'lucide-react';
import { api } from '../services/api';
import type { User as UserType } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserType) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Lütfen kullanıcı adı ve parolanızı giriniz.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(username.trim(), password.trim());
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('admin');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070a11] flex items-center justify-center p-4 relative overflow-hidden select-none transition-colors">
      {/* Background Glowing Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #0284c7 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      <div className="w-full max-w-md relative z-10 animate-in fade-in duration-300">
        {/* Brand Card */}
        <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-3xl p-8 shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-cyan-950/20">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-indigo-600 shadow-xl shadow-cyan-500/25 mb-4 text-white">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono flex items-center justify-center gap-2">
              SENTINEL
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-sans font-semibold">
                CORE
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-500" />
              <span>Ubuntu Sunucu Yönetim & İzleme Paneli</span>
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 flex items-start gap-3 text-xs text-red-600 dark:text-red-400 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Güvenlik Parolası
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-cyan-600 via-cyan-500 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-lg shadow-cyan-600/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                <span>Güvenli Giriş Yap</span>
              )}
            </button>
          </form>

          {/* Quick Demo Hint */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>Varsayılan Giriş: <strong className="text-slate-800 dark:text-slate-200 font-mono">admin</strong> / <strong className="text-slate-800 dark:text-slate-200 font-mono">admin</strong></span>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 underline underline-offset-2 ml-1 cursor-pointer font-medium"
              >
                Doldur
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
              Brute-force koruması ve JWT şifreli oturum aktiftir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
