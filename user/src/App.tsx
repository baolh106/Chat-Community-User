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
    error,
    canSend,
    statusText,
    setNickname,
    setDraft,
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
            error={error}
            onDraftChange={setDraft}
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
