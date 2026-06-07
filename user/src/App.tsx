import { ChatHeader, LoginPanel, ChatPanel } from './components';
import { useChat } from './hooks/useChat';

function App() {
  const {
    nickname,
    sessionNickname,
    status,
    userId,
    messages,
    draft,
    selectedFiles,
    isSending,
    error,
    canSend,
    statusText,
    videoCall,
    setNickname,
    setCaptchaToken,
    setDraft,
    setSelectedFiles,
    clearAttachment,
    startSession,
    sendMessage,
    resetSession,
  } = useChat();

  return (
    <div className="page-shell">
      <section className="chat-card">
        <ChatHeader status={statusText} statusClass={status} />

        {!sessionNickname ? (
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
            selectedFiles={selectedFiles}
            isSending={isSending}
            error={error}
            onDraftChange={setDraft}
            onFileChange={setSelectedFiles}
            onClearAttachment={clearAttachment}
            onSendMessage={sendMessage}
            onResetSession={resetSession}
            canSend={canSend}
            videoCall={videoCall}
          />
        )}
      </section>
    </div>
  );
}

export default App;
