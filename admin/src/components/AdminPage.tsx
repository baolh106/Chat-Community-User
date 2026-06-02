import { useChat } from '../hooks/useChat';
import { ChatHeader } from './ChatHeader';
import { ChatPanel } from './ChatPanel';
import { LoginPanel } from './LoginPanel';

export const AdminPage = () => {
  const {
    password,
    sessionNickname,
    status,
    onlineUsers,
    selectedUserId,
    messages,
    draft,
    selectedFile,
    isSending,
    error,
    canSend,
    statusText,
    videoCall,
    setPassword,
    setCaptchaToken,
    setDraft,
    setSelectedFile,
    clearAttachment,
    setSelectedUserId,
    unreadCounts,
    startSession,
    sendMessage,
    resetSession,
  } = useChat();

  const isLoggingIn = !sessionNickname;

  return (
    <div className="app-container admin-theme" style={{ 
      display: 'flex', 
      flexDirection: 'column'
    }}>
      <ChatHeader status={statusText} statusClass={status} />
      
      {isLoggingIn ? (
        <LoginPanel
          password={password}
          onPasswordChange={setPassword}
          onLogin={startSession}
          onCaptchaChange={setCaptchaToken}
          error={error}
        />
      ) : (
        <div className="admin-layout" style={{ 
          display: 'flex', 
          gap: '20px', 
          flex: 1,
          padding: '0 10px 10px 10px'
        }}>
          {/* Danh sách User Online bên trái */}
          <div className="user-sidebar" style={{ 
            width: '30%',
            minWidth: '250px',
            maxWidth: '350px',
            background: '#fff', 
            borderRadius: '12px', 
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #fce7f3',
            overflow: 'hidden'
          }}>
            <h3 style={{ color: '#db2777', marginBottom: '15px', fontSize: '1.1rem' }}>
              Online users ({onlineUsers.length})
            </h3>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {onlineUsers.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: '#999', textAlign: 'center' }}>No users online...</p>
                ) : (
                  onlineUsers.map(uId => (
                    <li 
                      key={uId} 
                      onClick={() => setSelectedUserId(uId)}
                      style={{ 
                        padding: '15px', 
                        cursor: 'pointer', 
                        backgroundColor: selectedUserId === uId ? '#fdf2f8' : 'transparent',
                        borderLeft: selectedUserId === uId ? '4px solid #db2777' : '4px solid transparent',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        transition: 'all 0.2s',
                        fontSize: '0.9rem',
                        fontWeight: selectedUserId === uId ? '600' : '400',
                        border: '1px solid',
                        borderColor: selectedUserId === uId ? '#fbcfe8' : '#f3f4f6',
                        boxShadow: selectedUserId === uId ? '0 2px 4px rgba(219, 39, 119, 0.1)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>👤</span>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {uId}
                        </div>
                        {/* Unread badge */}
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                          {unreadCounts && unreadCounts[uId] > 0 ? (
                            <span style={{
                              background: '#ef4444',
                              color: '#fff',
                              borderRadius: '999px',
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              minWidth: '24px',
                              textAlign: 'center'
                            }}>{unreadCounts[uId]}</span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Khung chat bên phải */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="session-info" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="small-button"
                  onClick={() => videoCall.startCall()}
                  disabled={!videoCall.canStartCall}
                  style={{ background: '#db2777', color: '#fff', border: 'none' }}
                >📹 Video call</button>
                {!videoCall.isVideoCallModalVisible && (videoCall.activeCalls.length > 0 || videoCall.incomingCalls.length > 0) && (
                  <button
                    className="small-button notification-button"
                    onClick={videoCall.toggleVideoCallModal}
                    style={{
                      background: '#f59e0b',
                      color: '#fff',
                      border: 'none',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    📞
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '20px',
                      height: '20px',
                      background: '#dc2626',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      {videoCall.activeCalls.length + videoCall.incomingCalls.length}
                    </span>
                  </button>
                )}
                <button className="small-button" onClick={resetSession} style={{ background: '#9b1d4a', color: '#fff', border: 'none' }}>Reset Session</button>
              </div>
            </div>

            {selectedUserId ? (
              <ChatPanel
                userId="admin"
                messages={messages} // 'messages' from useChat is now already filtered for the selected user
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
            ) : (
              <div className="chat-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="messages-box">
                  <div className="empty-state">Select a user to start support</div>
                </div>

                <div className="composer">
                  <textarea placeholder="Type your message..." disabled />
                  <div className="composer-actions">
                    <button type="button" className="secondary-button" disabled>
                      Attach
                    </button>
                    <button type="button" disabled>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
