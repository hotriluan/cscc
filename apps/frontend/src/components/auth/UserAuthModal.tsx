import React from 'react';
import { UserAccount, UserRole } from '@cscc/shared';
import { apiClient, setStoredAuthToken } from '../../api/client';
import {
  Shield,
  LogOut,
  X,
  KeyRound,
  CheckCircle2,
  UserCheck,
  Eye,
  EyeOff
} from 'lucide-react';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  currentRole: UserRole;
  onLogout: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  PROJECT_LEADER: '👔 Project Leader / Quản lý - Dự án (Full CS + CC)',
  SALES: '💼 Sales / Kinh doanh - Báo giá (Xem CS + CC)',
  TECHNICAL: '🛠️ Technical TA / Kỹ thuật viên (Chỉ CS — Ẩn giá)',
  ADMIN: '🛡️ Admin / Quản trị hệ thống (Toàn quyền)'
};

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentRole,
  onLogout
}) => {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPasswords, setShowPasswords] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.changePassword(
        currentRole,
        currentPassword,
        newPassword.trim()
      );
      setSuccessMsg(res.message || 'Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide">
                Thông tin Tài khoản &amp; Bảo mật
              </h3>
              <p className="text-xs text-slate-400">
                Account Profile &amp; Change Password
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

        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {/* Current User Profile Card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-emerald-800">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                Phiên đăng nhập hiện tại / Active Session
              </span>
              <span className="rounded-md bg-slate-900 px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                {currentUser.role}
              </span>
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              {currentUser.fullName}
            </div>
            <div className="text-xs font-mono font-semibold text-blue-900">
              {currentUser.email}
            </div>
            <div className="text-xs text-slate-700">
              {ROLE_LABELS[currentUser.role]}
            </div>
            {currentUser.salesmanName && (
              <div className="text-xs font-semibold text-indigo-800 pt-0.5">
                Sales man phụ trách / Assigned Salesman:{' '}
                <strong>{currentUser.salesmanName}</strong>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-800">
              ⚠️ {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Change Password Form */}
          <form
            onSubmit={handleChangePassword}
            className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-slate-800">
                <KeyRound className="h-4 w-4 text-blue-600" />
                <span>Đổi mật khẩu cá nhân / Change Password</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
              >
                {showPasswords ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    Ẩn mật khẩu
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Hiện mật khẩu
                  </>
                )}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu hiện tại / Current Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Nhập mật khẩu hiện tại..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu mới (Tối thiểu 6 ký tự)
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mật khẩu mới..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => {
                setStoredAuthToken(null);
                onLogout();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              Đăng xuất / Sign Out
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Đóng / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
