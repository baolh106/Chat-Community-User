import { useState } from 'react';
import type { Message } from '../types';

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  userId: string | null;
}

// Define AttachmentItem interface
interface AttachmentItem {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
  type: 'image' | 'file';
  isUnsafe?: boolean;
  unsafeReason?: string;
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
  return message.sender || 'User';
};

const getDisplayURL = (url: string) => {
  if (!url || url.startsWith('blob:')) return url;
  const driveFileId = url.match(/\/file\/d\/([^/]+)/)?.[1];
  return driveFileId ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1000` : url;
};

const getDownloadURL = (url: string) => {
  if (!url) return url;
  const driveFileId = url.match(/\/file\/d\/([^/]+)/)?.[1] || url.match(/[?&]id=([^&]+)/)?.[1];
  return driveFileId ? `https://drive.google.com/uc?export=download&id=${driveFileId}` : url;
};

const ImageModal = ({ attachment, onClose }: { attachment: AttachmentItem; onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(s => Math.min(Math.max(s + delta, 0.5), 10));
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

  const { url, isUnsafe, unsafeReason } = attachment; // Destructure isUnsafe and unsafeReason

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', cursor: 'zoom-out',
        // backdropFilter: 'blur(8px)', // Removed as it might conflict with image blur
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
        <img
          src={getDisplayURL(url)}
          alt="Preview"
          style={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            borderRadius: '4px',
            pointerEvents: 'none',
            filter: isUnsafe ? 'blur(10px)' : 'none', // Apply blur if unsafe
          }}
        />
        {isUnsafe && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '1.2rem',
              fontWeight: 'bold', textAlign: 'center', borderRadius: '4px', 
              padding: '10px', // Added padding
              whiteSpace: 'nowrap', // Prevent vertical wrapping
              minWidth: '150px',   // Ensure minimum width for text
              boxSizing: 'border-box',
              wordBreak: 'keep-all', // Ensure text stays horizontal as much as possible
              pointerEvents: 'none', // Allow clicks to pass through to the image container
            }}
          >
            {unsafeReason || 'Inappropriate content'}
          </div>
        )}
      </div>
    </div>
  );
};

const AttachmentList = ({ message, onImageClick }: { message: Message; onImageClick: (attachment: AttachmentItem) => void }) => {
  if (!message.attachments || message.attachments.length === 0) return null;

  return (
    <div className="message-attachments" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      {message.attachments.map((att, index) => (
        <div key={index} className="attachment-item">
          {att.type === 'image' ? ( // Cast att to AttachmentItem to ensure isUnsafe is available
            <div
              onClick={() => onImageClick(att as AttachmentItem)} // Pass the entire attachment object
              className="message-image-link"
              style={{ cursor: 'pointer', position: 'relative' }} // Added position: 'relative' for overlay
            >
              <img
                src={getDisplayURL(att.url)}
                alt={att.name}
                className="message-image"
                style={{ maxWidth: '100%', borderRadius: '8px', filter: att.isUnsafe ? 'blur(10px)' : 'none' }} // Apply blur to thumbnail
              />
              {att.isUnsafe && (
                <div
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.8rem',
                    fontWeight: 'bold', textAlign: 'center', borderRadius: '4px', 
                    padding: '8px', // Added padding
                    whiteSpace: 'nowrap', // Prevent vertical wrapping
                    minWidth: '100px', // Ensure minimum width for text
                    boxSizing: 'border-box',
                    wordBreak: 'keep-all',
                    pointerEvents: 'none', // Allow clicks to pass through
                  }}
                >
                  Unsafe Content
                </div>
              )}
            </div>
          ) : (
            <div className="message-file" style={{ background: 'rgba(0,0,0,0.03)', borderRadius: '8px', padding: '8px' }}>
              <div className="file-icon">FILE</div>
              <div className="file-details">
                <a 
                  href={getDownloadURL(att.url)} 
                  download={att.name} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="file-name"
                >
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
  // previewAttachment now stores AttachmentItem
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

  return (
    <>
      <div
        className={`message-item ${isMine ? 'mine' : 'other'}`}
        style={{ 
          background: isMine ? '#ececffb4' : '#ffffff',
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

        {/* Pass the setter directly, it will receive the AttachmentItem */}
        <AttachmentList message={message} onImageClick={setPreviewAttachment} />

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
        </div>
      </div>
      {/* ImageModal now receives attachment object */}
      {previewAttachment && <ImageModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
    </>
  );
};
