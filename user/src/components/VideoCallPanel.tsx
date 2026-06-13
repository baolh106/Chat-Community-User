import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  if (status === 'incoming') return `Support is calling...`;
  if (status === 'calling') return `Calling support...`;
  if (status === 'ongoing') return `In call with ${peerName || 'support'}`;
  return 'Ready to video call';
};

const VideoStreamTile = ({
  stream,
  label,
  muted,
  mirrored,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirrored?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const isMuted = Boolean(muted);

  useLayoutEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    try {
      el.muted = isMuted;
      el.volume = isMuted ? 0 : 1;

      if (el.srcObject !== stream) {
        el.srcObject = null;
        el.srcObject = stream;
      }

      const playVideo = async () => {
        if (!stream) return;
        try {
          await el.play();
          setAudioBlocked(false);
        } catch (err) {
          if (!isMuted) setAudioBlocked(true);
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
  }, [stream, label, isMuted]);

  const enableAudio = async () => {
    const el = videoRef.current;
    if (!el) return;

    try {
      el.muted = false;
      el.volume = 1;
      await el.play();
      setAudioBlocked(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[user] enable audio failed', label, err);
    }
  };

  return (
    <div className="video-tile" style={{ background: '#1a1a1a', borderRadius: '12px', overflow: 'hidden', position: 'relative', height: '100%', minHeight: 0 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: mirrored ? 'scaleX(-1)' : undefined }}
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
      {audioBlocked && (
        <button
          type="button"
          onClick={enableAudio}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: '#10b981',
            color: '#fff',
            fontSize: '0.8rem',
          }}
        >
          Enable audio
        </button>
      )}
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
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  useEffect(() => {
    const audioTrack = localStream?.getAudioTracks()[0];
    const videoTrack = localStream?.getVideoTracks()[0];

    setIsMicEnabled(audioTrack?.enabled ?? true);
    setIsCameraEnabled(videoTrack?.enabled ?? true);
  }, [localStream]);

  const toggleMic = () => {
    const nextEnabled = !isMicEnabled;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsMicEnabled(nextEnabled);
  };

  const toggleCamera = () => {
    const nextEnabled = !isCameraEnabled;
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);
  };

  if (status === 'idle') return null;

  return (
    <section className="video-call-modal" style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 10000,
      display: 'flex', flexDirection: 'column',
      padding: '0', overflow: 'hidden'
    }}>
      <div className="video-call-container" style={{ 
        background: '#fff', borderRadius: '12px', padding: '10px', 
        width: '100%', height: '100dvh', maxWidth: '100vw', maxHeight: '100dvh',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box'
      }}>
        <div className="video-call-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '5px' }}>
          <div>
          <strong style={{ color: '#db2777' }}>Video Call</strong>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{getStatusText(status, peerName)}</p>
        </div>
        <div className="video-call-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {localStream && (
            <>
              <button
                className="small-button"
                type="button"
                onClick={toggleMic}
                style={{ background: isMicEnabled ? '#10b981' : '#ef4444', padding: '8px 12px', minWidth: '42px' }}
                title={isMicEnabled ? 'Turn off microphone' : 'Turn on microphone'}
                aria-label={isMicEnabled ? 'Turn off microphone' : 'Turn on microphone'}
              >
                {isMicEnabled ? '🎙️' : '🔇'}
              </button>
              <button
                className="small-button"
                type="button"
                onClick={toggleCamera}
                style={{ background: isCameraEnabled ? '#10b981' : '#ef4444', padding: '8px 12px', minWidth: '42px' }}
                title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                aria-label={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCameraEnabled ? '📹' : '📷'}
              </button>
            </>
          )}
          {status === 'incoming' && (
            <>
              <button className="small-button" style={{ background: '#10b981', padding: '8px 16px' }} onClick={onAcceptCall}>Accept</button>
              <button className="small-button danger-button" onClick={onRejectCall}>Reject</button>
            </>
          )}
          {status === 'calling' && (
            <button className="small-button danger-button" onClick={onCancelCall}>Cancel</button>
          )}
          {status === 'ongoing' && (
            <button className="small-button danger-button" onClick={onEndCall}>End</button>
          )}
        </div>
      </div>

      <div className="video-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: '8px',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0
      }}>
        <VideoStreamTile stream={remoteStream} label="Admin" />
        <VideoStreamTile stream={localStream} label="You (Local)" muted mirrored />
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
