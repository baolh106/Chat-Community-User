import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  userId: string | null;
}

export const MessageList = ({ messages, userId }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="messages-box" style={{
      flex: 1,
      overflowY: 'auto',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
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
      <div ref={messagesEndRef} />
    </div>
  );
};
