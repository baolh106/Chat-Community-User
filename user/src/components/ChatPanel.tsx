import { useState } from 'react';
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
  const [isCallHovered, setIsCallHovered] = useState(false);

  return (
    <div className="chat-panel" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      flex: 1, 
      height: '100%', 
      overflow: 'hidden' 
    }}>
      <div className="session-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #fbcfe8' }}>
        <div>
          <strong>Nickname:</strong> {sessionNickname}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={() => videoCall.startCall('admin')}
            disabled={!videoCall.canStartCall}
            onMouseEnter={() => setIsCallHovered(true)}
            onMouseLeave={() => setIsCallHovered(false)}
            title="Video Call"
            style={{ 
              background: videoCall.canStartCall && isCallHovered ? 'rgba(219, 39, 119, 0.15)' : 'rgba(219, 39, 119, 0.08)', 
              color: videoCall.canStartCall ? '#db2777' : '#cbd5e1', 
              border: 'none',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              cursor: videoCall.canStartCall ? 'pointer' : 'not-allowed',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >📞</button>
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
