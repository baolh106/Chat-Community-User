import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSocket, Attachment, Message, SendMessagePayload, SocketFilePayload } from '../types';
import {
  DEFAULT_MIME_TYPE,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENT_SIZE_MB,
  isImageFile,
  toBase64,
} from '../utils/files';
import { getErrorMessage, mapMessageError } from '../utils/errors';
import { getReason, getString, isRecord } from '../utils/guards';
import { generateId } from '../utils/id';
import { parseMessage, patchMessage, upsertMessage } from '../utils/messages';
import { useEventCallback } from './useEventCallback';
import { useSocketEvent } from './useSocketEvent';

/** Không có ack trong khoảng này thì coi tin gửi thất bại. */
const SEND_TIMEOUT_MS = 15_000;
/** Tin có file cần upload lên Drive và kiểm duyệt ảnh nên chờ lâu hơn. */
const UPLOAD_TIMEOUT_MS = 60_000;

/** Cập nhật danh sách tin của một cuộc hội thoại (key = id người chat cùng). */
export type UpdateConversation = (
  conversationKey: string,
  update: (messages: Message[]) => Message[],
) => void;

/** Tin đã gửi nhưng chưa có ack: giữ payload để gửi lại và blob URL để giải phóng. */
type PendingSend = {
  conversationKey: string;
  payload: SendMessagePayload;
  blobUrls: string[];
  timer?: number;
};

type Options = {
  socket: AppSocket | null;
  isActive: boolean;
  senderId: string | null;
  updateConversation: UpdateConversation;
  onError: (message: string | null) => void;
};

/**
 * Soạn và gửi tin (draft, file đính kèm, tin optimistic) và theo dõi tin đã gửi
 * tới khi có ack: timeout thì đánh dấu `failed`, cho phép gửi lại cùng `tempId`.
 */
