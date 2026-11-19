import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { Message } from '../types';
import { getMessageKey } from '../utils/messages';

/** Khoảng cách tới đáy (px) vẫn coi là "đang ở cuối" để tự cuộn khi có tin mới. */
const NEAR_BOTTOM_THRESHOLD_PX = 80;
const SCROLL_DELAY_MS = 100;

interface MessageListProps {
  messages: Message[];
  userId: string | null;
  onRetry?: (tempId: string) => void;
}

export const MessageList = ({ messages, userId, onRetry }: MessageListProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = () => {
    const box = boxRef.current;
    if (!box) return;
    isNearBottomRef.current =
      box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
  };

  // Chỉ tự cuộn khi người dùng đang ở cuối danh sách hoặc vừa tự gửi tin,
  // để không kéo người đang đọc tin cũ xuống đáy.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const isOwnMessage = lastMessage !== undefined && lastMessage.sender === userId;
    if (!isNearBottomRef.current && !isOwnMessage) return;

    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, SCROLL_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [messages, userId]);

  return (
    <div className="messages-box" ref={boxRef} onScroll={handleScroll} aria-live="polite">
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <p>Hãy bắt đầu cuộc trò chuyện cùng chúng tôi.</p>
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem
            key={getMessageKey(message)}
            message={message}
            isMine={userId !== null && message.sender === userId}
            onRetry={onRetry}
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
