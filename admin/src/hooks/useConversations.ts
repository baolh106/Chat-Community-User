import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppSocket, Message } from '../types';
import { api } from '../utils/api';
import { getReason, getString, isRecord } from '../utils/guards';
import { parseMessage, upsertMessage } from '../utils/messages';
import { useEventCallback } from './useEventCallback';
import type { UpdateConversation } from './useMessageSender';
import { useSocketEvent } from './useSocketEvent';

const ADMIN_ID = 'admin';
const SYSTEM_ID = 'system';

type Options = {
  socket: AppSocket | null;
  isActive: boolean;
  accessToken: string | null;
  onError: (message: string | null) => void;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const parseHistory = (value: unknown): Record<string, Message[]> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([userId, list]) => [
      userId,
      (Array.isArray(list) ? list : [])
        .map(parseMessage)
        .filter((message): message is Message => message !== null),
    ]),
  );
};

/** Đưa user lên đầu danh sách online, bỏ bản trùng. */
const moveToTop = (users: string[], userId: string) => [
  userId,
  ...users.filter((id) => id !== userId),
];

/**
 * Các hội thoại của admin: danh sách user online, tin nhắn theo từng user,
 * số tin chưa đọc và user đang được chọn.
 */
export const useConversations = ({ socket, isActive, accessToken, onError }: Options) => {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messagesByUser, setMessagesByUser] = useState<Record<string, Message[]>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isActive) {
      setOnlineUsers([]);
      setSelectedUserId(null);
      setMessagesByUser({});
      setUnreadCounts({});
    }
  }, [isActive]);

  // Tự chọn user đầu tiên khi chưa chọn ai.
  useEffect(() => {
    if (onlineUsers.length > 0 && selectedUserId === null) {
      setSelectedUserId(onlineUsers[0]);
    }
  }, [onlineUsers, selectedUserId]);

  const updateConversation = useCallback<UpdateConversation>((userId, update) => {
    setMessagesByUser((prev) => ({ ...prev, [userId]: update(prev[userId] ?? []) }));
  }, []);

  const markAsRead = useEventCallback(async (userId: string) => {
    try {
      await api.markRead(userId, ADMIN_ID, accessToken);
    } catch {
      // Không đánh dấu được trên server thì vẫn xoá badge ở client.
    }
    setUnreadCounts((prev) => ({ ...prev, [userId]: 0 }));
  });

  const fetchUnreadCount = useEventCallback(async (userId: string) => {
    try {
      return await api.getUnreadCount(userId, ADMIN_ID, accessToken);
    } catch {
      return 0;
    }
  });

  const selectUser = useEventCallback((userId: string | null) => {
    setSelectedUserId(userId);
    if (!userId) return;
    void markAsRead(userId).then(() => {
      setMessagesByUser((prev) => ({
        ...prev,
        [userId]: (prev[userId] ?? []).map((m) =>
          m.receiver === ADMIN_ID ? { ...m, isRead: true } : m,
        ),
      }));
    });
  });

  useSocketEvent(socket, 'admin:joined', (payload) => {
    const userIds = isRecord(payload) && payload.ok === true ? toStringArray(payload.userIds) : null;
    if (!isRecord(payload) || !userIds) {
      onError(getReason(payload) ?? 'Admin join bị từ chối');
      return;
    }

    setOnlineUsers(userIds);
    setMessagesByUser(parseHistory(payload.history));
    onError(null);

    void Promise.all(
      userIds.map(async (id) => [id, await fetchUnreadCount(id)] as const),
    ).then((entries) => setUnreadCounts(Object.fromEntries(entries)));
  });

  useSocketEvent(socket, 'user:joined', (payload) => {
    const userId =
      typeof payload === 'string' ? payload : isRecord(payload) ? getString(payload, 'userId') : undefined;
    if (!userId) return;
    setOnlineUsers((prev) => moveToTop(prev, userId));
    void fetchUnreadCount(userId).then((count) =>
      setUnreadCounts((prev) => ({ ...prev, [userId]: count })),
    );
  });

  useSocketEvent(socket, 'user:left', (payload) => {
    const userId = isRecord(payload) ? getString(payload, 'userId') : undefined;
    if (userId) setOnlineUsers((prev) => prev.filter((id) => id !== userId));
  });

  useSocketEvent(socket, 'message:new', (payload) => {
    const message = parseMessage(payload);
    if (!message) return;

    const conversationKey = message.sender === ADMIN_ID ? message.receiver : message.sender;
    updateConversation(conversationKey, (list) => upsertMessage(list, message));

    const { sender } = message;
    if (sender === ADMIN_ID || sender === SYSTEM_ID) return;

    setOnlineUsers((prev) => moveToTop(prev, sender));
    if (selectedUserId === sender) {
      void markAsRead(sender);
    } else {
      setUnreadCounts((prev) => ({ ...prev, [sender]: (prev[sender] ?? 0) + 1 }));
    }
  });

  const messages = useMemo(
    () => (selectedUserId ? (messagesByUser[selectedUserId] ?? []) : []),
    [messagesByUser, selectedUserId],
  );

  return {
    onlineUsers,
    selectedUserId,
    selectUser,
    unreadCounts,
    messages,
    updateConversation,
  };
};
