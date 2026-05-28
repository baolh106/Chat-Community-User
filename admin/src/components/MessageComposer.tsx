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
    <div className="composer">
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
            Xoa
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
        placeholder="Nhap tin nhan cua ban..."
        disabled={isSending}
      />

      <div className="composer-actions">
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          disabled={isSending}
        />
        <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
          Dinh kem
        </button>
        <button type="button" onClick={() => void onSendMessage()} disabled={!canSend}>
          {isSending ? 'Dang gui...' : 'Gui'}
        </button>
      </div>
    </div>
  );
};
