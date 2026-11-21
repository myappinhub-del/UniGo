import React, { useEffect, useRef, useState } from 'react';
import {
  ConfirmationResult,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { syncUserProfile } from '../lib/unigoDb';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

type AuthMethod = 'email' | 'phone';
type EmailMode = 'signin' | 'register';

function normalizePhoneNumber(raw: string): string {
  const trimmed = raw.trim().replace(/[\s()-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (/^91\d{10}$/.test(trimmed)) return `+${trimmed}`;
  return `+${trimmed}`;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  title = 'Sign in to UniGo',
}) => {
  const [method, setMethod] = useState<AuthMethod>('email');
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');

  // Email / Password fields
  const [fullName, setFullName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone OTP fields
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneCustomerName, setPhoneCustomerName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const clearRecaptcha = () => {
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      recaptchaRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      clearRecaptcha();
      setConfirmationResult(null);
      setOtpCode('');
      setError(null);
      setInfoMsg(null);
    }
    return () => {
      clearRecaptcha();
    };
  }, [open]);

  if (!open) return null;

  const handleMethodChange = (next: AuthMethod) => {
    setMethod(next);
    setError(null);
    setInfoMsg(null);
    setConfirmationResult(null);
    setOtpCode('');
    clearRecaptcha();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return;

    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      if (emailMode === 'signin') {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        setPassword('');
        onClose();
      } else {
        const cleanName = fullName.trim();
        if (!cleanName) {
          setError('Please enter your full name to create your account.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );
        await updateProfile(cred.user, { displayName: cleanName }).catch(
          () => {}
        );
        await syncUserProfile({
          uid: cred.user.uid,
          email: cred.user.email || cleanEmail,
          displayName: cleanName,
          phoneNumber: registerPhone.trim(),
        });
        await sendEmailVerification(cred.user).catch(() => {});
        setPassword('');
        onClose();
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password login is not enabled yet. In Firebase Console -> Authentication -> Sign-in method, enable Email/Password.'
        );
      } else if (code === 'auth/email-already-in-use') {
        setError(
          'An account with this email already exists. Switch to Sign In to access it.'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError('Invalid email or password. Check your credentials and try again.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError(
          err instanceof Error ? err.message : 'Unable to complete sign in right now.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Enter your email address above first to receive a password link.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfoMsg(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setInfoMsg(
        `Password reset / setup email sent to ${cleanEmail}. Check your inbox.`
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        setError('No account found for this email address.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to send password reset email.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = normalizePhoneNumber(phoneInput);
    if (formatted.length < 10 || !/^\+\d{8,15}$/.test(formatted)) {
      setError(
        'Enter a valid 10-digit mobile number or include country code with +.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      clearRecaptcha();
      const verifier = new RecaptchaVerifier(auth, 'unigo-recaptcha-container', {
        size: 'invisible',
      });
      recaptchaRef.current = verifier;
      const result = await signInWithPhoneNumber(auth, formatted, verifier);
      setConfirmationResult(result);
      setInfoMsg(`Verification code sent to ${formatted}.`);
    } catch (err: unknown) {
      clearRecaptcha();
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Phone OTP login is not enabled yet. In Firebase Console -> Authentication -> Sign-in method, enable Phone.'
        );
      } else if (code === 'auth/invalid-phone-number') {
        setError('Please enter a valid mobile number with country code.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many verification attempts. Please try again in a few minutes.');
      } else if (code === 'auth/captcha-check-failed') {
        setError(
          'Phone verification security check failed. Ensure your app domain is authorized in Firebase Authentication Settings.'
        );
      } else {
        setError(
          err instanceof Error ? err.message : 'Unable to send SMS verification code.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || otpCode.trim().length < 4) return;
    setLoading(true);
    setError(null);

    try {
      const cred = await confirmationResult.confirm(otpCode.trim());
      const cleanName = phoneCustomerName.trim();
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName }).catch(
          () => {}
        );
      }
      await syncUserProfile({
        uid: cred.user.uid,
        email: cred.user.email || '',
        displayName: cleanName || cred.user.displayName || 'UniGo Customer',
        phoneNumber: cred.user.phoneNumber || normalizePhoneNumber(phoneInput),
      });
      clearRecaptcha();
      setConfirmationResult(null);
      setOtpCode('');
      onClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/invalid-verification-code') {
        setError('Incorrect verification code. Please check the SMS and try again.');
      } else if (code === 'auth/code-expired') {
        setError('Verification code expired. Request a new code.');
        setConfirmationResult(null);
      } else {
        setError(
          err instanceof Error ? err.message : 'Unable to verify OTP code.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setInfoMsg(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in with Google right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-neutral-200 shadow-xl relative my-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
          className="absolute right-4 top-4 w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <div className="text-xl font-extrabold tracking-tight text-[#16A34A] font-display">
            UniGo
          </div>
          <h2 className="text-lg font-bold text-[#222222] mt-1.5">{title}</h2>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Sign in with Email, Mobile Phone OTP, or Google. Staff &amp; Admins sign in using their assigned email and password.
          </p>
        </div>

        {/* Method Tabs: Email vs Phone */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F5F6F7] rounded-xl mb-4">
          <button
            type="button"
            onClick={() => handleMethodChange('email')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              method === 'email'
                ? 'bg-white text-[#222222] shadow-xs'
                : 'text-neutral-500 hover:text-[#222222]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>
          <button
            type="button"
            onClick={() => handleMethodChange('phone')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              method === 'phone'
                ? 'bg-white text-[#222222] shadow-xs'
                : 'text-neutral-500 hover:text-[#222222]'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Phone Number</span>
          </button>
        </div>

        {error && (
          <div className="mb-3.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
            {error}
          </div>
        )}

        {infoMsg && (
          <div className="mb-3.5 p-3 rounded-lg bg-[#16A34A]/10 border border-[#16A34A]/30 text-xs text-[#14532D] leading-relaxed">
            {infoMsg}
          </div>
        )}

        {method === 'email' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-neutral-100 pb-2">
              <button
                type="button"
                onClick={() => {
                  setEmailMode('signin');
                  setError(null);
                  setInfoMsg(null);
                }}
                className={`font-bold pb-1 border-b-2 transition-colors ${
                  emailMode === 'signin'
                    ? 'border-[#16A34A] text-[#16A34A]'
                    : 'border-transparent text-neutral-500'
                }`}
              >
                Existing Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailMode('register');
                  setError(null);
                  setInfoMsg(null);
                }}
                className={`font-bold pb-1 border-b-2 transition-colors ${
                  emailMode === 'register'
                    ? 'border-[#16A34A] text-[#16A34A]'
                    : 'border-transparent text-neutral-500'
                }`}
              >
                New Customer Signup
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {emailMode === 'register' && (
                <>
                  <div>
                    <label
                      htmlFor="unigo-register-name"
                      className="block text-[11px] font-bold text-[#222222] mb-1"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="unigo-register-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F5F6F7] border border-neutral-200 text-xs text-[#222222] focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="unigo-register-phone"
                      className="block text-[11px] font-bold text-[#222222] mb-1"
                    >
                      Mobile Number (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="unigo-register-phone"
                        type="tel"
                        value={registerPhone}
                        onChange={(e) => setRegisterPhone(e.target.value)}
                        placeholder="Enter mobile number"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F5F6F7] border border-neutral-200 text-xs text-[#222222] focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="unigo-login-email"
                  className="block text-[11px] font-bold text-[#222222] mb-1"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="unigo-login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F5F6F7] border border-neutral-200 text-xs text-[#222222] focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="unigo-login-password"
                    className="block text-[11px] font-bold text-[#222222]"
                  >
                    Password
                  </label>
                  {emailMode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => void handleSendPasswordReset()}
                      className="text-[11px] font-semibold text-[#16A34A] hover:underline"
                    >
                      Forgot / Set Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="unigo-login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={emailMode === 'register' ? 6 : undefined}
                    autoComplete={
                      emailMode === 'register'
                        ? 'new-password'
                        : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      emailMode === 'register'
                        ? 'Create password (6+ characters)'
                        : 'Enter password'
                    }
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#F5F6F7] border border-neutral-200 text-xs text-[#222222] focus:outline-none focus:border-[#16A34A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#222222] p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-[#111111] text-white font-semibold text-sm transition-colors disabled:opacity-60"
              >
                {loading
                  ? emailMode === 'register'
                    ? 'Creating account...'
                    : 'Signing in...'
                  : emailMode === 'register'
                  ? 'Create Customer Account'
                  : 'Sign In with Email'}
              </button>
            </form>
          </div>
        ) : !confirmationResult ? (
          <form onSubmit={handleSendOtp} className="space-y-3">
            <div>
              <label
                htmlFor="unigo-phone-name"
                className="block text-[11px] font-bold text-[#222222] mb-1"
              >
                Your Name (for new customers)
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="unigo-phone-name"
                  type="text"
                  value={phoneCustomerName}
                  onChange={(e) => setPhoneCustomerName(e.target.value)}
                  placeholder="Enter your name (optional)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F5F6F7] border border-neutral-200 text-xs text-[#222222] focus:outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="unigo-phone-number"
                className="block text-[11px] font-bold text-[#222222] mb-1"
              >
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="unigo-phone-number"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F5F6F7] border border-neutral-200 text-xs text-[#222222] focus:outline-none focus:border-[#16A34A]"
                />
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                Include country code with + for international numbers.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-[#111111] text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {loading ? 'Sending OTP...' : 'Send Verification OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setConfirmationResult(null);
                setOtpCode('');
                setError(null);
              }}
              className="text-xs font-semibold text-[#16A34A] flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change Phone Number</span>
            </button>

            <div>
              <label
                htmlFor="unigo-phone-otp"
                className="block text-[11px] font-bold text-[#222222] mb-1"
              >
                6-Digit SMS Code
              </label>
              <input
                id="unigo-phone-otp"
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit OTP"
                className="w-full px-3 py-2.5 rounded-xl bg-[#F5F6F7] border border-neutral-200 text-sm font-bold tracking-widest text-center text-[#222222] focus:outline-none focus:border-[#16A34A]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 4}
              className="w-full py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-[#111111] text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </form>
        )}

        {/* Invisible Recaptcha mount node */}
        <div id="unigo-recaptcha-container" />

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-[11px] font-medium text-neutral-400">
            or continue with
          </span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full py-2.5 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
        </button>

        <p className="text-[11px] text-neutral-400 text-center mt-4">
          Your account automatically opens your Customer, Partner, Franchise, or Admin portal.
        </p>
      </div>
    </div>
  );
};
