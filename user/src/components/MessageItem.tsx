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
  return imageExtensions.some((extension) => message.fileName?.toLowerCase().endsWith(extension));
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

  return (
    <div className={`message-item ${isMine ? 'mine' : 'other'}`}>
      {hasContent && <div className="message-content">{message.content}</div>}

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

      {!hasContent && !imageSrc && !hasFile && <div className="message-content">Message has no content</div>}

      <div className="message-meta">
        <span>{getSenderLabel(message, isMine)}</span>
        <span>{new Date(message.createdAt).toLocaleTimeString('en-US')}</span>
      </div>
    </div>
  );
};
