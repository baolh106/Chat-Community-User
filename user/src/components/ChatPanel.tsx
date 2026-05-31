import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import type { Message } from '../types';
import type { VideoCallState } from '../hooks/useChat';
import { VideoCallPanel } from './VideoCallPanel';

interface ChatPanelProps {
  sessionNickname: string;
  userId: string | null;
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
  sessionNickname,
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
      <div className="session-info">
        <div>
          <strong>ID:</strong> {userId ?? 'Đang chờ...'}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="small-button" 
            onClick={() => videoCall.startCall('admin')}
            disabled={!videoCall.canStartCall}
            style={{ background: '#db2777', color: '#fff', border: 'none' }}
          >📹 Gọi Video</button>
          <button className="small-button" onClick={onResetSession}>
            Bắt đầu lại
          </button>
        </div>
      </div>

      {videoCall && (
        <VideoCallPanel
          status={videoCall.status}
          peerName={videoCall.peerName}
          localStream={videoCall.localStream}
          remoteStream={videoCall.remoteStream}
          error={videoCall.error}
          canStartCall={videoCall.canStartCall}
          onStartCall={() => videoCall.startCall('admin')}
          onAcceptCall={videoCall.acceptCall}
          onRejectCall={videoCall.rejectCall}
          onCancelCall={videoCall.cancelCall}
          onEndCall={videoCall.endCall}
        />
      )}

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
