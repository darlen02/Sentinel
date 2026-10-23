import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Lock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
  Sliders,
} from 'lucide-react';
import type { User, UserRole, CreateUserData } from '../types';
import { api } from '../services/api';

interface UsersManagementProps {
  currentUser: User;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      showNotification(err.message || 'Kullanıcılar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.role === 'admin') {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [currentUser.role]);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newUsername.trim().length < 3) {
      setFormError('Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }
    if (newPassword.length < 6) {
      setFormError('Parola en az 6 karakter olmalıdır.');
      return;
    }

    setFormLoading(true);
    try {
      const payload: CreateUserData = {
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      };
      await api.createUser(payload);
      showNotification(`"${newUsername}" kullanıcısı başarıyla oluşturuldu.`, 'success');
      setIsModalOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('operator');
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Kullanıcı oluşturulurken bir hata oluştu.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser.id) {
      showNotification('Kendi hesabınızı silemezsiniz!', 'error');
      return;
    }

    if (!window.confirm(`"${user.username}" kullanıcısını silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await api.deleteUser(user.id);
      showNotification(`"${user.username}" kullanıcısı silindi.`, 'success');
      fetchUsers();
    } catch (err: any) {
      showNotification(err.message || 'Kullanıcı silinemedi', 'error');
    }
  };

  const handleRoleChange = async (user: User, role: UserRole) => {
    if (user.id === currentUser.id && role !== 'admin') {
      showNotification('Kendi yönetici rolünüzü düşüremezsiniz!', 'error');
      return;
    }

    try {
      await api.updateUserRole(user.id, role);
      showNotification(`"${user.username}" rolü "${role}" olarak güncellendi.`, 'success');
      fetchUsers();
    } catch (err: any) {
      showNotification(err.message || 'Rol güncellenemedi', 'error');
    }
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto my-12 shadow-sm">
        <Shield className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
          Yetki Kısıtlaması
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Kullanıcı ve yetki yönetimi paneline yalnızca <strong>Yönetici (Admin)</strong> yetkisine sahip kullanıcılar erişebilir. Mevcut rolünüz: <span className="font-semibold uppercase text-blue-600 dark:text-blue-400">{currentUser.role}</span>
        </p>
      </div>
    );
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const operatorCount = users.filter((u) => u.role === 'operator').length;
  const viewerCount = users.filter((u) => u.role === 'viewer').length;

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Toplam Kullanıcı</span>
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{users.length}</span>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Kullanıcı Ekle</span>
          </button>
        </div>

        {/* Admins */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Yöneticiler (Admin)</span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{adminCount}</span>
          </div>
        </div>

        {/* Operators */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Operatörler</span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{operatorCount}</span>
          </div>
        </div>

        {/* Viewers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">İzleyiciler (Salt-Okunur)</span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{viewerCount}</span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl flex items-center gap-2 text-xs animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      {/* Users Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Kayıtlı Kullanıcılar & Yetkiler</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sunucu yönetim paneline erişebilen tüm hesaplar ve izin seviyeleri
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
          >
            Yenile
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Kullanıcı</th>
                <th className="py-3 px-4">Rol & Yetki</th>
                <th className="py-3 px-4 hidden sm:table-cell">Kayıt Tarihi</th>
                <th className="py-3 px-4 hidden md:table-cell">Son Giriş</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {users.map((u) => {
                const isCurrent = u.id === currentUser.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                    {/* User */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs border border-slate-200 dark:border-slate-700">
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{u.username}</span>
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                                Siz
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">ID: #{u.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role Dropdown */}
                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                          u.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
                            : u.role === 'operator'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        <option value="admin">Yönetici (Admin)</option>
                        <option value="operator">Operatör</option>
                        <option value="viewer">İzleyici (Salt-Okunur)</option>
                      </select>
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 hidden sm:table-cell font-mono">
                      {new Date(u.created_at).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Last Login */}
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell font-mono">
                      {u.last_login ? (
                        new Date(u.last_login).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        <span className="text-slate-400 italic">Henüz giriş yapmadı</span>
                      )}
                    </td>

                    {/* Delete action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={isCurrent}
                        title={isCurrent ? 'Kendi hesabınızı silemezsiniz' : 'Kullanıcıyı Sil'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isCurrent
                            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Explanations Banner */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-slate-900 dark:text-slate-200 block mb-0.5">Yönetici (Admin)</strong>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Tam sistem erişimi. Kullanıcı oluşturabilir, roller atayabilir, Docker konteynerlerini durdurup başlatabilir ve süreçleri sonlandırabilir.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-slate-900 dark:text-slate-200 block mb-0.5">Operatör</strong>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Tüm metrikleri görebilir, Docker konteynerlerini yeniden başlatabilir ve süreçleri yönetebilir. Kullanıcı ekleyip silemez.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-slate-900 dark:text-slate-200 block mb-0.5">İzleyici (Viewer)</strong>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Yalnızca okuma (salt-okunur) erişimi. CPU, RAM, Disk, Ağ ve Konteynerleri izleyebilir ancak hiçbir değişiklik yapamaz.
            </p>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Yeni Kullanıcı Tanımla</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sunucu paneline erişecek yeni bir hesap ve yetki oluşturun</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kullanıcı Adı
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="ornek_kullanici"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Giriş Parolası (En az 6 karakter)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Yetki Rolü
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                >
                  <option value="operator">Operatör (Konteyner ve Süreç Kontrolü)</option>
                  <option value="viewer">İzleyici (Yalnızca İzleme - Salt-Okunur)</option>
                  <option value="admin">Yönetici (Admin - Tam Yetki)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formLoading}
                  className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {formLoading ? 'Oluşturuluyor...' : 'Hesabı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
