import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthResult } from '../utils/http';
import { clearSession, loadSession, saveSession, type StoredSession } from '../utils/sessionStore';

type Options = {
  storageKey: string;
  refresh: (refreshToken: string) => Promise<AuthResult>;
};

/**
 * Quản lý phiên đăng nhập (tương đương AuthService): giữ token, lưu/khôi phục
 * từ storage, refresh token có chống gọi trùng.
 */
export const useAuthSession = ({ storageKey, refresh }: Options) => {
  const [session, setSession] = useState<StoredSession | null>(() => loadSession(storageKey));
  // Ref luôn giữ phiên mới nhất cho các luồng async (refresh), tránh closure cũ.
  const sessionRef = useRef(session);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const update = useCallback((next: StoredSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    if (session) saveSession(storageKey, session);
    else clearSession(storageKey);
  }, [session, storageKey]);

  const establish = useCallback(
    (tokens: { accessToken: string; refreshToken: string }, nickname: string) => {
      update({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, nickname });
    },
    [update],
  );

  const end = useCallback(() => update(null), [update]);

  /** Refresh access token. Trả `false` (và kết thúc phiên) nếu không refresh được. */
  const refreshSession = useCallback((): Promise<boolean> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const current = sessionRef.current;
    if (!current) return Promise.resolve(false);

    const promise = (async () => {
      try {
        const tokens = await refresh(current.refreshToken);
        update({
          ...current,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? current.refreshToken,
        });
        return true;
      } catch {
        update(null);
        return false;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, [refresh, update]);

  return {
    isActive: session !== null,
    accessToken: session?.accessToken ?? null,
    nickname: session?.nickname ?? '',
    establish,
    end,
    refresh: refreshSession,
  };
};
