import { useRef, type ClipboardEvent } from 'react';

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
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
    <div className="composer">
      {selectedFiles.length > 0 && (
        <div className="attachment-previews" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {selectedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="attachment-preview">
              <div className="attachment-summary">
                <span className="attachment-icon">{file.type.startsWith('image/') ? 'IMG' : 'FILE'}</span>
                <div>
                  <div className="attachment-name">{file.name}</div>
                  <div className="attachment-size">{formatFileSize(file.size)}</div>
                </div>
              </div>
              <button className="icon-button" type="button" onClick={() => removeFile(index)} disabled={isSending} title="Gỡ bỏ">
                ✕
              </button>
            </div>
          ))}
          {selectedFiles.length > 1 && (
            <button className="secondary-button" type="button" onClick={clearAttachment} disabled={isSending} style={{ alignSelf: 'flex-end', fontSize: '0.8rem', padding: '4px 8px' }}>
              Xóa tất cả
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
      />

      <div className="composer-actions">
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          multiple
          onChange={(e) => onFileChange(Array.from(e.target.files ?? []))}
          disabled={isSending}
        />
        <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
          Attach
        </button>
        <button type="button" onClick={() => void onSendMessage()} disabled={!canSend}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
