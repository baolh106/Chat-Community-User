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
  sessionNickname,
  userId,
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
      <div className="session-info">
        <div>
          <strong>Nickname:</strong> {sessionNickname}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="small-button" 
            onClick={() => videoCall.startCall('admin')}
            disabled={!videoCall.canStartCall}
            style={{ background: '#db2777', color: '#fff', border: 'none' }}
          >📹 Video Call</button>
          <button className="small-button" onClick={onResetSession}>
            Restart
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
