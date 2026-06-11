interface ChatHeaderProps {
  status: string;
  statusClass: string;
}

export const ChatHeader = ({ status, statusClass }: ChatHeaderProps) => {
  return (
    <header className="chat-header" style={{ flexShrink: 0 }}>
      <div style={{ overflow: 'hidden' }}>
        <p className="eyebrow">Chat Admin</p>
        <h1 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Anonymous conversation</h1>
      </div>
      <div className={`status-pill ${statusClass}`}>{status}</div>
    </header>
  );
};
