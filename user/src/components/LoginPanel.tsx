import ReCAPTCHA from 'react-google-recaptcha';
import { useRef } from 'react';

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
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  const handleStartSession = () => {
    if (!recaptchaRef.current?.getValue()) {
      alert('Please complete reCAPTCHA');
      return;
    }
    onStartSession();
  };

  return (
    <div className="login-panel" style={{ width: '95%', maxWidth: '400px', margin: '10px auto', padding: '16px', boxSizing: 'border-box', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <label htmlFor="nickname" style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '0.9rem' }}>Your nickname</label>
      <input
        id="nickname"
        value={nickname}
        style={{ marginBottom: '4px', width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
        onChange={(e) => onNicknameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
        placeholder="Enter nickname..."
        maxLength={15}
      />
      <div style={{ marginBottom: '8px', color: '#7a4a61', fontSize: '0.8rem' }}>2–15 characters</div>
      <div className="recaptcha-container" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: '15px', 
        overflowX: 'auto',
        width: '100%'
      }}>
        {recaptchaSiteKey ? (
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={recaptchaSiteKey}
            hl="en"
            onChange={(token: string | null) => onCaptchaChange(token)}
          />
        ) : (
          <div style={{ color: 'red', fontSize: '0.8rem', textAlign: 'center' }}>reCAPTCHA configuration missing</div>
        )}
      </div>
      <button onClick={handleStartSession} style={{ width: '100%', padding: '12px', cursor: 'pointer', borderRadius: '8px', border: 'none', background: '#db2777', color: '#fff', fontWeight: '600', fontSize: '1rem' }}>Start chat</button>
      {error && <div className="error-box">{error}</div>}
    </div>
  );
};
