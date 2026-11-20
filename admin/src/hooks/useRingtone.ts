import { useCallback, useEffect, useRef } from 'react';

const TONE_FREQUENCIES = [600, 800];
const PULSES_PER_TONE = 8;
const PULSE_INTERVAL_S = 0.15;
const TONE_DURATION_MS = 1400;
const RING_INTERVAL_MS = 1500;
const PEAK_GAIN = 0.2;

type ToneNodes = { oscillators: OscillatorNode[]; gains: GainNode[] };

const getAudioContextClass = (): typeof AudioContext | undefined =>
  window.AudioContext ??
  (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

const stopTone = (tone: ToneNodes) => {
  tone.oscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // Oscillator đã dừng.
    }
    oscillator.disconnect();
  });
  tone.gains.forEach((gain) => gain.disconnect());
};

/** Chuông báo cuộc gọi đến, tạo bằng WebAudio (không cần file âm thanh). */
export const useRingtone = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentToneRef = useRef<ToneNodes | null>(null);
  const ringTimerRef = useRef<number | null>(null);

  const playTone = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    const tone: ToneNodes = { oscillators: [], gains: [] };
    TONE_FREQUENCIES.forEach((frequency) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0, now);
      for (let i = 0; i < PULSES_PER_TONE; i++) {
        const pulseStart = now + i * PULSE_INTERVAL_S;
        gain.gain.linearRampToValueAtTime(PEAK_GAIN, pulseStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, pulseStart + 0.12);
      }
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      tone.oscillators.push(oscillator);
      tone.gains.push(gain);
    });
    currentToneRef.current = tone;

    window.setTimeout(() => {
      stopTone(tone);
      if (currentToneRef.current === tone) currentToneRef.current = null;
    }, TONE_DURATION_MS);
  }, []);

  const play = useCallback(async () => {
    if (ringTimerRef.current !== null) return;
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return;

    const ctx = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = ctx;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    playTone();
    ringTimerRef.current = window.setInterval(playTone, RING_INTERVAL_MS);
  }, [playTone]);

  const stop = useCallback(() => {
    if (ringTimerRef.current !== null) {
      window.clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (currentToneRef.current) {
      stopTone(currentToneRef.current);
      currentToneRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stop();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    },
    [stop],
  );

  return { play, stop };
};
