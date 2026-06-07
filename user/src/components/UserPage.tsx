import { useChat } from '../hooks/useChat';
import { LoginPanel } from './LoginPanel';
import { ChatPanel } from './ChatPanel';

export const UserPage = () => {
  const chat = useChat();
  const { sessionNickname, nickname, setNickname, startSession, setCaptchaToken, error } = chat;

  const isLoggingIn = !sessionNickname;

  return (
    <div className="user-page-wrapper" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#fdf2f8'
    }}>
      {isLoggingIn ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <LoginPanel
            nickname={nickname}
            onNicknameChange={setNickname}
            onStartSession={startSession}
            onCaptchaChange={setCaptchaToken}
            error={error}
          />
        </div>
      ) : (
        <ChatPanel
          sessionNickname={chat.sessionNickname}
          userId={chat.userId}
          messages={chat.messages}
          draft={chat.draft}
          selectedFile={chat.selectedFile}
          isSending={chat.isSending}
          error={chat.error}
          onDraftChange={chat.setDraft}
          onFileChange={chat.setSelectedFile}
          onClearAttachment={chat.clearAttachment}
          onSendMessage={chat.sendMessage}
          onResetSession={chat.resetSession}
          canSend={chat.canSend}
          videoCall={chat.videoCall}
        />
      )}
    </div>
  );
};
