interface LoginPanelProps {
  nickname: string;
  onNicknameChange: (value: string) => void;
  onStartSession: () => void;
  error: string | null;
}

export const LoginPanel = ({
  nickname,
  onNicknameChange,
  onStartSession,
  error,
}: LoginPanelProps) => {
  return (
    <div className="login-panel">
      <label htmlFor="nickname">Nickname của bạn</label>
      <input
        id="nickname"
        value={nickname}
        style={{ marginBottom: '10px' }}
        onChange={(e) => onNicknameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onStartSession()}
        placeholder="Nhập nickname..."
      />
      <button onClick={onStartSession}>Bắt đầu chat</button>
      {error && <div className="error-box">{error}</div>}
    </div>
  );
};
