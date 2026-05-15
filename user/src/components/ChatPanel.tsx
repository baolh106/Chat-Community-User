import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import type { Message } from '../types';

interface ChatPanelProps {
  sessionNickname: string;
  userId: string | null;
  messages: Message[];
  draft: string;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void;
  onResetSession: () => void;
  canSend: boolean;
}

export const ChatPanel = ({
  sessionNickname,
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
    <div className="chat-panel">
      <div className="session-info">
        <div>
          <strong>Nickname:</strong> {sessionNickname}
        </div>
        <div>
          <strong>UserId:</strong> {userId ?? 'Đang chờ...'}
        </div>
        <button className="small-button" onClick={onResetSession}>
          Bắt đầu lại
        </button>
      </div>

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
