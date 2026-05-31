import { useLayoutEffect, useRef } from 'react';
import type { VideoCallState } from '../hooks/useChat';
import type { CallInfo } from '../types';

interface VideoCallPanelProps {
  status: VideoCallState['status'];
  activeCalls: CallInfo[];
  incomingCalls: CallInfo[];
  localStream: MediaStream | null;
  error: string | null;
  isModalVisible: boolean;
  onAcceptCall: (callId: string) => void | Promise<void>;
  onRejectCall: (callId: string) => void;
  onEndCall: (callId?: string) => void;
  onToggleModal: () => void;
}

const getStatusText = (status: VideoCallState['status'], activeCalls: CallInfo[], incomingCalls: CallInfo[]) => {
  if (incomingCalls.length > 0) return `${incomingCalls.length} cuộc gọi đến`;
  if (activeCalls.length > 0) return `${activeCalls.length} cuộc gọi đang hoạt động`;
};

const VideoStreamTile = ({
  stream,
  label,
  muted,
  onEnd,
  callId,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  onEnd?: () => void;
  callId?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useLayoutEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    try {
      if (el.srcObject !== stream) {
        el.srcObject = null;
        el.srcObject = stream;
      }

      const playVideo = async () => {
        if (!stream) return;
        try {
          // Temporarily mute to satisfy autoplay policies, then restore
          const intendedMuted = el.muted;
          try {
            el.muted = true;
            await el.play();
          } finally {
            el.muted = typeof muted === 'boolean' ? muted : intendedMuted;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[admin] video play blocked', label, callId, err);
        }
      };

      if (stream) {
        el.onloadedmetadata = playVideo;
        playVideo();
      }
      // Log stream tracks for debugging
      try {
        // eslint-disable-next-line no-console
        console.log('[admin] attach stream to video element', label, callId, 'tracks=', stream?.getTracks().map(t=>({kind:t.kind, id:t.id})), 'len=', stream?.getTracks().length);
      } catch {}
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[admin] Failed to attach stream', label, callId, err);
    }
  }, [stream, label, callId]);

  return (
    <div className="video-tile" style={{ background: '#1a1a1a', borderRadius: '12px', overflow: 'hidden', aspectRatio: '4/3', position: 'relative' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onCanPlay={() => {
          // eslint-disable-next-line no-console
          console.log('[admin] video canplay', label, callId);
        }}
        onPlay={() => {
          // eslint-disable-next-line no-console
          console.log('[admin] video playing', label, callId);
        }}
        onError={(event) => {
          // eslint-disable-next-line no-console
          console.error('[admin] video error', label, callId, event);
        }}
      />
      <span style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}>
        {label}
      </span>
      {onEnd && (
        <button
          style={{
            position: 'absolute', top: '10px', right: '10px',
            padding: '8px 16px', background: '#ef4444', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}
          onClick={onEnd}
        >
          End
        </button>
      )}
    </div>
  );
};

export const VideoCallPanel = ({
  status,
  activeCalls,
  incomingCalls,
  localStream,
  error,
  isModalVisible,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  onToggleModal,
}: VideoCallPanelProps) => {
  if (status === 'idle' || !isModalVisible) return null;

  return (
    <section className="video-call-modal" style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="video-call-container" style={{ 
        background: '#fff', borderRadius: '16px', padding: '20px', 
        width: '100%', maxWidth: '1200px', maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' 
      }}>
        <div className="video-call-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <strong style={{ color: '#db2777' }}>Video Call</strong>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{getStatusText(status, activeCalls, incomingCalls)}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {activeCalls.length > 0 && (
              <button 
                className="small-button danger-button" 
                onClick={() => onEndCall()}
                style={{ background: '#ef4444' }}
              >
                Kết thúc tất cả
              </button>
            )}
            <button 
              className="close-button"
              onClick={onToggleModal}
              style={{ 
                background: 'none', 
                border: 'none', 
                fontSize: '1.5rem', 
                cursor: 'pointer', 
                color: '#666',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              title="Đóng tạm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Incoming calls section */}
        {incomingCalls.length > 0 && (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#fef3c7', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#333' }}>Cuộc gọi đến:</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {incomingCalls.map(call => (
                <div key={call.callId} style={{ 
                  display: 'flex', gap: '8px', alignItems: 'center',
                  background: '#fff', padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid #f59e0b'
                }}>
                  <span style={{ fontSize: '0.9rem' }}>{call.caller}</span>
                  <button 
                    style={{ padding: '4px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                    onClick={() => onAcceptCall(call.callId)}
                  >
                    Chấp nhận
                  </button>
                  <button 
                    style={{ padding: '4px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                    onClick={() => onRejectCall(call.callId)}
                  >
                    Từ chối
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active calls grid */}
        {activeCalls.length > 0 && (
          <>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#666' }}>Cuộc gọi đang hoạt động: {activeCalls.length}</p>
            <div className="video-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: activeCalls.length <= 2 ? '1fr 1fr' : activeCalls.length <= 4 ? '1fr 1fr' : '1fr 1fr 1fr',
              gap: '15px',
              marginBottom: '15px'
            }}>
              <VideoStreamTile
                key={localStream?.id ?? 'local-video'}
                stream={localStream}
                label="Bạn (Local)"
                muted
              />

              {activeCalls.map(call => (
                <VideoStreamTile
                  key={call.callId}
                  stream={call.remoteStream}
                  label={call.caller}
                  callId={call.callId}
                  onEnd={() => onEndCall(call.callId)}
                />
              ))}
            </div>
          </>
        )}

        {error && (
          <div className="call-error" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center', padding: '8px', background: '#fee2e2', borderRadius: '6px' }}>
            {error}
          </div>
        )}
      </div>
    </section>
  );
};