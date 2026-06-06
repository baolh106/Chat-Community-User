import { useChat } from '../hooks/useChat';
import { LoginPanel } from './LoginPanel';
import { AdminDashboard } from './AdminDashboard';

export const AdminPage = () => {
  const chat = useChat();
  const { sessionNickname, password, setPassword, startSession, setCaptchaToken, error } = chat;

  const isLoggingIn = !sessionNickname;

  return (
    <div className="admin-page-wrapper" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#f8fafc'
    }}>
      {isLoggingIn ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, backgroundColor: '#f8fafc' }}>
          <LoginPanel
            password={password}
            onPasswordChange={setPassword}
            onLogin={startSession}
            onCaptchaChange={setCaptchaToken}
            error={error}
          />
        </div>
      ) : (
        <AdminDashboard chat={chat} />
      )}
    </div>
  );
};
