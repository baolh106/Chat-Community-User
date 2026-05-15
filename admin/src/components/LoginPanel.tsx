interface LoginPanelProps {
  password: string;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
  error: string | null;
}

export const LoginPanel = ({
  password,
  onPasswordChange,
  onLogin,
  error,
}: LoginPanelProps) => {
  return (
    <div className="login-panel">
      <h2>Admin Login</h2>
      <p>Nhập mật khẩu</p>
      <input
        type="password"
        placeholder="Nhập mật khẩu quản trị viên..."
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onLogin()}
        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%', marginBottom: '10px' }}
      />
      {error && <p className="error-box">{error}</p>}
      <button onClick={onLogin} className="login-button" style={{ width: '100%' }}>
        Đăng nhập
      </button>
    </div>
  );
};
