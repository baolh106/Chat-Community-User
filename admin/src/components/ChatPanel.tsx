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
      {/* Session controls moved to AdminPage so ChatPanel can be shown/hidden independently */}

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
