import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Trả về một hàm có identity ổn định nhưng luôn gọi phiên bản `fn` mới nhất.
 * Dùng cho listener sống lâu (socket, WebRTC) để tránh đọc state cũ qua closure
 * mà không phải đăng ký lại listener mỗi lần render.
 */
export const useEventCallback = <Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): ((...args: Args) => Result) => {
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  return useCallback((...args: Args) => fnRef.current(...args), []);
};
