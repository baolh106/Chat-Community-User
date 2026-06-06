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
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Sử dụng requestAnimationFrame hoặc timeout nhỏ để đảm bảo DOM đã render xong
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  return (
    <div className="messages-box" style={{ flex: 1, overflowY: 'auto' }}>
      {messages.length === 0 ? (
        <div className="empty-state">No messages yet. Send a message to get started.</div>
      ) : (
        messages.map((message) => {
          const isMine = message.sender === userId || message.sender === 'user';
          // Sử dụng key duy nhất thay vì index để tối ưu hiệu năng render
          return (
            <MessageItem
              key={`${message.sender}-${message.createdAt}`}
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
