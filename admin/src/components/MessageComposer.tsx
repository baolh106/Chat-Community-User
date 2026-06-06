import { useRef, type ClipboardEvent } from 'react';

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

interface MessageComposerProps {
  draft: string;
  selectedFile: File | null;
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onClearAttachment: () => void;
  onSendMessage: () => void | Promise<void>;
  canSend: boolean;
}

export const MessageComposer = ({
  draft,
  selectedFile,
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

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (isSending) return;

    const imageItem = Array.from(event.clipboardData.items).find(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    );
    const pastedFile = imageItem?.getAsFile();

    if (!pastedFile) return;

    event.preventDefault();

    const extension = pastedFile.type.split('/')[1] || 'png';
    const file =
      pastedFile.name.length > 0
        ? pastedFile
        : new File([pastedFile], `pasted-image.${extension}`, {
            type: pastedFile.type || 'image/png',
            lastModified: Date.now(),
          });

    onFileChange(file);
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
      {selectedFile && (
        <div className="attachment-preview">
          <div className="attachment-summary">
            <span className="attachment-icon">{selectedFile.type.startsWith('image/') ? 'IMG' : 'FILE'}</span>
            <div>
              <div className="attachment-name">{selectedFile.name}</div>
              <div className="attachment-size">{formatFileSize(selectedFile.size)}</div>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={clearAttachment} disabled={isSending}>
            Xóa
          </button>
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
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
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
