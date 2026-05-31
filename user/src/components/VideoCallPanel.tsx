import { useLayoutEffect, useRef } from 'react';
import type { VideoCallState } from '../hooks/useChat';

interface VideoCallPanelProps {
  status: VideoCallState['status'];
  peerName: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;
  canStartCall: boolean;
  onStartCall: () => void | Promise<void>;
  onAcceptCall: () => void | Promise<void>;
  onRejectCall: () => void;
  onCancelCall: () => void;
  onEndCall: () => void;
}

const getStatusText = (status: VideoCallState['status'], peerName: string | null) => {
  if (status === 'incoming') return `Hỗ trợ viên đang gọi video...`;
  if (status === 'calling') return `Đang gọi cho hỗ trợ viên...`;
  if (status === 'ongoing') return `Đang trong cuộc gọi với ${peerName || 'hỗ trợ viên'}`;
  return 'Sẵn sàng gọi video';
};

const VideoStreamTile = ({
  stream,
  label,
  muted,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
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
          console.warn('[user] video play blocked', label, err);
        }
      };

      if (stream) {
        el.onloadedmetadata = playVideo;
        playVideo();
      }
      // Log stream tracks for debugging
      try {
        // eslint-disable-next-line no-console
        console.log('[user] attach stream to video element', label, 'tracks=', stream?.getTracks().map(t=>({kind:t.kind, id:t.id})), 'len=', stream?.getTracks().length);
      } catch {}
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[user] failed to attach stream', label, err);
    }
  }, [stream, label]);

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
          console.log('[user] video canplay', label);
        }}
        onPlay={() => {
          // eslint-disable-next-line no-console
          console.log('[user] video playing', label);
        }}
        onError={(event) => {
          // eslint-disable-next-line no-console
          console.error('[user] video error', label, event);
        }}
      />
      <span style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}>{label}</span>
    </div>
  );
};

export const VideoCallPanel = ({
  status,
  peerName,
  localStream,
  remoteStream,
  error,
  canStartCall,
  onStartCall,
  onAcceptCall,
  onRejectCall,
  onCancelCall,
  onEndCall,
}: VideoCallPanelProps) => {
  if (status === 'idle') return null;

  return (
    <section className="video-call-modal" style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="video-call-container" style={{ 
        background: '#fff', borderRadius: '16px', padding: '20px', 
        width: '100%', maxWidth: '800px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' 
      }}>
        <div className="video-call-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
          <strong style={{ color: '#db2777' }}>Video Call</strong>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{getStatusText(status, peerName)}</p>
        </div>
        <div className="video-call-actions" style={{ display: 'flex', gap: '8px' }}>
          {status === 'incoming' && (
            <>
              <button className="small-button" style={{ background: '#10b981' }} onClick={onAcceptCall}>Chấp nhận</button>
              <button className="small-button danger-button" onClick={onRejectCall}>Từ chối</button>
            </>
          )}
          {status === 'calling' && (
            <button className="small-button danger-button" onClick={onCancelCall}>Hủy</button>
          )}
          {status === 'ongoing' && (
            <button className="small-button danger-button" onClick={onEndCall}>Kết thúc</button>
          )}
        </div>
      </div>

      <div className="video-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <VideoStreamTile stream={remoteStream} label="Hỗ trợ viên" />
        <VideoStreamTile stream={localStream} label="Bạn (Local)" muted />
      </div>

      {error && (
        <div className="call-error" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>
          {error}
        </div>
      )}
      </div>
    </section>
  );
};