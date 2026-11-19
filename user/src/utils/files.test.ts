import { describe, expect, it } from 'vitest';
import { formatFileSize, getDisplayURL, getDownloadURL, isImageFile, toBase64 } from './files';
import { mapMessageError } from './errors';

describe('formatFileSize', () => {
  it.each([
    [undefined, ''],
    [0, ''],
    [512, '512 B'],
    [2048, '2.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('%s -> %s', (size, expected) => {
    expect(formatFileSize(size)).toBe(expected);
  });
});

describe('isImageFile', () => {
  it('nhận diện theo mime type hoặc đuôi file', () => {
    expect(isImageFile(new File([], 'a.bin', { type: 'image/png' }))).toBe(true);
    expect(isImageFile(new File([], 'photo.JPG'))).toBe(true);
    expect(isImageFile(new File([], 'doc.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});

describe('toBase64', () => {
  it('trả base64 không kèm prefix data URL', async () => {
    await expect(toBase64(new File(['hi'], 'a.txt', { type: 'text/plain' }))).resolves.toBe('aGk=');
  });
});

describe('Drive URL', () => {
  const driveUrl = 'https://drive.google.com/file/d/abc123/view';

  it('getDisplayURL đổi link Drive sang thumbnail, giữ nguyên blob và link khác', () => {
    expect(getDisplayURL(driveUrl)).toBe('https://drive.google.com/thumbnail?id=abc123&sz=w1000');
    expect(getDisplayURL('blob:http://x/1')).toBe('blob:http://x/1');
    expect(getDisplayURL('https://cdn/x.png')).toBe('https://cdn/x.png');
  });

  it('getDownloadURL đổi link Drive (kể cả dạng ?id=) sang link tải', () => {
    expect(getDownloadURL(driveUrl)).toBe('https://drive.google.com/uc?export=download&id=abc123');
    expect(getDownloadURL('https://drive.google.com/open?id=xyz')).toBe(
      'https://drive.google.com/uc?export=download&id=xyz',
    );
  });
});

describe('mapMessageError', () => {
  it('map mã lỗi đã biết, giữ nguyên reason lạ, có fallback', () => {
    expect(mapMessageError('unauthorized')).toBe('Phiên đăng nhập không hợp lệ');
    expect(mapMessageError('something odd')).toBe('something odd');
    expect(mapMessageError()).toBe('Gửi message thất bại');
  });
});
