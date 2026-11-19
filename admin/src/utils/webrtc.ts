import { getString, isRecord } from './guards';

export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

const SDP_TYPES: ReadonlySet<string> = new Set(['offer', 'answer', 'pranswer', 'rollback']);

export const parseSessionDescription = (value: unknown): RTCSessionDescriptionInit | null => {
  if (!isRecord(value)) return null;
  const type = getString(value, 'type');
  if (!type || !SDP_TYPES.has(type)) return null;
  return { type: type as RTCSdpType, sdp: getString(value, 'sdp') };
};

export const parseIceCandidate = (value: unknown): RTCIceCandidateInit | null => {
  if (!isRecord(value) || typeof value.candidate !== 'string') return null;
  return {
    candidate: value.candidate,
    sdpMid: typeof value.sdpMid === 'string' ? value.sdpMid : null,
    sdpMLineIndex: typeof value.sdpMLineIndex === 'number' ? value.sdpMLineIndex : null,
    usernameFragment: getString(value, 'usernameFragment') ?? null,
  };
};

export const describeTracks = (stream: MediaStream | null | undefined) =>
  stream?.getTracks().map((track) => ({ kind: track.kind, enabled: track.enabled, id: track.id }));
