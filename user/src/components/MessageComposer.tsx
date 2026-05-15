interface MessageComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
}

export const MessageComposer = ({
  draft,
  onDraftChange,
  onSendMessage,
  canSend,
}: MessageComposerProps) => {
  return (
    <div className="composer">
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && canSend) {
            e.preventDefault();
            onSendMessage();
          }
        }}
        placeholder="Nhập tin nhắn của bạn..."
      />
      <div className="composer-actions">
        <button onClick={onSendMessage} disabled={!canSend}>
          Gửi
        </button>
      </div>
    </div>
  );
};
