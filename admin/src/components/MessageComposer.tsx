import { useRef, useState, useEffect, type ClipboardEvent } from 'react';

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const ImageThumbnail = ({ file }: { file: File }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;
  return (
    <img src={url} alt="preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
  );
};

interface MessageComposerProps {
  draft: string;
  selectedFiles: File[];
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onFileChange: (files: File[]) => void;
  onClearAttachment: () => void;
  onSendMessage: () => void | Promise<void>;
  canSend: boolean;
}

export const MessageComposer = ({
  draft,
  selectedFiles,
  isSending,
  onDraftChange,
  onFileChange,
  onClearAttachment,
  onSendMessage,
  canSend,
}: MessageComposerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearAttachment = () => {
    onClearAttachment();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    onFileChange(selectedFiles.filter((_, index) => index !== indexToRemove));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (isSending) return;

    const imageItems = Array.from(event.clipboardData.items).filter(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    );

    if (imageItems.length === 0) return;

    event.preventDefault();
    const newFiles: File[] = [];

    imageItems.forEach((item, index) => {
      const pastedFile = item.getAsFile();
      if (pastedFile) {
        const extension = pastedFile.type.split('/')[1] || 'png';
        const file = pastedFile.name.length > 0 && pastedFile.name !== 'image.png'
          ? pastedFile
          : new File([pastedFile], `pasted-image-${Date.now()}-${index}.${extension}`, {
              type: pastedFile.type || 'image/png',
              lastModified: Date.now(),
            });
        newFiles.push(file);
      }
    });

    onFileChange([...selectedFiles, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      className="composer" 
      style={{ 
        backgroundColor: '#ffffff', 
        borderTop: '1px solid #e2e8f0', 
        padding: '16px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px' 
      }}
    >
      {selectedFiles.length > 0 && (
        <div className="attachment-previews" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {selectedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="attachment-preview" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
              <div className="attachment-summary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {file.type.startsWith('image/') ? (
                  <ImageThumbnail file={file} />
                ) : (
                  <span className="attachment-icon" style={{ fontSize: '0.8rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>FILE</span>
                )}
                <div>
                  <div className="attachment-name" style={{ fontSize: '0.9rem', fontWeight: '500' }}>{file.name}</div>
                  <div className="attachment-size" style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatFileSize(file.size)}</div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => removeFile(index)} 
                disabled={isSending} 
                style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}
                title="Gỡ bỏ"
              >
                ✕
              </button>
            </div>
          ))}
          {selectedFiles.length > 1 && (
            <button type="button" onClick={clearAttachment} disabled={isSending} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', alignSelf: 'flex-end', padding: '4px 0' }}>
              Xóa tất cả ({selectedFiles.length})
            </button>
          )}
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && canSend) {
            e.preventDefault();
            void onSendMessage();
          }
        }}
        placeholder="Type your message..."
        disabled={isSending}
        style={{
          width: '100%',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '0.95rem',
          color: '#1e293b',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)',
          outline: 'none',
          resize: 'none',
          minHeight: '120px',
          fontFamily: 'inherit'
        }}
      />

      <div className="composer-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          multiple
          onChange={(e) => onFileChange(Array.from(e.target.files ?? []))}
          disabled={isSending}
        />
        <button 
          type="button" 
          className="secondary-button" 
          onClick={() => fileInputRef.current?.click()} 
          disabled={isSending}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            color: '#64748b',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Attach
        </button>
        <button 
          type="button" 
          onClick={() => void onSendMessage()} 
          disabled={!canSend}
          style={{ 
            padding: '8px 20px', 
            borderRadius: '8px', 
            border: 'none', 
            background: canSend ? '#6366f1' : '#e2e8f0', 
            color: '#fff', 
            cursor: canSend ? 'pointer' : 'not-allowed', 
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
