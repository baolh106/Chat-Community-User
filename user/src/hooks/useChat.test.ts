import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    startSession: vi.fn(async () => ({ accessToken: 'access-1', refreshToken: 'refresh-1' })),
    refreshSession: vi.fn(async () => ({ accessToken: 'access-2', refreshToken: 'refresh-2' })),
  },
}));

const { useChat } = await import('./useChat');
const { api } = await import('../utils/api');

const STORAGE_KEY = 'user_chat_auth';
const latestSocket = () => sockets[sockets.length - 1];

const storeSession = () =>
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1', nickname: 'Bao' }),
  );

/** Render hook với phiên đã lưu, kết nối socket và join thành công. */
const renderJoined = async () => {
  storeSession();
  const view = renderHook(() => useChat());
  await waitFor(() => expect(latestSocket()?.connect).toHaveBeenCalled());
  act(() => latestSocket().serverEmit('connect'));
  act(() => latestSocket().serverEmit('user:joined', { ok: true, userId: 'u-1' }));
  return view;
};

beforeEach(() => {
  sockets.length = 0;
  sessionStorage.clear();
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('useChat (user)', () => {
  it('khôi phục phiên từ sessionStorage, kết nối sau khi đăng ký listener và join', async () => {
    const { result } = await renderJoined();

    const socket = latestSocket();
    expect(socket.token).toBe('access-1');
    expect(socket.listenerCount('message:new')).toBe(1);
    expect(socket.emittedEvents('user:join')).toHaveLength(1);
    expect(result.current.status).toBe('connected');
    expect(result.current.sessionNickname).toBe('Bao');
    expect(result.current.userId).toBe('u-1');
    expect(result.current.messages).toEqual([
      expect.objectContaining({ sender: 'system', content: 'Welcome Bao' }),
    ]);
  });

  it('xoá dữ liệu phiên cũ trong localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: 'old', messages: [] }));
    renderHook(() => useChat());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('gửi tin: thêm tin optimistic, emit message:send, ack chuyển sang sent', async () => {
    const { result } = await renderJoined();

    act(() => result.current.setDraft('  xin chào  '));
    await act(() => result.current.sendMessage());

    const [sent] = latestSocket().emittedEvents('message:send');
    const payload = sent.args[0] as { tempId: string; content: string; receiver: string };
    expect(payload).toEqual(expect.objectContaining({ content: 'xin chào', receiver: 'admin' }));
    expect(result.current.draft).toBe('');
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({ tempId: payload.tempId, status: 'sending', sender: 'u-1' }),
    );

    act(() =>
      latestSocket().serverEmit('message:send:ack', {
        ok: true,
        tempId: payload.tempId,
        message: {
          id: 'm-1',
          content: 'xin chào',
          sender: 'u-1',
          receiver: 'admin',
          createdAt: new Date().toISOString(),
        },
      }),
    );
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({ id: 'm-1', tempId: payload.tempId, status: 'sent' }),
    );
  });

  it('message:new từ admin được thêm vào danh sách', async () => {
    const { result } = await renderJoined();
    act(() =>
      latestSocket().serverEmit('message:new', {
        id: 'm-2',
        content: 'chào bạn',
        sender: 'admin',
        receiver: 'u-1',
        createdAt: new Date().toISOString(),
      }),
    );
    expect(result.current.messages.at(-1)).toEqual(expect.objectContaining({ id: 'm-2' }));
  });

  it('token bị từ chối: refresh một lần rồi kết nối lại bằng token mới', async () => {
    await renderJoined();
    act(() => latestSocket().serverEmit('connect_error', new Error('jwt expired')));

    await waitFor(() => expect(sockets).toHaveLength(2));
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    expect(latestSocket().token).toBe('access-2');
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(
      expect.objectContaining({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
    );
  });

  it('resetSession ngắt socket, xoá phiên và tin nhắn', async () => {
    const { result } = await renderJoined();
    const socket = latestSocket();

    act(() => result.current.resetSession());

    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.listenerCount('message:new')).toBe(0);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe('idle');
  });

  it('startSession: kiểm tra nickname rồi tạo phiên mới', async () => {
    const { result } = renderHook(() => useChat());

    act(() => result.current.setNickname('a'));
    await act(() => result.current.startSession());
    expect(result.current.error).toBe('Nickname phải có từ 2 đến 15 ký tự');

    act(() => {
      result.current.setNickname('Bao');
      result.current.setCaptchaToken('captcha');
    });
    await act(() => result.current.startSession());

    expect(api.startSession).toHaveBeenCalledWith('Bao', 'captcha');
    await waitFor(() => expect(latestSocket()?.token).toBe('access-1'));
    expect(result.current.sessionNickname).toBe('Bao');
  });
});
