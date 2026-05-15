import type { Message } from '../types';

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  userId: string | null;
}

export const MessageItem = ({ message, isMine, userId }: MessageItemProps) => {
  return (
    <div className={`message-item ${isMine ? 'mine' : 'other'}`}>
      <div className="message-content">{message.content}</div>
      <div className="message-meta">
        <span>
          {isMine
            ? 'Bạn'
            : message.sender === 'system'
            ? 'Hệ thống'
            : 'Admin'}
        </span>
        <span>{new Date(message.createdAt).toLocaleTimeString('vi-VN')}</span>
      </div>
    </div>
  );
};
