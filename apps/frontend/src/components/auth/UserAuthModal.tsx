import React from 'react';
import { UserAccount, UserRole } from '@cscc/shared';
import { apiClient, setStoredAuthToken } from '../../api/client';
import {
  Shield,
  LogIn,
  LogOut,
  Users,
  Plus,
  Trash2,
  X,
  KeyRound,
  CheckCircle2
} from 'lucide-react';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  currentRole: UserRole;
  onAuthenticated: (user: UserAccount, token: string) => void;
  onLogout: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  PROJECT_LEADER: '👔 Quản lý / Project Leader (Full CS + CC)',
  SALES: '💼 Kinh doanh / Sales (Xem CS + CC)',
  TECHNICAL: '🛠️ Kỹ thuật viên / Technical TA (Chỉ CS — Ẩn giá)',
  ADMIN: '🛡️ Quản trị hệ thống / Admin (Toàn quyền)'
};

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentRole,
  onAuthenticated,
  onLogout
}) => {
  const [activeTab, setActiveTab] = React.useState<'LOGIN' | 'USERS'>('LOGIN');
  const [email, setEmail] = React.useState('leader@alkana.vn');
  const [password, setPassword] = React.useState('123456');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // PostgreSQL User list & create form
  const [users, setUsers] = React.useState<UserAccount[]>([]);
  const [newEmail, setNewEmail] = React.useState('');
  const [newFullName, setNewFullName] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('123456');
  const [newRole, setNewRole] = React.useState<UserRole>('TECHNICAL');

  const loadUsers = React.useCallback(async () => {
    try {
      const list = await apiClient.getUsers(currentRole);
      setUsers(list);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [currentRole]);

  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      loadUsers();
    }
  }, [isOpen, loadUsers]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiClient.login(email.trim(), password);
      setStoredAuthToken(res.token);
      onAuthenticated(res.user, res.token);
      setSuccessMsg(`Đăng nhập thành công: ${res.user.fullName} (${res.user.role})`);
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (targetEmail: string) => {
    setEmail(targetEmail);
    setPassword('123456');
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.login(targetEmail, '123456');
      setStoredAuthToken(res.token);
      onAuthenticated(res.user, res.token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newFullName.trim()) {
      setError('Vui lòng nhập đầy đủ Email và Họ tên.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiClient.saveUser(currentRole, {
        email: newEmail.trim(),
        fullName: newFullName.trim(),
        password: newPassword.trim() || '123456',
        role: newRole
      });
      setNewEmail('');
      setNewFullName('');
      setNewPassword('123456');
      await loadUsers();
      setSuccessMsg('Đã lưu tài khoản vào bảng User (PostgreSQL)!');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide">
                Xác thực Tài khoản & Phân quyền RBAC (PostgreSQL User Table)
              </h3>
              <p className="text-xs text-slate-400">
                Hỗ trợ song song Đăng nhập JWT thực tế & Chuyển nhanh vai trò (Role Switcher)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('LOGIN')}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-bold border-b-2 transition ${
              activeTab === 'LOGIN'
                ? 'border-blue-600 bg-white text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Đăng nhập (JWT Session)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('USERS')}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-bold border-b-2 transition ${
              activeTab === 'USERS'
                ? 'border-blue-600 bg-white text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Danh sách Tài khoản PostgreSQL ({users.length})
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-800">
              ⚠️ {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {successMsg}
            </div>
          )}

          {currentUser && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
              <div>
                <div className="text-[11px] font-bold uppercase text-emerald-700">
                  Đang đăng nhập phiên JWT
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {currentUser.fullName} ({currentUser.email})
                </div>
                <div className="text-xs text-slate-600">
                  Vai trò gốc: <strong>{currentUser.role}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStoredAuthToken(null);
                  onLogout();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Đăng xuất
              </button>
            </div>
          )}

          {activeTab === 'LOGIN' ? (
            <div className="space-y-5">
              <form onSubmit={handleLogin} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email đăng nhập
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="leader@alkana.vn"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mật khẩu (Mặc định: 123456)
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    <LogIn className="h-4 w-4" />
                    {loading ? 'Đang xác thực...' : 'Đăng nhập với PostgreSQL'}
                  </button>
                </div>
              </form>

              {/* Quick 1-click Demo Login Cards from PostgreSQL User Table */}
              <div>
                <div className="mb-2 text-xs font-bold text-slate-700">
                  Đăng nhập nhanh 1-Click từ bảng <code className="rounded bg-slate-100 px-1.5 py-0.5 text-blue-800">User</code> trong PostgreSQL (Mật khẩu: <code className="rounded bg-slate-100 px-1">123456</code>):
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {users.map((u) => {
                    const isCurrent = currentUser?.email === u.email;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={loading}
                        onClick={() => handleQuickLogin(u.email)}
                        className={`flex flex-col items-start justify-between rounded-xl border p-3 text-left transition ${
                          isCurrent
                            ? 'border-emerald-500 bg-emerald-50/70'
                            : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-mono text-xs font-bold text-blue-900">
                            {u.email}
                          </span>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white">
                            {u.role}
                          </span>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-800">
                          {u.fullName}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {ROLE_LABELS[u.role]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveUser}
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5"
              >
                <input
                  type="email"
                  placeholder="Email (vd: user@alkana.vn)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Mật khẩu (123456)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold"
                >
                  <option value="PROJECT_LEADER">PROJECT_LEADER</option>
                  <option value="SALES">SALES</option>
                  <option value="TECHNICAL">TECHNICAL</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm / Cập nhật
                </button>
              </form>

              <table className="w-full border-collapse text-xs">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="border border-slate-700 px-3 py-2 text-left">Email</th>
                    <th className="border border-slate-700 px-3 py-2 text-left">Họ và Tên</th>
                    <th className="border border-slate-700 px-3 py-2 text-center">Role</th>
                    <th className="border border-slate-700 px-3 py-2 text-center w-24">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2 font-mono font-bold text-blue-900">
                        {u.email}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 font-semibold">
                        {u.fullName}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-bold text-slate-800">
                          {u.role}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiClient.deleteUser(currentRole, u.id);
                              await loadUsers();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            }
                          }}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                          title="Xóa tài khoản"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

