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
    selectedFile,
    isSending,
    error,
    canSend,
    statusText,
    setNickname,
    setDraft,
    setSelectedFile,
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
          />
        )}
      </section>
    </div>
  );
}

export default App;
