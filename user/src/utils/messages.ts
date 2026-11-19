import type { Attachment, AttachmentType, Message, MessageStatus } from '../types';
import { getBoolean, getNumber, getString, isRecord, type UnknownRecord } from './guards';
import { isImageName } from './files';

const toAttachmentType = (value: unknown): AttachmentType | undefined =>
  value === 'image' || value === 'file' ? value : undefined;

/**
 * Chuẩn hoá attachment từ payload server. BE từng trả nhiều định dạng
 * (trường phẳng `fileURL`/`imageURL`/`fileName`… và mảng `attachments[]`);
 * mọi định dạng cũ chỉ được xử lý ở đây, phần còn lại của app chỉ dùng `attachments[]`.
 */
const parseAttachments = (raw: UnknownRecord): Attachment[] => {
  const rootUnsafe = raw.isUnsafe === true || raw.isUnSafe === true;
  const rootUnsafeReason = getString(raw, 'unsafeReason');
  const rootFileName = getString(raw, 'fileName');
  const rootMimeType = getString(raw, 'fileMimeType');
  const rootType = toAttachmentType(raw.attachmentType);
  const rootFileURL = getString(raw, 'fileURL');

  const items = Array.isArray(raw.attachments) ? raw.attachments.filter(isRecord) : [];
  const attachments = items.map((att, index): Attachment => {
    const isFirst = index === 0;
    const name = getString(att, 'name') ?? getString(att, 'fileName') ?? (isFirst ? rootFileName : undefined) ?? '';
    const mimeType =
      getString(att, 'mimeType') ?? getString(att, 'fileMimeType') ?? (isFirst ? rootMimeType : undefined) ?? '';
    const explicitType =
      toAttachmentType(att.type) ?? toAttachmentType(att.attachmentType) ?? (isFirst ? rootType : undefined);
    const looksLikeImage = mimeType.startsWith('image/') || isImageName(name);
    const isUnsafe = getBoolean(att, 'isUnsafe') ?? (isFirst ? rootUnsafe : false);

    return {
      url:
        getString(att, 'url') ??
        getString(att, 'fileURL') ??
        (isFirst ? (rootFileURL ?? getString(raw, 'imageURL')) : undefined) ??
        '',
      name,
      mimeType,
      size: getNumber(att, 'size'),
      type: explicitType ?? (looksLikeImage ? 'image' : 'file'),
      isUnsafe,
      unsafeReason: getString(att, 'unsafeReason') ?? (isFirst ? rootUnsafeReason : undefined),
    };
  });

  if (rootFileURL && !attachments.some((att) => att.url === rootFileURL)) {
    const looksLikeImage =
      Boolean(rootMimeType?.startsWith('image/')) ||
      Boolean(getString(raw, 'imageURL')) ||
      (rootFileName ? isImageName(rootFileName) : false);
    attachments.push({
      url: rootFileURL,
      name: rootFileName ?? '',
      mimeType: rootMimeType,
      size: getNumber(raw, 'fileSize'),
      type: rootType ?? (looksLikeImage ? 'image' : 'file'),
      isUnsafe: rootUnsafe,
      unsafeReason: rootUnsafeReason,
    });
  }

  return attachments;
};

const toStatus = (value: unknown): MessageStatus | undefined =>
  value === 'sending' || value === 'sent' || value === 'failed' ? value : undefined;

/**
 * Parse tin nhắn từ server. Trả `null` nếu thiếu thông tin bắt buộc
 * (`sender`, `createdAt`) để không tạo tin "ma" trong danh sách.
 */
export const parseMessage = (raw: unknown): Message | null => {
  if (!isRecord(raw)) return null;
  const sender = getString(raw, 'sender');
  const createdAt = getString(raw, 'createdAt');
  if (!sender || !createdAt) return null;

  const attachments = parseAttachments(raw);
  return {
    id: getString(raw, 'id'),
    tempId: getString(raw, 'tempId'),
    status: toStatus(raw.status),
    content: typeof raw.content === 'string' ? raw.content : null,
    sender,
    receiver: getString(raw, 'receiver') ?? '',
    createdAt,
    attachments: attachments.length > 0 ? attachments : undefined,
    hasAttachments: getBoolean(raw, 'hasAttachments'),
    isRead: getBoolean(raw, 'isRead'),
  };
};

/** Bỏ các field `undefined` để khi merge không ghi đè giá trị đang có. */
const definedFields = (message: Partial<Message>): Partial<Message> =>
  Object.fromEntries(Object.entries(message).filter(([, value]) => value !== undefined));

const getMessageTime = (message: Message): number => {
  const timestamp = new Date(message.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const PENDING_MATCH_WINDOW_MS = 15_000;
const DUPLICATE_MATCH_WINDOW_MS = 2_000;

const isSameText = (a: Message, b: Message) =>
  a.sender === b.sender && a.receiver === b.receiver && (a.content ?? '') === (b.content ?? '');

const isSamePendingMessage = (current: Message, next: Message) => {
  const currentTime = getMessageTime(current);
  const nextTime = getMessageTime(next);
  const isRecent =
    currentTime > 0 && nextTime > 0 && Math.abs(currentTime - nextTime) < PENDING_MATCH_WINDOW_MS;
  const isPending = current.status === 'sending' || Boolean(current.tempId && !current.id);
  return isSameText(current, next) && isRecent && isPending;
};

/** Thêm hoặc cập nhật một tin trong danh sách. */
export const upsertMessage = (messages: Message[], incoming: Message): Message[] => {
  const index = messages.findIndex(
    (m) =>
      (incoming.id !== undefined && m.id === incoming.id) ||
      (incoming.tempId !== undefined && m.tempId === incoming.tempId) ||
      isSamePendingMessage(m, incoming) ||
      (isSameText(m, incoming) &&
        Math.abs(getMessageTime(m) - getMessageTime(incoming)) < DUPLICATE_MATCH_WINDOW_MS),
  );

  if (index < 0) return [...messages, incoming];

  const next = [...messages];
  next[index] = { ...next[index], ...definedFields(incoming) };
  return next;
};

/** Cập nhật một tin theo `tempId`; không tìm thấy thì giữ nguyên danh sách. */
export const patchMessage = (
  messages: Message[],
  tempId: string,
  patch: Partial<Message>,
): Message[] => {
  const index = messages.findIndex((m) => m.tempId === tempId);
  if (index < 0) return messages;
  const next = [...messages];
  next[index] = { ...next[index], ...patch };
  return next;
};

export const getMessageKey = (message: Message): string =>
  message.id ?? message.tempId ?? `${message.sender}-${message.createdAt}`;
