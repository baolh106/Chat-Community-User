import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createIceSignaler,
  describeMediaError,
  getLocalMedia,
  parseIceCandidate,
  parseSessionDescription,
} from './webrtc';

const domError = (name: string) => Object.assign(new Error(name), { name });

describe('createIceSignaler', () => {
  it('giữ candidate tới khi open, sau đó gửi ngay', () => {
    const send = vi.fn();
    const signaler = createIceSignaler(send);

    signaler.push({ candidate: 'a' });
    signaler.push({ candidate: 'b' });
    expect(send).not.toHaveBeenCalled();

    signaler.open();
    expect(send.mock.calls.map(([c]) => c.candidate)).toEqual(['a', 'b']);

    signaler.push({ candidate: 'c' });
    expect(send).toHaveBeenLastCalledWith({ candidate: 'c' });
  });
});

describe('getLocalMedia', () => {
  const getUserMedia = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });

  afterEach(() => getUserMedia.mockReset());

  it('không có camera thì thử lại chỉ với micro', async () => {
    const audioOnly = { id: 'audio' };
    getUserMedia.mockRejectedValueOnce(domError('NotFoundError')).mockResolvedValueOnce(audioOnly);
    await expect(getLocalMedia()).resolves.toBe(audioOnly);
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
  });

  it('bị từ chối quyền thì không thử lại', async () => {
    getUserMedia.mockRejectedValueOnce(domError('NotAllowedError'));
    await expect(getLocalMedia()).rejects.toThrow('NotAllowedError');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe('describeMediaError', () => {
  it('map theo err.name, có thông báo mặc định', () => {
    expect(describeMediaError(domError('NotAllowedError'))).toBe('Bạn chưa cấp quyền camera/micro cho trang này');
    expect(describeMediaError(domError('NotReadableError'))).toBe('Camera/micro đang được ứng dụng khác sử dụng');
    expect(describeMediaError(new TypeError('x'))).toBe('Không thể truy cập camera/micro');
  });
});

describe('parse signaling payload', () => {
  it('parseSessionDescription chỉ nhận type hợp lệ', () => {
    expect(parseSessionDescription({ type: 'offer', sdp: 'v=0' })).toEqual({ type: 'offer', sdp: 'v=0' });
    expect(parseSessionDescription({ type: 'hack', sdp: 'v=0' })).toBeNull();
    expect(parseSessionDescription('offer')).toBeNull();
  });

  it('parseIceCandidate cần candidate là string', () => {
    expect(parseIceCandidate({ candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 })).toEqual({
      candidate: 'c',
      sdpMid: '0',
      sdpMLineIndex: 0,
      usernameFragment: null,
    });
    expect(parseIceCandidate({ sdpMid: '0' })).toBeNull();
  });
});
