const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['https:', 'http:', 'blob:']);

/**
 * Chỉ cho phép URL `https:`, `http:`, `blob:` đi vào `href`/`src`.
 * Chặn `javascript:`, `data:`… từ dữ liệu server hoặc người dùng khác (review #2).
 */
export const safeUrl = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, window.location.origin);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
