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
    selectedFile,
    isSending,
    error,
    canSend,
    statusText,
    videoCall,
    setNickname,
    setCaptchaToken,
    setDraft,
    setSelectedFile,
    clearAttachment,
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
          onCaptchaChange={setCaptchaToken}
          error={error}
        />
      ) : (
        <ChatPanel
          sessionNickname={sessionNickname}
          userId={userId}
          messages={messages}
          draft={draft}
          selectedFile={selectedFile}
          isSending={isSending}
          error={error}
          onDraftChange={setDraft}
          onFileChange={setSelectedFile}
          onClearAttachment={clearAttachment}
          onSendMessage={sendMessage}
          onResetSession={resetSession}
          canSend={canSend}
          videoCall={videoCall}
        />
      )}
    </div>
  );
};
