import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { VideoCallPanel } from './VideoCallPanel';
import type { Message } from '../types';
import type { VideoCallState } from '../hooks/useChat';

interface ChatPanelProps {
  userId: string;
  messages: Message[];
  draft: string;
  selectedFile: File | null;
  isSending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onClearAttachment: () => void;
  onSendMessage: () => void | Promise<void>;
  onResetSession: () => void;
  canSend: boolean;
  videoCall: VideoCallState;
}

export const ChatPanel = ({
  userId,
  messages,
  draft,
  selectedFile,
  isSending,
  error,
  onDraftChange,
  onFileChange,
  onClearAttachment,
  onSendMessage,
  onResetSession,
  canSend,
  videoCall,
}: ChatPanelProps) => {
  return (
    <div className="chat-panel" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      flex: 1, 
      height: '100%', 
      overflow: 'hidden' 
    }}>
      <div className="session-info" style={{ 
        padding: '10px 15px', borderBottom: '1px solid #fce7f3', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' 
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="small-button" 
            onClick={() => videoCall.startCall()}
            disabled={!videoCall.canStartCall}
            style={{ background: '#db2777', color: '#fff', border: 'none' }}
          >📹 Gọi Video</button>
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
          <button className="small-button" onClick={onResetSession}>Kết thúc session</button>
        </div>
      </div>

      {videoCall && <VideoCallPanel
        status={videoCall.status}
        activeCalls={videoCall.activeCalls}
        incomingCalls={videoCall.incomingCalls}
        localStream={videoCall.localStream}
        error={videoCall.error}
        isModalVisible={videoCall.isVideoCallModalVisible}
        onAcceptCall={videoCall.acceptCall}
        onRejectCall={videoCall.rejectCall}
        onEndCall={videoCall.endCall}
        onToggleModal={videoCall.toggleVideoCallModal}
      />}

      <MessageList messages={messages} userId={userId} />

      <MessageComposer
        draft={draft}
        selectedFile={selectedFile}
        isSending={isSending}
        onDraftChange={onDraftChange}
        onFileChange={onFileChange}
        onClearAttachment={onClearAttachment}
        onSendMessage={onSendMessage}
        canSend={canSend}
      />

      {error && <div className="error-box">{error}</div>}
    </div>
  );
};
