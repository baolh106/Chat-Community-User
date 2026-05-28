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
    setPassword,
    setDraft,
    setSelectedFile,
    clearAttachment,
    setSelectedUserId,
    startSession,
    sendMessage,
    resetSession,
  } = useChat();

  const isLoggingIn = !sessionNickname;

  return (
    <div className="app-container admin-theme" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      overflow: 'hidden' 
    }}>
      <ChatHeader status={statusText} statusClass={status} />
      
      {isLoggingIn ? (
        <LoginPanel
          password={password}
          onPasswordChange={setPassword}
          onLogin={startSession}
          error={error}
        />
      ) : (
        <div className="admin-layout" style={{ 
          display: 'flex', 
          gap: '20px', 
          flex: 1, // Chiếm toàn bộ phần còn lại sau Header
          minHeight: 0, // Quan trọng để các con có thể scroll được trong Flexbox
          overflow: 'hidden',
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
              Người dùng trực tuyến ({onlineUsers.length})
            </h3>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {onlineUsers.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: '#999', textAlign: 'center' }}>Chưa có người dùng nào...</p>
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
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Khung chat bên phải */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
              />
            ) : (
              <div className="empty-state">Chọn một user để bắt đầu hỗ trợ</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
