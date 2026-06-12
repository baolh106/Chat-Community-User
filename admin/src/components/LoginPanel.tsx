import ReCAPTCHA from 'react-google-recaptcha';
import { useRef } from 'react';

interface LoginPanelProps {
  password: string;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
  onCaptchaChange: (token: string | null) => void;
  error: string | null;
}

export const LoginPanel = ({
  password,
  onPasswordChange,
  onLogin,
  onCaptchaChange,
  error,
}: LoginPanelProps) => {
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  const handleLogin = () => {
    if (!recaptchaRef.current?.getValue()) {
      alert('Please complete reCAPTCHA');
      return;
    }
    onLogin();
  };

  return (
    <div className="login-panel">
      <label>Enter password</label>
      <input
        type="password"
        placeholder="Enter admin password..."
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%', marginBottom: '10px' }}
      />
      <div className="recaptcha-container">
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={recaptchaSiteKey}
          hl="en"
          onChange={(token: string | null) => onCaptchaChange(token)}
        />
      </div>
      {error && <p className="error-box">{error}</p>}
      <button onClick={handleLogin} className="login-button" style={{ width: '100%' }}>
        Log in
      </button>
    </div>
  );
};
