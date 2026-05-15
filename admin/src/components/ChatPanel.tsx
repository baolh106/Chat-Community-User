import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import type { Message } from '../types';

interface ChatPanelProps {
  userId: string;
  messages: Message[];
  draft: string;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void;
  onResetSession: () => void;
  canSend: boolean;
}

export const ChatPanel = ({
  userId,
  messages,
  draft,
  error,
  onDraftChange,
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
        onDraftChange={onDraftChange}
        onSendMessage={onSendMessage}
        canSend={canSend}
      />

      {error && <div className="error-box">{error}</div>}
    </div>
  );
};
