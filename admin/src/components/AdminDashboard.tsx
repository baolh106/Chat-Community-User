import React, { useState } from 'react';
import type { useChat } from '../hooks/useChat';
import { Avatar } from './Avatar';
import { ChatPanel } from './ChatPanel';

type MenuType = 'dashboard' | 'message' | 'transaction' | 'file' | 'report' | 'setting';

interface AdminDashboardProps {
  chat: ReturnType<typeof useChat>;
}

export const AdminDashboard = ({ chat }: AdminDashboardProps) => {
  const [activeMenu, setActiveMenu] = useState<MenuType>('message');
  const { 
    onlineUsers, 
    selectedUserId, 
    setSelectedUserId, 
    unreadCounts,
    sessionNickname,
    messages,
    draft,
    selectedFiles,
    isSending,
    error,
    canSend,
    videoCall,
    setDraft,
    setSelectedFiles,
    clearAttachment,
    sendMessage,
    resetSession,
    status,
    statusText,
  } = chat;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'message', label: 'Message', icon: '💬' },
    { id: 'transaction', label: 'Transaction', icon: '💸' },
    { id: 'file', label: 'File', icon: '📁' },
    { id: 'report', label: 'Report', icon: '📈' },
    { id: 'setting', label: 'Setting', icon: '⚙️' },
  ];

  return (
    <div className="admin-layout" style={{ display: 'flex', height: '100%', width: '100%', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <aside className="sidebar" style={{ width: '280px', backgroundColor: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%' }}>
        <div className="sidebar-header" style={{ padding: '24px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ color: '#1e293b', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Admin Panel</h2>
        </div>

        <nav className="menu-list" style={{ flex: 1, padding: '16px' }}>
          {menuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveMenu(item.id as MenuType)}
              className={`menu-item ${activeMenu === item.id ? 'active' : ''}`}
              style={{
                padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px',
                display: 'flex', alignItems: 'center', gap: '12px',
                backgroundColor: activeMenu === item.id ? '#f1f5f9' : 'transparent',
                color: activeMenu === item.id ? '#0f172a' : '#64748b',
                fontWeight: activeMenu === item.id ? '600' : '500'
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ padding: '20px', borderTop: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Avatar name={sessionNickname || 'A'} size={40} />
            <div style={{ fontSize: '0.9rem', overflow: 'hidden' }}>
              <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{sessionNickname}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Administrator</div>
            </div>
          </div>
          <button 
            onClick={resetSession}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444' }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
        {/* Top Header inside Main Content */}
        <header style={{ height: '64px', minHeight: '64px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: '#1e293b', fontWeight: '600' }}>{menuItems.find(i => i.id === activeMenu)?.label}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <span className={`status-pill ${status}`} style={{ fontSize: '0.85rem' }}>{statusText}</span>
          </div>
        </header>

        {activeMenu === 'message' ? (
          <div className="chat-container" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* User List Panel */}
            <div className="user-list" style={{ width: '320px', borderRight: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px', fontWeight: '600', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.9rem' }}>
                ONLINE USERS ({onlineUsers.length})
              </div>
              <div style={{ overflowY: 'auto', height: 'calc(100% - 58px)' }}>
                {onlineUsers.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>No users online</div>
                ) : (
                  onlineUsers.filter(id => id !== 'admin').map((uId) => (
                    <div
                      key={uId}
                      onClick={() => setSelectedUserId(uId)}
                      style={{
                        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer',
                      backgroundColor: selectedUserId === uId ? '#f1f5f9' : 'transparent',
                      borderLeft: selectedUserId === uId ? '4px solid #6366f1' : '4px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Avatar name={uId} size={42} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{uId}</div>
                        <div style={{ fontSize: '0.8rem', color: '#10b981' }}>Active now</div>
                      </div>
                      {unreadCounts[uId] > 0 && (
                        <span style={{ backgroundColor: '#ef4444', color: '#fff', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {unreadCounts[uId]}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat View */}
            <div className="chat-view" style={{ flex: 1, backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
              {selectedUserId ? (
                <ChatPanel
                  userId="admin"
                  targetUserId={selectedUserId}
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
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  Chọn một người dùng để bắt đầu hỗ trợ
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', flex: 1, overflowY: 'auto' }}>
            Tính năng <strong>{activeMenu.toUpperCase()}</strong> đang được phát triển.
          </div>
        )}
      </main>
    </div>
  );
};