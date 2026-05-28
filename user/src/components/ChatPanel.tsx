import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import type { Message } from '../types';

interface ChatPanelProps {
  sessionNickname: string;
  userId: string | null;
  messages: Message[];
  draft: string;
  selectedFile: File | null;
  isSending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onClearAttachment: () => void;
  onSendMessage: () => void | Promise<void>;
  onResetSession: () => void;
  canSend: boolean;
}

export const ChatPanel = ({
  sessionNickname,
  userId,
  messages,
  draft,
  selectedFile,
  isSending,
  error,
  onDraftChange,
  onFileChange,
  onClearAttachment,
  onSendMessage,
  onResetSession,
  canSend,
}: ChatPanelProps) => {
  return (
    <div className="chat-panel">
      <div className="session-info">
        <div>
          <strong>ID:</strong> {userId ?? 'Đang chờ...'}
        </div>
        <button className="small-button" onClick={onResetSession}>
          Bắt đầu lại
        </button>
      </div>

      <MessageList messages={messages} userId={userId} />

      <MessageComposer
        draft={draft}
        selectedFile={selectedFile}
        isSending={isSending}
        onDraftChange={onDraftChange}
        onFileChange={onFileChange}
        onClearAttachment={onClearAttachment}
        onSendMessage={onSendMessage}
        canSend={canSend}
      />

      {error && <div className="error-box">{error}</div>}
    </div>
  );
};