export const useMessageSender = ({
  socket,
  isActive,
  senderId,
  updateConversation,
  onError,
}: Options) => {
  const [draft, setDraft] = useState('');
  const [selectedFiles, setSelectedFilesState] = useState<File[]>([]);
  // `true` trong lúc đọc file đính kèm; không chặn gửi tin tiếp theo khi tin trước còn chờ ack.
  const [isSending, setIsSending] = useState(false);
  // Chặn gửi chồng khi người dùng bấm liên tục trước khi state kịp cập nhật.
  const isSendingRef = useRef(false);
  const outboxRef = useRef(new Map<string, PendingSend>());
  // Blob URL của preview vẫn đang hiển thị (server không trả attachment thay thế).
  const retainedBlobUrlsRef = useRef(new Set<string>());
  const reportError = useEventCallback(onError);

  const releaseAll = useCallback(() => {
    outboxRef.current.forEach((entry) => {
      window.clearTimeout(entry.timer);
      entry.blobUrls.forEach((url) => URL.revokeObjectURL(url));
    });
    outboxRef.current.clear();
    retainedBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    retainedBlobUrlsRef.current.clear();
  }, []);

  const reset = useCallback(() => {
    setDraft('');
    setSelectedFilesState([]);
    setIsSending(false);
    isSendingRef.current = false;
    releaseAll();
  }, [releaseAll]);

  useEffect(() => {
    if (!isActive) reset();
  }, [isActive, reset]);

  useEffect(() => releaseAll, [releaseAll]);

  const markFailed = useEventCallback((tempId: string) => {
    const entry = outboxRef.current.get(tempId);
    if (!entry) return;
    window.clearTimeout(entry.timer);
    entry.timer = undefined;
    updateConversation(entry.conversationKey, (list) =>
      patchMessage(list, tempId, { status: 'failed', uploadingFileName: undefined }),
    );
  });

  const armTimeout = useEventCallback((tempId: string, timeoutMs: number) => {
    const entry = outboxRef.current.get(tempId);
    if (!entry) return;
    window.clearTimeout(entry.timer);
    entry.timer = window.setTimeout(() => {
      markFailed(tempId);
      reportError(mapMessageError('timeout'));
    }, timeoutMs);
  });

  const timeoutFor = (payload: SendMessagePayload) =>
    payload.files.length > 0 ? UPLOAD_TIMEOUT_MS : SEND_TIMEOUT_MS;

  const setSelectedFiles = useCallback(
    (files: File[]) => {
      const tooLarge = files.find((file) => file.size > MAX_ATTACHMENT_SIZE);
      if (tooLarge) {
        reportError(`File ${tooLarge.name} vượt quá giới hạn ${MAX_ATTACHMENT_SIZE_MB}MB`);
        return;
      }
      reportError(null);
      setSelectedFilesState(files);
    },
    [reportError],
  );

  const clearAttachment = useCallback(() => setSelectedFilesState([]), []);

  const sendMessage = useEventCallback(async (receiver: string | null) => {
    const content = draft.trim();
    const files = selectedFiles;
    if (
      !socket?.connected ||
      !senderId ||
      !receiver ||
      isSendingRef.current ||
      (!content && files.length === 0)
    ) {
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const socketFiles: SocketFilePayload[] = [];
    const attachments: Attachment[] = [];
    try {
      for (const file of files) {
        const mimeType = file.type || DEFAULT_MIME_TYPE;
        socketFiles.push({ data: await toBase64(file), name: file.name, mimeType });
        attachments.push({
          url: URL.createObjectURL(file),
          name: file.name,
          mimeType,
          size: file.size,
          type: isImageFile(file) ? 'image' : 'file',
        });
      }
    } catch (err) {
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      reportError(getErrorMessage(err, 'Không thể đọc file đính kèm'));
      setIsSending(false);
      isSendingRef.current = false;
      return;
    }

    setDraft('');
    setSelectedFilesState([]);

    const tempId = generateId();
    const payload: SendMessagePayload = {
      tempId,
      content: content || null,
      receiver,
      files: socketFiles,
    };
    const optimistic: Message = {
      tempId,
      content: payload.content,
      sender: senderId,
      receiver,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    outboxRef.current.set(tempId, {
      conversationKey: receiver,
      payload,
      blobUrls: attachments.map((attachment) => attachment.url),
    });
    updateConversation(receiver, (list) => upsertMessage(list, optimistic));
    socket.emit('message:send', payload);
    armTimeout(tempId, timeoutFor(payload));

    setIsSending(false);
    isSendingRef.current = false;
  });

  /** Gửi lại tin `failed` với cùng tempId để ack khớp đúng tin đang hiển thị. */
  const retryMessage = useEventCallback((tempId: string) => {
    const entry = outboxRef.current.get(tempId);
    if (!entry || !socket?.connected) return;
    reportError(null);
    updateConversation(entry.conversationKey, (list) =>
      patchMessage(list, tempId, { status: 'sending' }),
    );
    socket.emit('message:send', entry.payload);
    armTimeout(tempId, timeoutFor(entry.payload));
  });

  /** Conversation key của một phản hồi: ưu tiên receiver trong payload, sau đó tới tempId đã ghi nhận. */
  const resolveConversation = (payload: Record<string, unknown>, tempId: string | undefined) =>
    getString(payload, 'receiver') ??
    (tempId ? outboxRef.current.get(tempId)?.conversationKey : undefined);

  useSocketEvent(socket, 'message:send:ack', (payload) => {
    if (!isRecord(payload) || payload.ok !== true) return;
    const message = parseMessage(payload.message);
    if (!message) return;
    const tempId = getString(payload, 'tempId');
    const entry = tempId ? outboxRef.current.get(tempId) : undefined;

    if (tempId && entry) {
      window.clearTimeout(entry.timer);
      outboxRef.current.delete(tempId);
      // Server trả attachment thật thì preview blob không còn được dùng.
      const target = message.attachments ? null : retainedBlobUrlsRef.current;
      entry.blobUrls.forEach((url) => (target ? target.add(url) : URL.revokeObjectURL(url)));
    }

    updateConversation(entry?.conversationKey ?? message.receiver, (list) =>
      upsertMessage(list, {
        ...message,
        tempId: tempId ?? message.tempId,
        status: 'sent',
        uploadingFileName: undefined,
      }),
    );
  });

  useSocketEvent(socket, 'message:uploading', (payload) => {
    if (!isRecord(payload)) return;
    const tempId = getString(payload, 'tempId');
    const conversationKey = resolveConversation(payload, tempId);
    if (!tempId || !conversationKey) return;
    armTimeout(tempId, UPLOAD_TIMEOUT_MS);
    updateConversation(conversationKey, (list) =>
      patchMessage(list, tempId, {
        status: 'sending',
        uploadingFileName: getString(payload, 'fileName'),
      }),
    );
  });

  const handleSendError = (payload: unknown) => {
    reportError(mapMessageError(getReason(payload)));
    const tempId = isRecord(payload) ? getString(payload, 'tempId') : undefined;
    if (tempId) markFailed(tempId);
  };

  useSocketEvent(socket, 'message:upload:error', handleSendError);
  useSocketEvent(socket, 'message:error', handleSendError);

  return {
    draft,
    setDraft,
    selectedFiles,
    setSelectedFiles,
    clearAttachment,
    isSending,
    hasContent: draft.trim().length > 0 || selectedFiles.length > 0,
    sendMessage,
    retryMessage,
  };
};
