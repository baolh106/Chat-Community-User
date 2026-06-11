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

    // Sử dụng requestAnimationFrame để đảm bảo DOM đã render xong trước khi cuộn
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  return (
    <div className="messages-box">
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <p>Hãy bắt đầu cuộc trò chuyện cùng chúng tôi.</p>
        </div>
      ) : (
        messages.map((message) => {
          const isMine = message.sender === userId || message.sender === 'user';
          return (
            <MessageItem
              key={
                (message as any).id || 
                (message as any).tempId || 
                `${message.sender}-${message.createdAt}`
              }
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
