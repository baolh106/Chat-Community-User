import { useCallback, useEffect, useState } from 'react';
import type { AppSocket, Message } from '../types';
import { getReason, getString, isRecord } from '../utils/guards';
import { parseMessage, upsertMessage } from '../utils/messages';
import { useSocketEvent } from './useSocketEvent';
import type { UpdateConversation } from './useMessageSender';

type Options = {
  socket: AppSocket | null;
  isActive: boolean;
  nickname: string;
  onError: (message: string | null) => void;
};

/** Cuộc hội thoại duy nhất của user với admin: danh sách tin và userId do server cấp khi join. */
export const useMessages = ({ socket, isActive, nickname, onError }: Options) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) {
      setMessages([]);
      setUserId(null);
    }
  }, [isActive]);

  // User chỉ có một hội thoại nên bỏ qua conversation key.
  const updateConversation = useCallback<UpdateConversation>((_conversationKey, update) => {
    setMessages(update);
  }, []);

  useSocketEvent(socket, 'user:joined', (payload) => {
    if (!isRecord(payload) || payload.ok !== true) return;
    const joinedUserId = getString(payload, 'userId');
    if (!joinedUserId) return;

    setUserId(joinedUserId);
    onError(null);
    setMessages((prev) =>
      prev.length > 0
        ? prev
        : [
            {
              content: `Welcome ${nickname}`,
              sender: 'system',
              receiver: joinedUserId,
              createdAt: new Date().toISOString(),
            },
          ],
    );
  });

  useSocketEvent(socket, 'user:join_denied', (payload) => {
    onError(getReason(payload) ?? 'Join bị từ chối');
  });

  useSocketEvent(socket, 'message:new', (payload) => {
    const message = parseMessage(payload);
    if (message) setMessages((prev) => upsertMessage(prev, message));
  });

  return { messages, userId, updateConversation };
};
