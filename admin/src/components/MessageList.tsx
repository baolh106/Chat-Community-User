import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  userId: string; // Admin's userId is always 'admin'
}

export const MessageList = ({ messages, userId }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom when new messages arrive
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div
      className="messages-box"
      style={{
        flex: 1, // Allow it to grow and shrink within its flex parent
        overflowY: 'auto', // Enable vertical scrolling
        padding: '10px', // Add some padding for better appearance
        display: 'flex', // Make it a flex container
        flexDirection: 'column', // Stack messages vertically
      }}
    >
      {messages.length === 0 ? (
        <div className="empty-state">Chưa có tin nhắn nào. Gửi tin nhắn để bắt đầu.</div>
      ) : (
        messages.map((message, index) => {
          const isMine = message.sender === userId; // For admin, userId is 'admin'
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
      <div ref={messagesEndRef} /> {/* Invisible element to scroll to */}
    </div>
  );
};
