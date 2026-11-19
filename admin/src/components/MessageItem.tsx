import { memo, useState } from 'react';
import type { Attachment, Message } from '../types';
import { formatFileSize, getDisplayURL, getDownloadURL } from '../utils/files';
import { safeUrl } from '../utils/url';

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  onRetry?: (tempId: string) => void;
}

const MINE_BACKGROUND = '#ececffb4';

const getSenderLabel = (message: Message, isMine: boolean) => {
  if (isMine) return 'You';
  if (message.sender === 'system') return 'System';
  return message.sender || 'User';
};

const ImageModal = ({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 10));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const stopDragging = () => setIsDragging(false);
  const src = safeUrl(getDisplayURL(attachment.url));
  const { isUnsafe } = attachment;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', cursor: 'zoom-out',
        userSelect: 'none'
      }}
      onClick={onClose}
      onWheel={handleWheel}
    >
      <div
        style={{
          position: 'relative',
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out'
        }}
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onDoubleClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
      >
        {src && (
          <img
            src={src}
            alt={attachment.name || 'Preview'}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '4px',
              pointerEvents: 'none',
              filter: isUnsafe ? 'blur(10px)' : 'none',
            }}
          />
        )}
        {isUnsafe && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '1.2rem',
              fontWeight: 'bold', textAlign: 'center', borderRadius: '4px',
              padding: '10px',
              whiteSpace: 'nowrap',
              minWidth: '150px',
              boxSizing: 'border-box',
              wordBreak: 'keep-all',
              pointerEvents: 'none',
            }}
          >
            {attachment.unsafeReason || 'Inappropriate content'}
          </div>
        )}
      </div>
    </div>
  );
};

const ImageAttachment = ({ attachment, onOpen }: { attachment: Attachment; onOpen: () => void }) => {
  const src = safeUrl(getDisplayURL(attachment.url));
  if (!src) return <div className="file-name">{attachment.name}</div>;

  return (
    <div
      onClick={onOpen}
      className="message-image-link"
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      <img
        src={src}
        alt={attachment.name}
        className="message-image"
        style={{ maxWidth: '100%', borderRadius: '8px', filter: attachment.isUnsafe ? 'blur(10px)' : 'none' }}
      />
      {attachment.isUnsafe && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.8rem',
            fontWeight: 'bold', textAlign: 'center', borderRadius: '4px',
            padding: '8px',
            whiteSpace: 'nowrap',
            minWidth: '100px',
            boxSizing: 'border-box',
            wordBreak: 'keep-all',
            pointerEvents: 'none',
          }}
        >
          Unsafe Content
        </div>
      )}
    </div>
  );
};

const FileAttachment = ({ attachment }: { attachment: Attachment }) => {
  const href = safeUrl(getDownloadURL(attachment.url));
  return (
    <div className="message-file" style={{ background: 'rgba(0,0,0,0.03)', borderRadius: '8px', padding: '8px' }}>
      <div className="file-icon">FILE</div>
      <div className="file-details">
        {href ? (
          <a href={href} download={attachment.name} target="_blank" rel="noopener noreferrer" className="file-name">
            {attachment.name}
          </a>
        ) : (
          <span className="file-name">{attachment.name}</span>
        )}
        <div className="file-meta">{formatFileSize(attachment.size)}</div>
      </div>
    </div>
  );
};

const AttachmentList = ({ attachments, onImageClick }: { attachments: Attachment[]; onImageClick: (attachment: Attachment) => void }) => (
  <div className="message-attachments" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
    {attachments.map((attachment, index) => (
      <div key={`${index}-${attachment.url}`} className="attachment-item">
        {attachment.type === 'image' ? (
          <ImageAttachment attachment={attachment} onOpen={() => onImageClick(attachment)} />
        ) : (
          <FileAttachment attachment={attachment} />
        )}
      </div>
    ))}
  </div>
);

export const MessageItem = memo(function MessageItem({ message, isMine, onRetry }: MessageItemProps) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const hasContent = Boolean(message.content);
  const attachments = message.attachments ?? [];
  const hasAttachments = Boolean(message.hasAttachments || attachments.length > 0);
  const isSending = message.status === 'sending';
  const isFailed = message.status === 'failed';
  const { tempId } = message;

  return (
    <>
      <div
        className={`message-item ${isMine ? 'mine' : 'other'}`}
        style={{
          background: isMine ? MINE_BACKGROUND : '#ffffff',
          color: '#1e293b',
          border: 'none',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02)',
          borderRadius: '12px',
          width: 'fit-content',
          maxWidth: '85%',
          wordBreak: 'break-word',
          opacity: isSending ? 0.6 : 1
        }}
      >
        {hasContent && <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>}

        {attachments.length > 0 && (
          <AttachmentList attachments={attachments} onImageClick={setPreviewAttachment} />
        )}

        {!hasContent && !hasAttachments && (
          <div className="message-content">
            {isSending ? (
              <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
                {message.uploadingFileName ? `Processing ${message.uploadingFileName}...` : 'Sending...'}
              </span>
            ) : (
              'Message has no content'
            )}
          </div>
        )}

        <div className="message-meta">
          <span>{getSenderLabel(message, isMine)}</span>
          <span>{new Date(message.createdAt).toLocaleTimeString('en-US')}</span>
          {isMine && isSending && <span> • Sending...</span>}
          {isMine && isFailed && (
            <span className="message-failed">
              {' • Failed'}
              {onRetry && tempId && (
                <button type="button" className="message-retry" onClick={() => onRetry(tempId)}>
                  Gửi lại
                </button>
              )}
            </span>
          )}
        </div>
      </div>
      {previewAttachment && <ImageModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
    </>
  );
});
