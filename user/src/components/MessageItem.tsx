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

const getDisplayURL = (url: string) => {
  if (!url || url.startsWith('blob:')) return url;
  const driveFileId = url.match(/\/file\/d\/([^/]+)/)?.[1];
  return driveFileId ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1000` : url;
};

const AttachmentList = ({ message }: { message: Message }) => {
  if (!message.attachments || message.attachments.length === 0) return null;

  return (
    <div className="message-attachments" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      {message.attachments.map((att, index) => (
        <div key={index} className="attachment-item">
          {att.type === 'image' ? (
            <a href={att.url} target="_blank" rel="noreferrer" className="message-image-link">
              <img src={getDisplayURL(att.url)} alt={att.name} className="message-image" />
            </a>
          ) : (
            <div className="message-file" style={{ background: 'rgba(0,0,0,0.03)', borderRadius: '8px', padding: '8px' }}>
              <div className="file-icon">FILE</div>
              <div className="file-details">
                <a href={att.url} target="_blank" rel="noreferrer" className="file-name">
                  {att.name}
                </a>
                <div className="file-meta">
                  {formatFileSize(att.size)}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const MessageItem = ({ message, isMine }: MessageItemProps) => {
  const hasContent = Boolean(message.content);
  const isSending = (message as any).status === 'sending';
  const hasAttachments = Boolean(message.hasAttachments || (message.attachments && message.attachments.length > 0));

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

      <AttachmentList message={message} />

      {!hasContent && !hasAttachments && (
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
