/** Helper narrow dữ liệu `unknown` từ socket, fetch, storage. */

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Chuỗi không rỗng, ngược lại `undefined`. */
export const getString = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const getNumber = (record: UnknownRecord, key: string): number | undefined => {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

export const getBoolean = (record: UnknownRecord, key: string): boolean | undefined => {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
};

/** Lấy `reason` từ payload lỗi của socket. */
export const getReason = (payload: unknown): string | undefined =>
  isRecord(payload) ? getString(payload, 'reason') : undefined;
