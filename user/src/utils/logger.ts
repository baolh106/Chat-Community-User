/** Log debug chỉ chạy ở môi trường dev; bản build production không in gì. */
export const debugLog = (...args: unknown[]): void => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(...args);
  }
};
