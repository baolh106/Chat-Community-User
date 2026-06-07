import type { Message } from '../types';

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  userId: string | null;
}

const formatFileSize = (size?: number) => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const getSenderLabel = (message: Message, isMine: boolean) => {
  if (isMine) return 'You';
  if (message.sender === 'system') return 'System';
  return 'Admin';
};

const imageExtensions = ['.apng', '.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp'];

const isImageAttachment = (message: Message) => {
  if (message.attachmentType === 'image' || message.imageURL) return true;
  if (message.fileMimeType?.startsWith('image/')) return true;
  const fileName = message.fileName?.toLowerCase().trim() || '';
  return imageExtensions.some((extension) => fileName.endsWith(extension));
};

const getDriveImageURL = (message: Message) => {
  if (message.fileDriveId) {
    return `https://drive.google.com/thumbnail?id=${message.fileDriveId}&sz=w1000`;
  }

  const driveFileId = (message.imageURL || message.fileURL)?.match(/\/file\/d\/([^/]+)/)?.[1];
  return driveFileId ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1000` : null;
};

const getImageSrc = (message: Message) => {
  if (!isImageAttachment(message)) return null;

  const sourceURL = message.imageURL || message.fileURL || message.fileDownloadURL || null;
  if (!sourceURL) return null;
  if (sourceURL.startsWith('blob:')) return sourceURL;

  return getDriveImageURL(message) || sourceURL;
};

export const MessageItem = ({ message, isMine }: MessageItemProps) => {
  const imageSrc = getImageSrc(message);
  const hasFile = Boolean(!imageSrc && (message.attachmentType === 'file' || message.fileURL));
  const hasContent = Boolean(message.content);
  const isSending = (message as any).status === 'sending';

  return (
    <div
      className={`message-item ${isMine ? 'mine' : 'other'}`}
      style={{ 
        background: isMine ? '#fdf2f8' : '#ffffff',
        color: '#1e293b',
        border: 'none',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02)',
        borderRadius: '12px',
        width: 'fit-content',
        maxWidth: '85%',
        wordBreak: 'break-word',
        opacity: (message as any).status === 'sending' ? 0.6 : 1
      }}
    >
      {hasContent && <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>}

      {imageSrc && (
        <a href={imageSrc} target="_blank" rel="noreferrer" className="message-image-link">
          <img src={imageSrc} alt={message.fileName || 'attachment'} className="message-image" />
        </a>
      )}

      {hasFile && (
        <div className="message-file">
          <div className="file-icon">FILE</div>
          <div className="file-details">
              <a href={message.fileURL} target="_blank" rel="noreferrer" className="file-name">
              {message.fileName || 'Attachment'}
            </a>
            <div className="file-meta">
              {[message.fileMimeType, formatFileSize(message.fileSize)].filter(Boolean).join(' - ')}
            </div>
          </div>
          {message.fileDownloadURL && (
            <a href={message.fileDownloadURL} target="_blank" rel="noreferrer" className="download-link">
              Download
            </a>
          )}
        </div>
      )}

      {!hasContent && !imageSrc && !hasFile && (
        <div className="message-content">
          {isSending || message.fileName ? (
            <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
              {message.fileName ? `Processing ${message.fileName}...` : 'Sending...'}
            </span>
          ) : (
            'Message has no content'
          )}
        </div>
      )}

      <div className="message-meta">
        <span>{getSenderLabel(message, isMine)}</span>
        <span>{new Date(message.createdAt).toLocaleTimeString('en-US')}</span>
        {isMine && (message as any).status === 'sending' && <span> • Sending...</span>}
        {isMine && (message as any).status === 'failed' && <span style={{ color: '#ef4444' }}> • Failed</span>}
      </div>
    </div>
  );
};
