import { MessageItem } from './MessageItem';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  userId: string | null;
}

export const MessageList = ({ messages, userId }: MessageListProps) => {
  return (
    <div className="messages-box">
      {messages.length === 0 ? (
        <div className="empty-state">Chưa có tin nhắn nào. Gửi tin nhắn để bắt đầu.</div>
      ) : (
        messages.map((message, index) => {
          const isMine = message.sender === userId || message.sender === 'user';
          return (
            <MessageItem
              key={index}
              message={message}
              isMine={isMine}
              userId={userId}
            />
          );
        })
      )}
    </div>
  );
};
