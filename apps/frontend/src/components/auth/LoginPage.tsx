import React from 'react';
import { UserAccount } from '@cscc/shared';
import { apiClient, setStoredAuthToken } from '../../api/client';
import logoWeb from '../../assets/logo_web.png';
import { LogIn, Eye, EyeOff, Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onAuthenticated: (user: UserAccount, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.login(cleanEmail, password);
      setStoredAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Email hoặc mật khẩu không chính xác.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 py-8 text-slate-100 relative overflow-hidden">
      {/* Subtle decorative radial glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-600/15 blur-3xl" />

      <div className="w-full max-w-md z-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl overflow-hidden">
          {/* Brand Header */}
          <div className="border-b border-slate-800 bg-slate-950/60 px-6 py-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-20 items-center justify-center rounded-xl bg-white p-2 shadow-md">
              <img
                src={logoWeb}
                alt="Alkana Coating Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-lg font-extrabold tracking-wide text-white uppercase">
              ALKANA COATING
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              CS &amp; CC Automation System — Qui Trình Sơn &amp; Chi Phí
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Đăng nhập hệ thống / System Sign In</span>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-950/60 px-3.5 py-2.5 text-xs font-semibold text-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold text-slate-300 mb-1.5"
              >
                Email tài khoản / Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@alkana.vn"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3.5 py-2 text-xs font-semibold text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-slate-300 mb-1.5"
              >
                Mật khẩu / Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-10 py-2 text-xs font-semibold text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-2.5 top-2 rounded p-0.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-lg hover:bg-blue-500 disabled:opacity-50 transition"
              >
                <LogIn className="h-4 w-4" />
                <span>{loading ? 'Đang xác thực...' : 'Đăng nhập / Sign In'}</span>
              </button>
            </div>
          </form>

          {/* Footer info */}
          <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-3 text-center text-[11px] text-slate-400">
            Liên hệ Quản trị viên (ADMIN) nếu bạn cần cấp mới hoặc đặt lại mật khẩu.
          </div>
        </div>
      </div>
    </div>
  );
};

