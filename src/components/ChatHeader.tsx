interface ChatHeaderProps {
  status: string;
  statusClass: string;
}

export const ChatHeader = ({ status, statusClass }: ChatHeaderProps) => {
  return (
    <header className="chat-header">
      <div>
        <p className="eyebrow">Chat User</p>
        <h1>Giao diện chat màu hồng pastel</h1>
        <p className="subtitle">Dành cho user. Admin chưa cần triển khai.</p>
      </div>
      <div className={`status-pill ${statusClass}`}>{status}</div>
    </header>
  );
};
