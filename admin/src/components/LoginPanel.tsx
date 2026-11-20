import ReCAPTCHA from 'react-google-recaptcha';
import { useRef, type FormEvent } from 'react';

interface LoginPanelProps {
  password: string;
  onPasswordChange: (value: string) => void;
  onLogin: () => Promise<boolean>;
  onCaptchaChange: (token: string | null) => void;
  error: string | null;
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export const LoginPanel = ({
  password,
  onPasswordChange,
  onLogin,
  onCaptchaChange,
  error,
}: LoginPanelProps) => {
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  // Token reCAPTCHA chỉ dùng được một lần: đăng nhập thất bại thì phải lấy token mới.
  const resetCaptcha = () => {
    recaptchaRef.current?.reset();
    onCaptchaChange(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isLoggedIn = await onLogin();
    if (!isLoggedIn) resetCaptcha();
  };

  return (
    <form className="login-panel" onSubmit={(event) => void handleSubmit(event)}>
      <label htmlFor="admin-password">Enter password</label>
      <input
        id="admin-password"
        type="password"
        placeholder="Enter admin password..."
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%', marginBottom: '10px' }}
      />
      <div className="recaptcha-container">
        {RECAPTCHA_SITE_KEY ? (
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={RECAPTCHA_SITE_KEY}
            hl="en"
            onChange={onCaptchaChange}
            onExpired={() => onCaptchaChange(null)}
            onErrored={() => onCaptchaChange(null)}
          />
        ) : (
          <p className="error-box" role="alert">reCAPTCHA configuration missing</p>
        )}
      </div>
      {error && <p className="error-box" role="alert">{error}</p>}
      <button type="submit" className="login-button" style={{ width: '100%' }}>
        Log in
      </button>
    </form>
  );
};
