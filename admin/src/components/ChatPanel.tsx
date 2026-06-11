import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { VideoCallPanel } from './VideoCallPanel';
import type { Message } from '../types';
import type { VideoCallState } from '../hooks/useChat';

interface ChatPanelProps {
  userId: string;
  targetUserId: string | null;
  messages: Message[];
  draft: string;
  selectedFiles: File[];
  isSending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onFileChange: (files: File[]) => void;
  onClearAttachment: () => void;
  onSendMessage: () => void | Promise<void>;
  onResetSession: () => void;
  canSend: boolean;
  videoCall: VideoCallState;
}

export const ChatPanel = ({
  userId,
  targetUserId,
  messages,
  draft,
  selectedFiles,
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
        padding: '12px 20px', 
        borderBottom: '1px solid #e2e8f0', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <div style={{ fontWeight: '600', color: '#1e293b' }}>
          User: <span style={{ color: '#6366f1' }}>{targetUserId}</span>
        </div>
        <button 
          onClick={() => videoCall.startCall()}
          disabled={!videoCall.canStartCall}
          title="Video Call"
          style={{ 
            background: 'none', 
            color: videoCall.canStartCall ? '#6366f1' : '#cbd5e1', 
            border: 'none',
            padding: '4px',
            cursor: videoCall.canStartCall ? 'pointer' : 'not-allowed',
            fontSize: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >📞</button>
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
        selectedFiles={selectedFiles}
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
