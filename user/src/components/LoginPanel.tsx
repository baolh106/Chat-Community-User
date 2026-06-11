import ReCAPTCHA from 'react-google-recaptcha';
import { useRef } from 'react';

const TEST_RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

interface LoginPanelProps {
  nickname: string;
  onNicknameChange: (value: string) => void;
  onStartSession: () => void;
  onCaptchaChange: (token: string | null) => void;
  error: string | null;
}

export const LoginPanel = ({
  nickname,
  onNicknameChange,
  onStartSession,
  onCaptchaChange,
  error,
}: LoginPanelProps) => {
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || TEST_RECAPTCHA_SITE_KEY;

  const handleStartSession = () => {
    if (!recaptchaRef.current?.getValue()) {
      alert('Please complete reCAPTCHA');
      return;
    }
    onStartSession();
  };

  return (
    <div className="login-panel">
      <label htmlFor="nickname">Your nickname</label>
      <input
        id="nickname"
        value={nickname}
        style={{ marginBottom: '6px' }}
        onChange={(e) => onNicknameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
        placeholder="Enter nickname..."
        maxLength={15}
      />
      <div style={{ marginBottom: '10px', color: '#7a4a61', fontSize: '0.85rem' }}>2–15 characters</div>
      <div className="recaptcha-container">
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={recaptchaSiteKey}
          hl="en"
          onChange={(token: string | null) => onCaptchaChange(token)}
        />
      </div>
      <button onClick={handleStartSession}>Start chat</button>
      {error && <div className="error-box">{error}</div>}
    </div>
  );
};
