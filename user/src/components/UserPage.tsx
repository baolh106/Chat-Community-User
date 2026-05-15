import { useChat } from '../hooks/useChat';
import { ChatHeader } from './ChatHeader';
import { LoginPanel } from './LoginPanel';
import { ChatPanel } from './ChatPanel';

export const UserPage = () => {
  const {
    nickname,
    sessionNickname,
    status,
    userId,
    messages,
    draft,
    error,
    canSend,
    statusText,
    setNickname,
    setDraft,
    startSession,
    sendMessage,
    resetSession,
  } = useChat();

  // Kiểm tra xem có đang ở màn hình đăng nhập hay không
  const isLoggingIn = !sessionNickname;

  return (
    <div className="app-container">
      <ChatHeader status={statusText} statusClass={status} />
      
      {isLoggingIn ? (
        <LoginPanel
          nickname={nickname}
          onNicknameChange={setNickname}
          onStartSession={startSession}
          error={error}
        />
      ) : (
        <ChatPanel
          sessionNickname={sessionNickname}
          userId={userId}
          messages={messages}
          draft={draft}
          error={error}
          onDraftChange={setDraft}
          onSendMessage={sendMessage}
          onResetSession={resetSession}
          canSend={canSend}
        />
      )}
    </div>
  );
};