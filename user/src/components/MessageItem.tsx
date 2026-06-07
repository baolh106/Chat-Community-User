import { useState } from 'react';
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

const getDownloadURL = (url: string) => {
  if (!url) return url;
  const driveFileId = url.match(/\/file\/d\/([^/]+)/)?.[1] || url.match(/[?&]id=([^&]+)/)?.[1];
  return driveFileId ? `https://drive.google.com/uc?export=download&id=${driveFileId}` : url;
};

const ImageModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
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

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', cursor: 'zoom-out',
        backdropFilter: 'blur(8px)',
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
          style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '4px', pointerEvents: 'none' }} 
        />
      </div>
    </div>
  );
};

const AttachmentList = ({ message, onImageClick }: { message: Message; onImageClick: (url: string) => void }) => {
  if (!message.attachments || message.attachments.length === 0) return null;

  return (
    <div className="message-attachments" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      {message.attachments.map((att, index) => (
        <div key={index} className="attachment-item">
          {att.type === 'image' ? (
            <div onClick={() => onImageClick(att.url)} className="message-image-link" style={{ cursor: 'pointer' }}>
              <img src={getDisplayURL(att.url)} alt={att.name} className="message-image" />
            </div>
          ) : (
            <div className="message-file" style={{ background: 'rgba(0,0,0,0.03)', borderRadius: '8px', padding: '8px' }}>
              <div className="file-icon">FILE</div>
              <div className="file-details">
                <a href={getDownloadURL(att.url)} download={att.name} target="_blank" rel="noreferrer" className="file-name">
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <>
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

        <AttachmentList message={message} onImageClick={setPreviewUrl} />

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
      {previewUrl && <ImageModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </>
  );
};
