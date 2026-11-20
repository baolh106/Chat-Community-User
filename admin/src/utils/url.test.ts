import { describe, expect, it } from 'vitest';
import { safeUrl } from './url';

describe('safeUrl', () => {
  it.each([
    'https://drive.google.com/uc?id=1',
    'http://example.com/a.png',
    'blob:http://localhost/123',
  ])('cho phép %s', (url) => {
    expect(safeUrl(url)).toBe(new URL(url).href);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
  ])('chặn %s', (url) => {
    expect(safeUrl(url)).toBeUndefined();
  });

  it('URL tương đối được chuẩn hoá theo origin hiện tại', () => {
    expect(safeUrl('/files/a.pdf')).toBe(`${window.location.origin}/files/a.pdf`);
  });

  it('giá trị rỗng trả undefined', () => {
    expect(safeUrl('')).toBeUndefined();
    expect(safeUrl(null)).toBeUndefined();
    expect(safeUrl(undefined)).toBeUndefined();
  });
});
