import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import logo from "../../assets/logo.png";
import UniversityCombobox from '../shared/UniversityCombobox';
import CaptchaInput from '../shared/CaptchaInput';
import GithubUserAutocomplete from '../shared/GithubUserAutocomplete';
import { useConfirm } from '../shared/ConfirmDialog';

interface LoginProps {
  onLoginSuccess: (token: string, user: any, roles: any[]) => void;
}

const MOBILE_OAUTH_STARTED_KEY = 'mobile_oauth_started';
const MOBILE_OAUTH_PROCESSING_KEY = 'mobile_oauth_processing';
const loginLightThemeStyles = `
  .login-light-shell {
    background:
      linear-gradient(180deg, rgba(242, 112, 36, 0.08), rgba(255, 255, 255, 0) 240px),
      #f1f5f9;
    color: #0f172a;
  }
  .login-light-shell .glass-panel {
    background: #ffffff;
    border: 1px solid rgba(242, 112, 36, 0.18);
    box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08), inset 0 0 0 1px rgba(242, 112, 36, 0.04);
    backdrop-filter: none;
  }
  .login-light-shell .glass-panel:hover,
  .login-light-shell .glass-panel:focus-within {
    border-color: rgba(242, 112, 36, 0.36);
    box-shadow: 0 28px 90px rgba(15, 23, 42, 0.1), 0 0 28px rgba(242, 112, 36, 0.12);
  }
  .login-light-shell .text-primary-container,
  .login-light-shell .text-primary-fixed,
  .login-light-shell .text-cyan-400,
  .login-light-shell .text-blue-600 {
    color: #f27024;
    text-shadow: none;
  }
  .login-light-shell .text-on-surface-variant {
    color: #64748b;
  }
  .login-light-shell .logo-glow {
    animation: none;
    filter: drop-shadow(0 0 18px rgba(242, 112, 36, 0.25));
  }
  .login-light-shell .chip {
    color: #f27024;
    border-color: rgba(242, 112, 36, 0.24);
    background: rgba(242, 112, 36, 0.08);
    box-shadow: none;
    text-shadow: none;
  }
  .login-light-shell .cyber-input-wrapper::before {
    display: none;
    animation: none;
  }
  .login-light-shell .cyber-input-wrapper::after,
  .login-light-shell .cyber-input-wrapper:focus-within::after {
    background: #ffffff;
    transition: none;
  }
  .login-light-shell .terminal-prompt::before {
    color: #f27024;
    background: transparent;
    text-shadow: none;
  }
  .login-light-shell .scanline {
    display: none;
    animation: none;
  }
  .login-light-shell input,
  .login-light-shell select,
  .login-light-shell textarea,
  .login-light-shell .cyber-input {
    background-color: #ffffff !important;
    border-color: rgba(242, 112, 36, 0.24) !important;
    color: #0f172a !important;
    box-shadow: none !important;
  }
  .login-light-shell input::placeholder,
  .login-light-shell textarea::placeholder {
    color: #94a3b8;
  }
  .login-light-shell input:focus,
  .login-light-shell select:focus,
  .login-light-shell textarea:focus,
  .login-light-shell .cyber-input:focus {
    border-color: #f27024 !important;
    box-shadow: 0 0 0 2px rgba(242, 112, 36, 0.14) !important;
  }
  .login-light-shell .btn-primary {
    background: #f27024;
    color: #ffffff;
    border-color: #f27024;
    box-shadow: 0 10px 24px rgba(242, 112, 36, 0.22);
    text-shadow: none;
  }
  .login-light-shell .btn-primary:hover {
    background: #d95f1f;
    color: #ffffff;
    box-shadow: 0 14px 30px rgba(242, 112, 36, 0.28);
    transform: translateY(-1px);
  }
  .login-light-shell .btn-secondary {
    background: #ffffff;
    color: #334155;
    border-color: rgba(242, 112, 36, 0.22);
  }
  .login-light-shell .btn-secondary:hover {
    color: #f27024;
    border-color: #f27024;
    background: rgba(242, 112, 36, 0.05);
  }
  .login-light-shell .pt-2 > .space-y-2 > label {
    color: #f27024;
  }
  .login-light-shell .pt-2 > .space-y-2 > .flex > div:first-child {
    border: 1px solid rgba(242, 112, 36, 0.24);
    border-radius: 6px;
    background: #ffffff;
    box-shadow: inset 0 0 0 1px rgba(242, 112, 36, 0.04);
  }
  .login-light-shell .pt-2 > .space-y-2 > .flex > div:first-child svg {
    display: block;
  }
  .login-light-shell .pt-2 > .space-y-2 button {
    background: #fff7f2 !important;
    border-color: rgba(242, 112, 36, 0.26) !important;
    color: #f27024 !important;
    border-radius: 6px;
    box-shadow: none;
  }
  .login-light-shell .pt-2 > .space-y-2 button:hover {
    background: #f27024 !important;
    border-color: #f27024 !important;
    color: #ffffff !important;
  }
  .login-light-shell .pt-2 > .space-y-2 input {
    background: #ffffff !important;
    border-radius: 6px !important;
    border-color: rgba(242, 112, 36, 0.28) !important;
    color: #0f172a !important;
    letter-spacing: 0.22em;
    outline: none !important;
    box-shadow: none !important;
  }
  .login-light-shell .pt-2 > .space-y-2 input:hover {
    background: #ffffff !important;
    border-color: rgba(242, 112, 36, 0.42) !important;
  }
  .login-light-shell .pt-2 > .space-y-2 input:focus,
  .login-light-shell .pt-2 > .space-y-2 input:active {
    background: #ffffff !important;
    border-color: #f27024 !important;
    box-shadow: 0 0 0 2px rgba(242, 112, 36, 0.14) !important;
  }`;

