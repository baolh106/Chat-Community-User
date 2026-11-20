import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asAppSocket, createFakeSocket, type FakeSocket } from '../test/fakeSocket';

const sockets: FakeSocket[] = [];

vi.mock('../utils/socket', () => ({
  createSocket: (token: string) => {
    const fake = createFakeSocket(token);
    sockets.push(fake);
    return asAppSocket(fake);
  },
}));

vi.mock('../utils/api', () => ({
  api: {
    adminLogin: vi.fn(async () => ({ accessToken: 'access-1', refreshToken: 'refresh-1' })),
    refreshSession: vi.fn(async () => ({ accessToken: 'access-2', refreshToken: 'refresh-2' })),
    getUnreadCount: vi.fn(async (userId: string) => (userId === 'u-2' ? 3 : 0)),
    markRead: vi.fn(async () => undefined),
  },
}));

const { useChat } = await import('./useChat');
const { api } = await import('../utils/api');

const STORAGE_KEY = 'admin_chat_auth';
const latestSocket = () => sockets[sockets.length - 1];
const at = (minute: number) => `2026-01-01T00:0${minute}:00.000Z`;

const renderJoined = async () => {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1', nickname: 'Administrator' }),
  );
  const view = renderHook(() => useChat());
  await waitFor(() => expect(latestSocket()?.connect).toHaveBeenCalled());
  act(() => latestSocket().serverEmit('connect'));
  act(() =>
    latestSocket().serverEmit('admin:joined', {
      ok: true,
      userIds: ['u-1', 'u-2'],
      history: {
        'u-1': [{ id: 'h-1', content: 'cũ', sender: 'u-1', receiver: 'admin', createdAt: at(0) }],
      },
    }),
  );
  await waitFor(() => expect(view.result.current.unreadCounts).toEqual({ 'u-1': 0, 'u-2': 3 }));
  return view;
};

beforeEach(() => {
  sockets.length = 0;
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('useChat (admin)', () => {
  it('join: nhận danh sách user, lịch sử, số chưa đọc và tự chọn user đầu tiên', async () => {
    const { result } = await renderJoined();

    expect(latestSocket().emittedEvents('admin:join')).toHaveLength(1);
    expect(result.current.onlineUsers).toEqual(['u-1', 'u-2']);
    expect(result.current.selectedUserId).toBe('u-1');
    expect(result.current.messages).toEqual([expect.objectContaining({ id: 'h-1' })]);
    expect(result.current.userId).toBe('admin');
  });

  it('message:new từ user khác: tăng unread và đưa user lên đầu', async () => {
    const { result } = await renderJoined();

    act(() =>
      latestSocket().serverEmit('message:new', {
        id: 'm-1',
        content: 'hi',
        sender: 'u-2',
        receiver: 'admin',
        createdAt: at(1),
      }),
    );

    expect(result.current.unreadCounts['u-2']).toBe(4);
    expect(result.current.onlineUsers).toEqual(['u-2', 'u-1']);
    expect(result.current.messages).toHaveLength(1);
  });

  it('message:new từ user đang xem: đánh dấu đã đọc', async () => {
    const { result } = await renderJoined();

    act(() =>
      latestSocket().serverEmit('message:new', {
        id: 'm-1',
        content: 'hi',
        sender: 'u-1',
        receiver: 'admin',
        createdAt: at(1),
      }),
    );

    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith('u-1', 'admin', 'access-1'));
    expect(result.current.messages).toHaveLength(2);
  });

  it('gửi tin cho user đang chọn và nhận ack', async () => {
    const { result } = await renderJoined();

    act(() => result.current.setDraft('xin chào'));
    await act(() => result.current.sendMessage());

    const [sent] = latestSocket().emittedEvents('message:send');
    const payload = sent.args[0] as { tempId: string; receiver: string };
    expect(payload.receiver).toBe('u-1');
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({ tempId: payload.tempId, status: 'sending', sender: 'admin' }),
    );

    act(() =>
      latestSocket().serverEmit('message:send:ack', {
        ok: true,
        tempId: payload.tempId,
        message: { id: 'm-9', content: 'xin chào', sender: 'admin', receiver: 'u-1', createdAt: at(2) },
      }),
    );
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({ id: 'm-9', status: 'sent' }),
    );
  });

  it('chọn user khác: đánh dấu đã đọc và xoá badge', async () => {
    const { result } = await renderJoined();

    act(() => result.current.setSelectedUserId('u-2'));

    await waitFor(() => expect(result.current.unreadCounts['u-2']).toBe(0));
    expect(api.markRead).toHaveBeenCalledWith('u-2', 'admin', 'access-1');
  });

  it('user:left bỏ user khỏi danh sách online', async () => {
    const { result } = await renderJoined();
    act(() => latestSocket().serverEmit('user:left', { userId: 'u-2' }));
    expect(result.current.onlineUsers).toEqual(['u-1']);
  });

  it('logout ngắt socket và xoá toàn bộ state', async () => {
    const { result } = await renderJoined();
    const socket = latestSocket();

    act(() => result.current.resetSession());

    expect(socket.disconnect).toHaveBeenCalled();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.onlineUsers).toEqual([]);
    expect(result.current.sessionNickname).toBe('');
  });
});
