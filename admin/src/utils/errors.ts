import { MAX_ATTACHMENT_SIZE_MB } from './files';

const MESSAGE_ERRORS: Record<string, string> = {
  file_too_large: `File vượt quá giới hạn ${MAX_ATTACHMENT_SIZE_MB}MB`,
  invalid_file_payload: 'File đính kèm không hợp lệ',
  'message content or file is required': 'Nhập nội dung hoặc chọn file để gửi',
  invalid_payload: 'Thiếu người nhận tin nhắn',
  unauthorized: 'Phiên đăng nhập không hợp lệ',
  timeout: 'Không nhận được phản hồi từ server',
};

export const mapMessageError = (reason?: string): string =>
  (reason && MESSAGE_ERRORS[reason]) || reason || 'Gửi message thất bại';

export const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;
