import { describe, expect, it } from 'vitest';
import type { Message } from '../types';
import { getMessageKey, parseMessage, patchMessage, upsertMessage } from './messages';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  content: 'hi',
  sender: 'u1',
  receiver: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('parseMessage', () => {
  it('trả null khi payload không hợp lệ hoặc thiếu sender/createdAt', () => {
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage('text')).toBeNull();
    expect(parseMessage({ content: 'x', createdAt: '2026-01-01' })).toBeNull();
    expect(parseMessage({ content: 'x', sender: 'u1' })).toBeNull();
  });

  it('giữ các field cơ bản và bỏ field lạ', () => {
    const parsed = parseMessage({
      id: 'm1',
      tempId: 't1',
      content: 'hello',
      sender: 'u1',
      receiver: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
      fileDriveId: 'drive-1',
    });
    expect(parsed).toEqual({
      id: 'm1',
      tempId: 't1',
      status: undefined,
      content: 'hello',
      sender: 'u1',
      receiver: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
      attachments: undefined,
      hasAttachments: undefined,
      isRead: undefined,
    });
  });

  it('content không phải string thì thành null', () => {
    expect(parseMessage({ sender: 'u1', createdAt: 'x', content: 42 })?.content).toBeNull();
  });

  it('chuyển định dạng phẳng cũ (fileURL, fileName…) thành attachments[]', () => {
    const parsed = parseMessage({
      sender: 'u1',
      createdAt: 'x',
      fileURL: 'https://drive.google.com/file/d/abc/view',
      fileName: 'photo.PNG',
      fileSize: 2048,
      isUnSafe: true,
      unsafeReason: 'nsfw',
    });
    expect(parsed?.attachments).toEqual([
      {
        url: 'https://drive.google.com/file/d/abc/view',
        name: 'photo.PNG',
        mimeType: undefined,
        size: 2048,
        type: 'image',
        isUnsafe: true,
        unsafeReason: 'nsfw',
      },
    ]);
  });

  it('attachments[] dùng field gốc làm fallback cho phần tử đầu tiên', () => {
    const parsed = parseMessage({
      sender: 'u1',
      createdAt: 'x',
      imageURL: 'https://cdn/x.jpg',
      fileMimeType: 'image/jpeg',
      isUnsafe: true,
      attachments: [{ fileName: 'a.jpg' }, { url: 'https://cdn/b.pdf', name: 'b.pdf' }],
    });
    expect(parsed?.attachments).toEqual([
      expect.objectContaining({ url: 'https://cdn/x.jpg', name: 'a.jpg', type: 'image', isUnsafe: true }),
      expect.objectContaining({ url: 'https://cdn/b.pdf', name: 'b.pdf', type: 'file', isUnsafe: false }),
    ]);
  });

  it('không nhân đôi attachment khi fileURL đã có trong attachments[]', () => {
    const parsed = parseMessage({
      sender: 'u1',
      createdAt: 'x',
      fileURL: 'https://cdn/a.pdf',
      attachments: [{ url: 'https://cdn/a.pdf', name: 'a.pdf' }],
    });
    expect(parsed?.attachments).toHaveLength(1);
  });
});

describe('upsertMessage', () => {
  it('thêm tin mới khi không khớp tin nào', () => {
    const existing = makeMessage({ id: 'm1', content: 'a' });
    const incoming = makeMessage({ id: 'm2', content: 'b', createdAt: '2026-01-01T00:01:00.000Z' });
    expect(upsertMessage([existing], incoming)).toEqual([existing, incoming]);
  });

  it('cập nhật tin optimistic khi ack có cùng tempId', () => {
    const pending = makeMessage({ tempId: 't1', status: 'sending' });
    const acked = makeMessage({ tempId: 't1', id: 'm1', status: 'sent' });
    expect(upsertMessage([pending], acked)).toEqual([
      expect.objectContaining({ id: 'm1', tempId: 't1', status: 'sent' }),
    ]);
  });

  it('cập nhật theo id', () => {
    const existing = makeMessage({ id: 'm1', content: 'old' });
    const result = upsertMessage([existing], makeMessage({ id: 'm1', content: 'new' }));
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('new');
  });

  it('field undefined của tin mới không xoá field đang có', () => {
    const pending = makeMessage({
      tempId: 't1',
      attachments: [{ url: 'blob:x', name: 'a.png', type: 'image' }],
    });
    const result = upsertMessage([pending], makeMessage({ tempId: 't1', status: 'sent' }));
    expect(result[0].attachments).toHaveLength(1);
  });
});

describe('patchMessage', () => {
  it('cập nhật tin theo tempId', () => {
    const pending = makeMessage({ tempId: 't1', status: 'sending' });
    expect(patchMessage([pending], 't1', { status: 'failed' })[0].status).toBe('failed');
  });

  it('không thêm tin khi không tìm thấy tempId', () => {
    const list = [makeMessage({ tempId: 't1' })];
    expect(patchMessage(list, 'missing', { status: 'failed' })).toBe(list);
  });
});

describe('getMessageKey', () => {
  it('ưu tiên id, rồi tempId, rồi sender + createdAt', () => {
    expect(getMessageKey(makeMessage({ id: 'm1', tempId: 't1' }))).toBe('m1');
    expect(getMessageKey(makeMessage({ tempId: 't1' }))).toBe('t1');
    expect(getMessageKey(makeMessage())).toBe('u1-2026-01-01T00:00:00.000Z');
  });
});
