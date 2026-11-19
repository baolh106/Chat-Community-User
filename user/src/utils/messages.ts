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

/** Hai bản ghi là cùng một tin khi trùng id (server) hoặc trùng tempId (client). */
const isSameMessage = (existing: Message, incoming: Message) =>
  (incoming.id !== undefined && existing.id === incoming.id) ||
  (incoming.tempId !== undefined && existing.tempId === incoming.tempId);

/**
 * Thêm hoặc cập nhật một tin. Chỉ khớp theo `id`/`tempId`, không đoán theo nội dung
 * hay thời gian (gửi hai tin giống nhau liên tiếp phải ra hai tin).
 *
 * Nếu `message:new` (chỉ có `id`) đến trước ack (có cả `id` và `tempId`), danh sách
 * tạm có hai bản; ack sẽ khớp cả hai và gộp lại thành một.
 */
export const upsertMessage = (messages: Message[], incoming: Message): Message[] => {
  const matchIndexes = messages.flatMap((m, index) => (isSameMessage(m, incoming) ? [index] : []));
  if (matchIndexes.length === 0) return [...messages, incoming];

  const [firstIndex, ...duplicateIndexes] = matchIndexes;
  const merged = [...duplicateIndexes.map((i) => messages[i]), incoming].reduce<Message>(
    (acc, message) => ({ ...acc, ...definedFields(message) }),
    messages[firstIndex],
  );

  const duplicates = new Set(duplicateIndexes);
  return messages
    .map((m, index) => (index === firstIndex ? merged : m))
    .filter((_, index) => !duplicates.has(index));
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