export default function Login({ onLoginSuccess }: LoginProps) {
  const confirm = useConfirm();
  const [isRegister, setIsRegister] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [university, setUniversity] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');

  const [errorMessage, setErrorMessage] = useState(() => {
    return sessionStorage.getItem('login_error_persistent') || '';
  });

  const setError = (msg: string) => {
    setErrorMessage(msg);
    if (msg) {
      sessionStorage.setItem('login_error_persistent', msg);
      toast.error(msg);
    } else {
      sessionStorage.removeItem('login_error_persistent');
    }
  };
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [redirectTarget, setRedirectTarget] = useState<string>(() => {
    return sessionStorage.getItem('login_redirect_target') || '/guest-portal';
  });

  const handleSuccessRedirect = (target: string) => {
    sessionStorage.removeItem('login_redirect_target');
    navigate(target);
  };

  const [platform, setPlatform] = useState<string | null>(null);
  const [mobileRedirect, setMobileRedirect] = useState<string | null>(null);
  const [mobileApiUrl, setMobileApiUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [showMockGoogle, setShowMockGoogle] = useState(false);
  const [customEmailMode, setCustomEmailMode] = useState(false);
  const [mockGoogleEmail, setMockGoogleEmail] = useState('');
  const [mockGoogleName, setMockGoogleName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plat = params.get('platform');
    const redir = params.get('mobile_redirect');
    const apiU = params.get('api_url');
    const prov = params.get('provider');
    const redirect = params.get('redirect');

    if (plat || redir || prov) {
      sessionStorage.removeItem(MOBILE_OAUTH_STARTED_KEY);
      sessionStorage.removeItem(MOBILE_OAUTH_PROCESSING_KEY);
    }

    if (redirect) {
      setRedirectTarget(redirect);
      sessionStorage.setItem('login_redirect_target', redirect);
    }
    if (plat) {
      setPlatform(plat);
      localStorage.setItem('mobile_platform', plat);
    }
    if (redir) {
      setMobileRedirect(redir);
      localStorage.setItem('mobile_redirect', redir);
    }
    if (apiU) {
      setMobileApiUrl(apiU);
      localStorage.setItem('mobile_api_url', apiU);
    }
    if (prov) {
      setProvider(prov);
      localStorage.setItem('mobile_provider', prov);
    }

    // Clean query parameters from URL so that on reload/refresh they are gone!
    if (plat || redir || apiU || prov || redirect) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const getBaseUrl = () => {
    const localUrl = mobileApiUrl || localStorage.getItem('mobile_api_url');
    if (localUrl) return localUrl;

    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
      return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
    }

    // Fallback based on client hostname
    if (window.location.hostname.includes('seal-hackathon.io.vn') ||
      window.location.hostname.includes('vercel.app')) {
      return 'https://seal-management-system.onrender.com/api';
    }
    return 'http://localhost:5000/api';
  };

  const fetchCaptcha = async () => {
    try {
      const baseUrl = getBaseUrl();
      const res = await axios.get(`${baseUrl}/auth/captcha`);
      setCaptchaId(res.data.captchaId);
      setCaptchaSvg(res.data.captchaSvg);
      setCaptchaValue('');
    } catch (err) {
      console.error('Failed to fetch CAPTCHA:', err);
    }
  };

  useEffect(() => {
    if (isRegister) {
      fetchCaptcha();
    } else {
      setCaptchaSvg('');
      setCaptchaId('');
      setCaptchaValue('');
    }
  }, [isRegister]);

  const handleMobileRedirect = (token: string, user: any, roles: any[]) => {
    const plat = platform || localStorage.getItem('mobile_platform');
    const redir = mobileRedirect || localStorage.getItem('mobile_redirect');

    if (plat === 'mobile' && redir) {
      sessionStorage.setItem(MOBILE_OAUTH_PROCESSING_KEY, '1');
      localStorage.removeItem('mobile_platform');
      localStorage.removeItem('mobile_redirect');
      localStorage.removeItem('mobile_provider');
      localStorage.setItem('mobile_api_url', ''); // clean up API URL

      setPlatform(null);
      setProvider(null);
      setShowMockGoogle(false);

      const targetUrl = `${redir}?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}&roles=${encodeURIComponent(JSON.stringify(roles))}`;
      window.location.href = targetUrl;
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Check if redirect contains GitHub OAuth authorization code
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const expired = params.get('expired');
    const locked = params.get('locked');

    if (locked === 'true') {
      setError('Tài khoản của bạn đã bị khóa bởi Quản trị viên (Admin). Vui lòng liên hệ Admin để biết thêm chi tiết.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (expired === 'true') {
      setError('Phiên đăng nhập đã hết hạn hoặc tài khoản được đăng nhập từ thiết bị khác.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (code) {
      // Clear query params so we don't try to log in again on refresh
      window.history.replaceState({}, document.title, window.location.pathname);

      // Auto submit OAuth code to Backend
      const exchangeCode = async () => {
        setLoading(true);
        setError('');
        const baseUrl = getBaseUrl();
        try {
          const response = await axios.post(`${baseUrl}/auth/github`, {
            code,
            redirectUri: window.location.origin + '/login',
            isMock: false
          });
          const { token, user, roles } = response.data;
          if (handleMobileRedirect(token, user, roles || [])) {
            return;
          }
          if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'admin_view'))) {
            navigate('/admin');
          } else if (roles && roles.some((r: any) => r.role === 'judge')) {
            navigate('/grading');
          } else {
            handleSuccessRedirect(redirectTarget);
          }
          onLoginSuccess(token, user, roles || []);
        } catch (err: any) {
          console.error(err);
          if (err.response?.status === 409) {
            const confirmForce = await confirm({
              title: 'Xác nhận đăng nhập',
              message: 'Tài khoản của bạn đang được đăng nhập ở một thiết bị hoặc trình duyệt khác. Bạn có muốn tiếp tục đăng nhập và đóng phiên làm việc cũ không?',
              confirmText: 'Đồng ý',
              cancelText: 'Hủy',
              variant: 'warning'
            });
            if (confirmForce) {
              try {
                setLoading(true);
                const forceResponse = await axios.post(`${baseUrl}/auth/github`, {
                  code,
                  redirectUri: window.location.origin + '/login',
                  force: true,
                  isMock: false
                });
                const { token, user, roles } = forceResponse.data;
                if (handleMobileRedirect(token, user, roles || [])) {
                  return;
                }
                if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'admin_view'))) {
                  navigate('/admin');
                } else if (roles && roles.some((r: any) => r.role === 'judge')) {
                  navigate('/grading');
                } else {
                  handleSuccessRedirect(redirectTarget);
                }
                onLoginSuccess(token, user, roles || []);
                return;
              } catch (forceErr: any) {
                setError(forceErr.response?.data?.message || 'Không thể thực hiện đăng nhập đè.');
              }
            } else {
              setError('Đăng nhập bị hủy do phiên làm việc khác đang hoạt động.');
            }
          } else {
            setError(err.response?.data?.message || 'Lỗi xác thực GitHub bằng code.');
          }

          // Clear mobile session to prevent auto-redirect loop on error
          localStorage.removeItem('mobile_platform');
          localStorage.removeItem('mobile_redirect');
          localStorage.removeItem('mobile_provider');
          setPlatform(null);
          setProvider(null);
        } finally {
          setLoading(false);
        }
      };
      exchangeCode();
    }

    // Google OAuth implicit flow redirect check
    const hash = window.location.hash;
    if (hash && hash.includes('id_token=')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const idToken = hashParams.get('id_token');
      if (idToken) {
        // Mobile bridge has already returned from Google; prevent the auto-start
        // effect below from opening Google again after the hash is cleared.
        sessionStorage.setItem(MOBILE_OAUTH_PROCESSING_KEY, '1');
        localStorage.removeItem('mobile_provider');
        setProvider(null);

        // Clear hash
        window.history.replaceState({}, document.title, window.location.pathname);

        const loginWithGoogle = async () => {
          setLoading(true);
          setError('');
          const baseUrl = getBaseUrl();
          try {
            const response = await axios.post(`${baseUrl}/auth/google`, {
              idToken,
              isMock: false
            });
            const { token, user, roles } = response.data;
            if (handleMobileRedirect(token, user, roles || [])) {
              return;
            }
            if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'admin_view'))) {
              navigate('/admin');
            } else if (roles && roles.some((r: any) => r.role === 'judge')) {
              navigate('/grading');
            } else {
              handleSuccessRedirect(redirectTarget);
            }
            onLoginSuccess(token, user, roles || []);
          } catch (err: any) {
            console.error(err);
            if (err.response?.status === 409) {
              const confirmForce = await confirm({
                title: 'Xác nhận đăng nhập',
                message: 'Tài khoản của bạn đang được đăng nhập ở một thiết bị hoặc trình duyệt khác. Bạn có muốn tiếp tục đăng nhập và đóng phiên làm việc cũ không?',
                confirmText: 'Đồng ý',
                cancelText: 'Hủy',
                variant: 'warning'
              });
              if (confirmForce) {
                try {
                  setLoading(true);
                  const forceResponse = await axios.post(`${baseUrl}/auth/google`, {
                    idToken,
                    force: true,
                    isMock: false
                  });
                  const { token, user, roles } = forceResponse.data;
                  if (handleMobileRedirect(token, user, roles || [])) {
                    return;
                  }
                  if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'admin_view'))) {
                    navigate('/admin');
                  } else if (roles && roles.some((r: any) => r.role === 'judge')) {
                    navigate('/grading');
                  } else {
                    handleSuccessRedirect(redirectTarget);
                  }
                  onLoginSuccess(token, user, roles || []);
                  return;
                } catch (forceErr: any) {
                  setError(forceErr.response?.data?.message || 'Không thể thực hiện đăng nhập đè.');
                }
              } else {
                setError('Đăng nhập bị hủy do phiên làm việc khác đang hoạt động.');
              }
            } else {
              setError(err.response?.data?.message || 'Lỗi đăng nhập Google.');
            }

            // Clear mobile session to prevent auto-redirect loop on error
            localStorage.removeItem('mobile_platform');
            localStorage.removeItem('mobile_redirect');
            localStorage.removeItem('mobile_provider');
            setPlatform(null);
            setProvider(null);
          } finally {
            setLoading(false);
          }
        };
        loginWithGoogle();
      }
    }
  }, []);

  const handleOAuthClick = (provider: 'google' | 'github') => {
    setError('');
    const redirectUri = encodeURIComponent(window.location.origin + '/login');
    if (provider === 'google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '901479860432-9ejc1a1d1r71r9r8gm6bnftvkgb866ge.apps.googleusercontent.com';
      const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}&prompt=select_account`;
      window.location.href = googleAuthUrl;
    } else {
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23liz8uHIFRtgdwDwE';
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=read:user%20user:email&redirect_uri=${redirectUri}`;
      window.location.href = githubAuthUrl;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plat = platform || localStorage.getItem('mobile_platform');
    const prov = provider || localStorage.getItem('mobile_provider');
    const isCallback = window.location.hash.includes('id_token=') || params.has('code');
    const isProcessingMobileCallback = sessionStorage.getItem(MOBILE_OAUTH_PROCESSING_KEY) === '1';

    if (plat === 'mobile' && !isCallback && !isProcessingMobileCallback) {
      if (prov === 'google') {
        const startedProvider = sessionStorage.getItem(MOBILE_OAUTH_STARTED_KEY);
        if (startedProvider === 'google') {
          return;
        }
        sessionStorage.setItem(MOBILE_OAUTH_STARTED_KEY, 'google');

        const isLocal = window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname.includes('192.168.') ||
          window.location.hostname.includes('10.') ||
          window.location.hostname.includes('172.');
        if (isLocal) {
          setShowMockGoogle(true);
        } else {
          handleOAuthClick('google');
        }
      } else if (prov === 'github') {
        const startedProvider = sessionStorage.getItem(MOBILE_OAUTH_STARTED_KEY);
        if (startedProvider === 'github') {
          return;
        }
        sessionStorage.setItem(MOBILE_OAUTH_STARTED_KEY, 'github');
        handleOAuthClick('github');
      }
    }
  }, [platform, provider]);
  const handleMockGoogleLogin = async (selectedEmail: string, selectedName?: string) => {
    setLoading(true);
    setError('');
    const baseUrl = getBaseUrl();
    try {
      const name = selectedName || selectedEmail.split('@')[0];
      const response = await axios.post(`${baseUrl}/auth/google`, {
        email: selectedEmail,
        fullName: name,
        isMock: true
      });
      const { token, user, roles } = response.data;
      if (handleMobileRedirect(token, user, roles || [])) {
        return;
      }
      if (user.isSystemAdmin) {
        navigate('/admin');
      } else if (roles && roles.some((r: any) => r.role === 'judge')) {
        navigate('/grading');
      } else {
        handleSuccessRedirect(redirectTarget);
      }
      onLoginSuccess(token, user, roles || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Lỗi đăng nhập Google giả lập.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const baseUrl = getBaseUrl();

    try {
      if (isRegister) {
        if (!height || isNaN(Number(height))) {
          setError('Chiều cao hợp lệ là bắt buộc.');
          setLoading(false);
          return;
        }
        if (!weight || isNaN(Number(weight))) {
          setError('Cân nặng hợp lệ là bắt buộc.');
          setLoading(false);
          return;
        }
        const response = await axios.post(`${baseUrl}/auth/register`, {
          email,
          password,
          fullName,
          studentId,
          university,
          githubUsername,
          height: Number(height),
          weight: Number(weight),
          captchaId,
          captchaValue
        });

        // Auto-login if first user (API returns token directly)
        if (response.data.token) {
          const { token, user, roles } = response.data;
          if (handleMobileRedirect(token, user, roles || [])) {
            return;
          }
          if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'admin_view'))) {
            navigate('/admin');
          } else {
            handleSuccessRedirect(redirectTarget);
          }
          onLoginSuccess(token, user, roles || []);
        } else {
          setRegistrationSuccess(true);
          toast.success("Đăng ký tài khoản thành công! Vui lòng kiểm tra email để xác thực.");
        }
      } else {
        const response = await axios.post(`${baseUrl}/auth/login`, {
          email,
          password
        });
        const { token, user, roles } = response.data;
        if (handleMobileRedirect(token, user, roles)) {
          return;
        }
        // Redirect based on role
        if (user.isSystemAdmin || roles.some((r: any) => r.role === 'admin_view')) {
          navigate('/admin');
        } else if (roles.some((r: any) => r.role === 'judge')) {
          navigate('/grading');
        } else {
          handleSuccessRedirect(redirectTarget);
        }
        onLoginSuccess(token, user, roles);
      }
    } catch (err: any) {
      console.error(err);
      fetchCaptcha();
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        setIsVerificationPending(true);
      } else if (err.response?.status === 409) {
        const confirmForce = await confirm({
          title: 'Xác nhận đăng nhập',
          message: 'Tài khoản của bạn đang được đăng nhập ở một thiết bị hoặc trình duyệt khác. Bạn có muốn tiếp tục đăng nhập và đóng phiên làm việc cũ không?',
          confirmText: 'Đồng ý',
          cancelText: 'Hủy',
          variant: 'warning'
        });
        if (confirmForce) {
          try {
            setLoading(true);
            const forceResponse = await axios.post(`${baseUrl}/auth/login`, {
              email,
              password,
              force: true
            });
            const { token, user, roles } = forceResponse.data;
            if (handleMobileRedirect(token, user, roles || [])) {
              return;
            }
            if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'admin_view'))) {
              navigate('/admin');
            } else if (roles && roles.some((r: any) => r.role === 'judge')) {
              navigate('/grading');
            } else {
              handleSuccessRedirect(redirectTarget);
            }
            onLoginSuccess(token, user, roles || []);
            return;
          } catch (forceErr: any) {
            setError(forceErr.response?.data?.message || 'Không thể thực hiện đăng nhập đè.');
          }
        } else {
          setError('Đăng nhập bị hủy do phiên làm việc khác đang hoạt động.');
        }
      } else {
        setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (registrationSuccess || isVerificationPending) {
    return (
      <div className="login-light-shell min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 text-slate-900">
        <style dangerouslySetInnerHTML={{ __html: loginLightThemeStyles }} />
        <div className="glass-panel w-full max-w-md p-8 rounded-[6px] relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-linear-to-r from-transparent via-[#F27024] to-transparent opacity-80 animate-pulse"></div>

          <div className="w-24 h-24 mb-6 mx-auto relative">
            <img
              alt="SEAL Hackathon Logo"
              className="w-full h-full object-contain rounded-full logo-glow drop-shadow-[0_0_18px_rgba(242,112,36,0.25)]"
              src={logo}
            />
          </div>

          <div className="chip font-mono text-xs text-primary-container mb-4 bg-[#0a141d]/50">
            {isVerificationPending ? '[ACTIVATION_REQUIRED]' : '[SYSTEM_PENDING]'}
          </div>

          <h2 className="font-mono text-xl font-bold text-slate-900 mb-3 uppercase tracking-tight">
            {isVerificationPending ? 'PENDING_ACTIVATION' : 'NODE_VERIFICATION'}
          </h2>

          <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
            {isVerificationPending ? (
              <>
                Tài khoản chưa được kích hoạt. Một email chứa đường dẫn kích hoạt đã được gửi tới địa chỉ <span className="text-primary-container font-mono">{email}</span>. Vui lòng kiểm tra hộp thư của bạn (và cả mục thư rác) để hoàn tất việc xác thực tài khoản.
              </>
            ) : (
              <>
                Đăng ký thành công! Một email chứa đường dẫn kích hoạt đã được gửi tới địa chỉ <span className="text-primary-container font-mono">{email}</span>. Vui lòng kiểm tra hộp thư của bạn (và cả mục thư rác) để hoàn tất việc xác thực tài khoản.
              </>
            )}
          </p>

          <button
            onClick={() => {
              setIsRegister(false);
              setRegistrationSuccess(false);
              setIsVerificationPending(false);
            }}
            className="btn-primary w-full py-2.5 font-mono text-xs font-bold uppercase tracking-widest active:scale-95 transition-all duration-300 cursor-pointer"
          >
            QUAY LẠI ĐĂNG NHẬP
          </button>
        </div>
      </div>
    );
  }

  if (showMockGoogle) {
    return (
      <div className="login-light-shell min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 font-sans text-slate-900">
        <style dangerouslySetInnerHTML={{ __html: loginLightThemeStyles }} />
        <div className="w-full max-w-[450px] bg-white rounded-[6px] p-10 border border-primary/20 shadow-[0_20px_60px_rgba(15,23,42,0.08)] flex flex-col items-center">

          {/* Google Logo */}
          <div className="mb-4">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </div>

          <h2 className="text-2xl font-medium text-gray-900 text-center mb-1.5 tracking-tight">
            Chọn tài khoản Google
          </h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            để tiếp tục đến <span className="font-semibold text-gray-800">SEAL Hackathon</span>
          </p>

          {!customEmailMode ? (
            <div className="w-full flex flex-col">
              {/* Account list */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden mb-6">
                {[
                  { email: 'admin@gmail.com', name: 'System Admin', role: 'Hệ thống' },
                  { email: 'coordinator@gmail.com', name: 'Event Admin', role: 'Admin' },
                  { email: 'judge@gmail.com', name: 'Event Judge', role: 'Giám khảo' },
                  { email: 'student@gmail.com', name: 'Student Contestant', role: 'Thí sinh' },
                ].map((acc, index) => (
                  <button
                    key={acc.email}
                    onClick={() => handleMockGoogleLogin(acc.email, acc.name)}
                    disabled={loading}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 transition-colors text-left ${index > 0 ? 'border-t border-gray-100' : ''
                      }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                      {acc.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                        {acc.name}
                        <span className="text-[10px] bg-gray-100 text-gray-500 font-mono px-1.5 py-0.5 rounded-sm">
                          {acc.role}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{acc.email}</div>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => setCustomEmailMode(true)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 transition-colors text-left border-t border-gray-100"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-gray-600">
                    Sử dụng một tài khoản khác
                  </div>
                </button>
              </div>

              {/* Real OAuth option link */}
              <button
                type="button"
                onClick={() => {
                  setShowMockGoogle(false);
                  handleOAuthClick('google');
                }}
                disabled={loading}
                className="text-xs text-primary hover:text-[#d95f1f] hover:underline text-center font-medium py-2 self-center transition-all cursor-pointer"
              >
                Thử đăng nhập Google OAuth thật (có thể lỗi redirect_uri trên IP local)
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (mockGoogleEmail) {
                  handleMockGoogleLogin(mockGoogleEmail, mockGoogleName);
                }
              }}
              className="w-full flex flex-col space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider text-left">Email Google</label>
                <input
                  type="email"
                  required
                  placeholder="nhap-email-cua-ban@gmail.com"
                  value={mockGoogleEmail}
                  onChange={(e) => setMockGoogleEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider text-left">Họ và Tên (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={mockGoogleName}
                  onChange={(e) => setMockGoogleName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-hidden transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomEmailMode(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={loading || !mockGoogleEmail}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#d95f1f] active:scale-95 transition-all cursor-pointer"
                >
                  {loading ? 'Đang xử lý...' : 'Tiếp tục'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="login-light-shell min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 text-slate-900">
      <style dangerouslySetInnerHTML={{ __html: loginLightThemeStyles }} />

      <div className="glass-panel w-full max-w-md p-8 rounded-[6px] relative overflow-hidden z-10">

        {/* Top Rule */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-linear-to-r from-transparent via-[#F27024] to-transparent opacity-80"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-[#F27024] to-transparent opacity-30"></div>

        {/* Header Section */}
        <div className="text-center mb-6 flex flex-col items-center">
          <h1 className="font-mono text-3xl font-bold text-primary mb-2 tracking-tight uppercase">
            {isRegister ? 'Đăng ký Tài khoản' : 'Đăng nhập'}
          </h1>
          <p className="text-on-surface-variant text-xs font-sans">
            {isRegister}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-[6px] text-rose-700 text-xs font-mono flex items-center justify-between shadow-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-rose-500 hover:text-rose-700 font-bold ml-3 text-sm cursor-pointer shrink-0"
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {isRegister && (
            <>
              <div>
                <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="fullName">Họ và Tên</label>
                <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
                  <div className="relative terminal-prompt">
                    <input
                      type="text"
                      id="fullName"
                      required
                      placeholder="Nhập họ và tên đầy đủ của bạn"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="cyber-input relative z-10 w-full rounded-sm py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                    />
                    <div className="scanline"></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="studentId">Mã số Sinh viên</label>
                  <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
                    <div className="relative terminal-prompt">
                      <input
                        type="text"
                        id="studentId"
                        placeholder="Ví dụ: SE180xxx"
                        value={studentId}
                        onChange={e => setStudentId(e.target.value)}
                        className="cyber-input relative z-10 w-full rounded-sm py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                      />
                      <div className="scanline"></div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-primary-container opacity-80 mb-1">Trường Đại học</label>
                  <UniversityCombobox
                    value={university}
                    onChange={setUniversity}
                    inputClassName="cyber-input rounded-sm py-2 px-3 font-mono text-xs focus:ring-0"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="githubUsername">Tên tài khoản GitHub</label>
                <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
                  <div className="relative terminal-prompt">
                    <GithubUserAutocomplete
                      value={githubUsername}
                      onChange={setGithubUsername}
                      className="cyber-input relative z-10 w-full rounded-sm py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                      placeholder="Nhập tên tài khoản github"
                    />
                    <div className="scanline"></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="height">Chiều cao (cm) <span className="text-rose-500">*</span></label>
                  <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
                    <div className="relative terminal-prompt">
                      <input
                        type="number"
                        id="height"
                        required
                        placeholder="Ví dụ: 170"
                        value={height}
                        onChange={e => setHeight(e.target.value)}
                        className="cyber-input relative z-10 w-full rounded-sm py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                      />
                      <div className="scanline"></div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="weight">Cân nặng (kg) <span className="text-rose-500">*</span></label>
                  <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
                    <div className="relative terminal-prompt">
                      <input
                        type="number"
                        id="weight"
                        required
                        placeholder="Ví dụ: 60"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        className="cyber-input relative z-10 w-full rounded-sm py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                      />
                      <div className="scanline"></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="email">Địa chỉ Email</label>
            <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
              <div className="relative terminal-prompt">
                <input
                  type="email"
                  id="email"
                  required
                  placeholder="Nhập địa chỉ email của bạn"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="cyber-input relative z-10 w-full rounded-sm py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                />
                <div className="scanline"></div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-mono text-xs text-primary-container opacity-80" htmlFor="password">Mật khẩu</label>
              {!isRegister && (
                <Link to="/forgot-password" className="font-mono text-[10px] text-primary-container hover:underline hover:text-[#d95f1f] transition-colors">Quên mật khẩu?</Link>
              )}
            </div>
            <div className="relative cyber-input-wrapper rounded-sm overflow-hidden">
              <div className="relative terminal-prompt flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  required
                  placeholder="Nhập mật khẩu bảo mật của bạn"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="cyber-input relative z-10 w-full rounded-sm py-2 pl-11 pr-10 font-mono text-xs focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 z-20 text-primary-container opacity-60 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <div className="scanline"></div>
              </div>
            </div>
          </div>

          {/* CAPTCHA Verification */}
          {isRegister && captchaSvg && (
            <div className="pt-2">
              <CaptchaInput
                captchaSvg={captchaSvg}
                value={captchaValue}
                onChange={setCaptchaValue}
                onRefresh={fetchCaptcha}
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 font-mono text-xs font-bold uppercase tracking-widest active:scale-95 transition-all duration-300 mt-4 cursor-pointer"
          >
            {loading ? 'Đang xử lý...' : isRegister ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <span className="relative px-3 text-[10px] uppercase tracking-wider text-slate-500 bg-white font-mono">
            Hoặc
          </span>
        </div>

        <div className="grid grid-cols-1">
          <button
            type="button"
            onClick={() => handleOAuthClick('google')}
            className="btn-secondary flex items-center justify-center gap-2 py-2 font-mono text-xs cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-xs text-on-surface-variant font-sans">
            {isRegister ? 'Đã kích hoạt khóa truy cập?' : 'Chưa có tài khoản?'}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-primary hover:text-primary-hover underline font-mono text-xs ml-1.5 transition-colors duration-150 cursor-pointer"
            >
              {isRegister ? 'Đăng nhập ngay' : 'Đăng ký tài khoản mới'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}


