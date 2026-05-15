interface ChatHeaderProps {
  status: string;
  statusClass: string;
}

export const ChatHeader = ({ status, statusClass }: ChatHeaderProps) => {
  return (
    <header className="chat-header">
      <div>
        <p className="eyebrow">Chat User</p>
        <h1>Trò chuyện cùng Bảo Bảo</h1>
      </div>
      <div className={`status-pill ${statusClass}`}>{status}</div>
    </header>
  );
};
