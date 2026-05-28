import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import type { Message } from '../types';

interface ChatPanelProps {
  userId: string;
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
    <div className="chat-panel" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      flex: 1, 
      height: '100%', 
      overflow: 'hidden' 
    }}>

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
