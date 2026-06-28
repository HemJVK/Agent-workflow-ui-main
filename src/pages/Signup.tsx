import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Loader2, Smartphone, Gift, Eye, EyeOff, Mail, KeyRound } from 'lucide-react';
import { setToken, setAuthUser } from '../utils/auth';
import { signInWithGoogle } from '../utils/firebase';

type Tab = 'phone' | 'email' | 'totp';

export default function Signup() {
  const [tab, setTab] = useState<Tab>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyUserId, setVerifyUserId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [totpSetupPending, setTotpSetupPending] = useState(false);
  const [showManualOtp, setShowManualOtp] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload: any = {};
      if (tab === 'phone') {
        if (!phone) throw new Error('Phone number is required');
        payload.phone_number = phone;
      } else if (tab === 'email') {
        payload.email = email;
        payload.password = password;
        if (phone) {
          payload.phone_number = phone;
        }
      } else if (tab === 'totp') {
        payload.email = email;
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      const data = await res.json();
      if (data.userId) {
        setVerifyUserId(data.userId);
        setError('');
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (_err: any) {
      setError(_err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyUserId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: verifyUserId, code: otpCode }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'OTP Verification failed');
      }
      const data = await res.json();

      if (tab === 'totp') {
        setTotpSetupPending(true);
        setVerifyUserId(null);
      } else {
        setToken(data.access_token);
        setAuthUser(data.user);
        navigate('/app');
      }
    } catch (_err: any) {
      setError(_err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!verifyUserId || resendCooldown > 0) return;
    try {
      await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: verifyUserId }),
      });
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
      setError('OTP resent successfully!');
      setTimeout(() => setError(''), 3000);
    } catch {
      setError('Failed to resend OTP');
    }
  };

  const handleGoogleSuccess = async () => {
    setLoading(true);
    setError('');
    try {
      const { idToken } = await signInWithGoogle();
      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      });
      if (!res.ok) throw new Error('Google sign-up failed');
      const data = await res.json();
      setToken(data.access_token);
      setAuthUser(data.user);
      navigate('/app');
    } catch (_err: any) {
      setError(_err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!verifyUserId || tab !== 'totp' || showManualOtp || totpSetupPending) return;

    let intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/verify-status?userId=${verifyUserId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified) {
          clearInterval(intervalId);
          setTotpSetupPending(true);
          setVerifyUserId(null);
        }
      } catch (err) {
        console.error('Error polling verification status:', err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [verifyUserId, tab, showManualOtp, totpSetupPending]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] opacity-40 mix-blend-screen pointer-events-none" />
      
      <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl relative z-10 shadow-2xl shadow-blue-500/10 hover:border-blue-500/30 transition-colors">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Zap size={24} className="text-white fill-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Agent Flow</span>
        </Link>
        
        <h2 className="text-3xl font-bold mb-2 text-center text-white">Create an Account</h2>
        <p className="text-gray-400 mb-6 text-center text-sm">Join the next generation workflow builder.</p>
        
        <div className="mb-8 p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-4">
           <Gift size={24} className="text-indigo-400 mt-1 shrink-0" />
           <div>
             <h4 className="text-sm font-semibold text-white">30 Free Monthly Credits</h4>
             <p className="text-xs text-indigo-200/70 mt-1">Enroll with a mobile number today and instantly unlock 30 free credits every month for premium nodes.</p>
           </div>
        </div>

        {error && <div className="mb-4 text-sm text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-500/20 text-center">{error}</div>}

        {totpSetupPending ? (
          <div className="space-y-4 animate-in fade-in zoom-in duration-500 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center mx-auto mb-4">
              <Zap size={32} className="text-blue-400 fill-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Email Verified!</h3>
            <p className="text-gray-400 text-sm">
              Your email <span className="text-white font-semibold">{email}</span> has been verified successfully.
            </p>
            <p className="text-gray-400 text-sm">
              Please click below to configure your Authenticator App and secure your account.
            </p>
            <button
              onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  const totpRes = await fetch('/api/auth/totp/setup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                  });
                  const totpData = await totpRes.json();
                  if (!totpRes.ok) throw new Error(totpData.message || 'Failed to initiate Authenticator setup');
                  navigate('/totp-setup', { state: { email, qrCodeUrl: totpData.qrCodeUrl } });
                } catch (err: any) {
                  setError(err.message);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50 text-sm"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Set Up Authenticator App'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </div>
        ) : (
          <>
            {!verifyUserId ? (
              <>
                {/* Tab bar */}
                <div className="flex bg-black/40 p-1 rounded-2xl mb-7 gap-0.5 border border-white/5">
                  {([
                    { id: 'phone', icon: <Smartphone size={13} />, label: 'Mobile' },
                    { id: 'email', icon: <Mail size={13} />, label: 'Email' },
                    { id: 'totp',  icon: <KeyRound size={13} />, label: 'Auth App' },
                  ] as { id: Tab; icon: React.ReactNode; label: string }[]).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTab(t.id);
                        setError('');
                        setVerifyUserId(null);
                        setTotpSetupPending(false);
                        setShowManualOtp(false);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                        tab === t.id
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  {tab === 'phone' && (
                    <>
                      <div className="flex flex-col items-center mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center mb-3">
                          <Smartphone size={26} className="text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Sign Up with Mobile</h3>
                        <p className="text-gray-400 text-xs mt-1 text-center">We'll send a one-time verification code via SMS</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
                        <div className="relative">
                          <Smartphone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white transition-all placeholder:text-gray-500 text-sm"
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                      </div>
                      <button
                        disabled={loading}
                        type="submit"
                        className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all text-sm"
                      >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Send OTP'}
                        {!loading && <ArrowRight size={18} />}
                      </button>
                    </>
                  )}

                  {tab === 'email' && (
                    <>
                      <div className="flex flex-col items-center mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center mb-3">
                          <Mail size={26} className="text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Sign Up with Email</h3>
                        <p className="text-gray-400 text-xs mt-1 text-center">Create a password-secured account with your email</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white transition-all placeholder:text-gray-500 text-sm"
                          placeholder="you@company.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                          <Smartphone size={14} className="text-indigo-400" /> Phone Number <span className="text-xs text-indigo-400/50">(Optional but recommended)</span>
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white transition-all placeholder:text-gray-500 text-sm"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white transition-all placeholder:text-gray-500 pr-12 text-sm"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <button
                        disabled={loading}
                        type="submit"
                        className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all text-sm"
                      >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign Up Free'}
                        {!loading && <ArrowRight size={18} />}
                      </button>
                    </>
                  )}

                  {tab === 'totp' && (
                    <>
                      <div className="flex flex-col items-center mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center mb-3">
                          <KeyRound size={26} className="text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Sign Up & Setup Authenticator</h3>
                        <p className="text-gray-400 text-xs mt-1 text-center">Verify your email and secure your account with TOTP</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white transition-all placeholder:text-gray-500 text-sm"
                          placeholder="you@company.com"
                        />
                      </div>
                      <button
                        disabled={loading}
                        type="submit"
                        className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all text-sm"
                      >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Register & Setup App'}
                        {!loading && <ArrowRight size={18} />}
                      </button>
                    </>
                  )}
                </form>
              </>
            ) : (
              tab === 'totp' && !showManualOtp ? (
                <div className="space-y-6 animate-in fade-in zoom-in duration-500 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Mail size={32} className="text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Verification Link Sent!</h3>
                  <p className="text-gray-400 text-sm">
                    We sent a secure verification link to <span className="text-white font-semibold">{email}</span>. Please click the link inside the email to automatically verify your account.
                  </p>
                  
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-1 bg-white/5 border border-white/5 rounded-xl max-w-max mx-auto px-3">
                    <Loader2 size={12} className="animate-spin text-blue-400" />
                    <span>Waiting for email link verification...</span>
                  </div>

                  <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManualOtp(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors py-1.5"
                    >
                      Enter 6-digit verification code manually
                    </button>
                    <div className="flex items-center justify-between mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyUserId(null);
                          setShowManualOtp(false);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors py-1.5"
                      >
                        Back to Sign Up
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendCooldown > 0}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors py-1.5 disabled:opacity-50"
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Link'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in zoom-in duration-500">
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-center mb-6">
                    <p className="text-sm text-blue-200">
                      We've sent a 6-digit verification code to your provided contact method. Check your terminal logs for the MOCK OTP.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 text-center">Enter OTP Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                      className="w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white transition-all"
                      placeholder="------"
                    />
                  </div>
                  <button
                    disabled={loading || otpCode.length !== 6}
                    type="submit"
                    className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : 'Verify & Continue'}
                    {!loading && <Zap size={18} className="fill-white" />}
                  </button>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyUserId(null);
                        setShowManualOtp(false);
                      }}
                      className="text-sm text-gray-400 hover:text-white transition-colors py-2"
                    >
                      Back to Sign Up
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors py-2 disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )
            )}

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  onClick={handleGoogleSuccess}
                  disabled={loading}
                  className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>
              </div>
            </div>
          </>
        )}

        <p className="mt-8 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 font-medium hover:text-blue-300 transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
