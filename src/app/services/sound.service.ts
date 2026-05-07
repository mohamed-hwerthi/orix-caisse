import { Injectable } from '@angular/core';

/**
 * Plays short UI sounds via the Web Audio API — no audio files needed.
 * Sounds are synthesized for instant playback and zero bundle weight.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx?: AudioContext;
  private enabled = true;

  setEnabled(value: boolean): void {
    this.enabled = value;
    try {
      localStorage.setItem('orix_sound_enabled', value ? '1' : '0');
    } catch {}
  }

  isEnabled(): boolean {
    try {
      const v = localStorage.getItem('orix_sound_enabled');
      if (v != null) this.enabled = v === '1';
    } catch {}
    return this.enabled;
  }

  /** Pleasant two-note chime played after a successful cash-in. */
  playCashIn(): void {
    if (!this.isEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Bright, satisfying register-style chime: C6 then E6 (major third), with bell-like overtones
    this.playTone(ctx, 1046.5, now,        0.18, 0.32, 'sine');   // C6
    this.playTone(ctx, 1318.5, now + 0.08, 0.32, 0.28, 'sine');   // E6
    this.playTone(ctx, 1567.98, now + 0.18, 0.45, 0.18, 'triangle'); // G6 (overtone, soft)
  }

  /** Soft click for minor confirmations. */
  playClick(): void {
    if (!this.isEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.playTone(ctx, 880, ctx.currentTime, 0.05, 0.15, 'sine');
  }

  /** Short error buzz. */
  playError(): void {
    if (!this.isEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, 220, now, 0.12, 0.25, 'square');
    this.playTone(ctx, 180, now + 0.1, 0.18, 0.22, 'square');
  }

  private getContext(): AudioContext | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return undefined;
        this.ctx = new Ctor();
      }
      // Resume suspended context (autoplay policy)
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return undefined;
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startAt: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);

    // Quick attack, smooth exponential decay → bell-like, never harsh
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  }
}
