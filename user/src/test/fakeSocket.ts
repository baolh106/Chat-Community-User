import { vi } from 'vitest';
import type { AppSocket } from '../types';

type Handler = (...args: unknown[]) => void;

/** Socket.IO client giả: ghi lại emit và cho test bắn event từ "server". */
export const createFakeSocket = (token: string) => {
  const handlers = new Map<string, Set<Handler>>();

  const fake = {
    token,
    connected: false,
    emitted: [] as Array<{ event: string; args: unknown[] }>,
    on: vi.fn((event: string, handler: Handler) => {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return fake;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
      return fake;
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      fake.emitted.push({ event, args });
      return fake;
    }),
    timeout: vi.fn(() => fake),
    connect: vi.fn(() => fake),
    disconnect: vi.fn(() => {
      fake.connected = false;
      return fake;
    }),
    /** Bắn một event như thể server gửi xuống. */
    serverEmit(event: string, ...args: unknown[]) {
      if (event === 'connect') fake.connected = true;
      handlers.get(event)?.forEach((handler) => handler(...args));
    },
    listenerCount: (event: string) => handlers.get(event)?.size ?? 0,
    emittedEvents: (event: string) => fake.emitted.filter((e) => e.event === event),
  };

  return fake;
};

export type FakeSocket = ReturnType<typeof createFakeSocket>;

export const asAppSocket = (fake: FakeSocket) => fake as unknown as AppSocket;
