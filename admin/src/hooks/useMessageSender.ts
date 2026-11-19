import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSocket, Attachment, Message, SocketFilePayload } from '../types';
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

/** Cập nhật danh sách tin của một cuộc hội thoại (key = id người chat cùng). */
export type UpdateConversation = (
  conversationKey: string,
  update: (messages: Message[]) => Message[],
) => void;

type Options = {
  socket: AppSocket | null;
  isActive: boolean;
  senderId: string | null;
  updateConversation: UpdateConversation;
  onError: (message: string | null) => void;
};

/**
 * Soạn và gửi tin (draft, file đính kèm, tin optimistic) và xử lý phản hồi
 * của server cho tin đã gửi (ack, đang upload, lỗi).
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
  const [isSending, setIsSending] = useState(false);
  // Chặn gửi chồng khi người dùng bấm liên tục trước khi state kịp cập nhật.
  const isSendingRef = useRef(false);
  // tempId → conversation key, để biết event phản hồi thuộc hội thoại nào.
  const pendingReceiversRef = useRef(new Map<string, string>());
  const reportError = useEventCallback(onError);

  const reset = useCallback(() => {
    setDraft('');
    setSelectedFilesState([]);
    setIsSending(false);
    isSendingRef.current = false;
    pendingReceiversRef.current.clear();
  }, []);

  useEffect(() => {
    if (!isActive) reset();
  }, [isActive, reset]);

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
      reportError(getErrorMessage(err, 'Không thể đọc file đính kèm'));
      setIsSending(false);
      isSendingRef.current = false;
      return;
    }

    setDraft('');
    setSelectedFilesState([]);

    const tempId = generateId();
    const optimistic: Message = {
      tempId,
      content: content || null,
      sender: senderId,
      receiver,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    pendingReceiversRef.current.set(tempId, receiver);
    updateConversation(receiver, (list) => upsertMessage(list, optimistic));
    socket.emit('message:send', { tempId, content: content || null, receiver, files: socketFiles });

    setIsSending(false);
    isSendingRef.current = false;
  });

  /** Conversation key của một phản hồi: ưu tiên receiver trong payload, sau đó tới tempId đã ghi nhận. */
  const resolveConversation = (payload: Record<string, unknown>, tempId: string | undefined) =>
    getString(payload, 'receiver') ?? (tempId ? pendingReceiversRef.current.get(tempId) : undefined);

  useSocketEvent(socket, 'message:send:ack', (payload) => {
    if (!isRecord(payload) || payload.ok !== true) return;
    const message = parseMessage(payload.message);
    if (!message) return;
    const tempId = getString(payload, 'tempId');
    const conversationKey = (tempId && pendingReceiversRef.current.get(tempId)) || message.receiver;
    if (tempId) pendingReceiversRef.current.delete(tempId);
    updateConversation(conversationKey, (list) =>
      upsertMessage(list, { ...message, tempId: tempId ?? message.tempId, status: 'sent' }),
    );
  });

  useSocketEvent(socket, 'message:uploading', (payload) => {
    if (!isRecord(payload)) return;
    const tempId = getString(payload, 'tempId');
    const conversationKey = resolveConversation(payload, tempId);
    if (!tempId || !conversationKey) return;
    updateConversation(conversationKey, (list) =>
      patchMessage(list, tempId, {
        status: 'sending',
        uploadingFileName: getString(payload, 'fileName'),
      }),
    );
  });

  useSocketEvent(socket, 'message:upload:error', (payload) => {
    reportError(mapMessageError(getReason(payload)));
    if (!isRecord(payload)) return;
    const tempId = getString(payload, 'tempId');
    const conversationKey = resolveConversation(payload, tempId);
    if (!tempId || !conversationKey) return;
    updateConversation(conversationKey, (list) => patchMessage(list, tempId, { status: 'failed' }));
  });

  useSocketEvent(socket, 'message:error', (payload) => {
    reportError(mapMessageError(getReason(payload)));
  });

  return {
    draft,
    setDraft,
    selectedFiles,
    setSelectedFiles,
    clearAttachment,
    isSending,
    hasContent: draft.trim().length > 0 || selectedFiles.length > 0,
    sendMessage,
  };
};
