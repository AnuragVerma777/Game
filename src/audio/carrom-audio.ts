/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * CARROM CLASH — High-fidelity Web Audio Synthesizer
 * Procedural physical audio for wood impacts, coin collisions,
 * pocket drops, fouls, and game completion. Zero external audio latency.
 */

class CarromAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted = false;

  private initContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
    return this.ctx;
  }

  public ensureContext(): void {
    const ctx = this.initContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Crisp acoustic strike sound when the striker is released and launched.
   */
  public playStrike(powerRatio = 0.5): void {
    const ctx = this.initContext();
    if (!ctx || this.isMuted) return;
    this.ensureContext();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Wood transient punch
    osc.type = 'triangle';
    const baseFreq = 340 + powerRatio * 200;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    const volume = Math.min(1.0, 0.4 + powerRatio * 0.6);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    if (this.masterGain) gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * High-frequency tactile clack when two carrom pieces collide.
   */
  public playCollision(impulse: number): void {
    const ctx = this.initContext();
    if (!ctx || this.isMuted) return;
    this.ensureContext();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // High wood resonance
    osc.type = 'sine';
    const freq = 650 + Math.random() * 250;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.045);

    const volume = Math.min(0.8, Math.max(0.1, impulse * 0.45));
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    if (this.masterGain) gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Deep hollow thud when a coin falls into a corner net cup.
   */
  public playPocket(isQueen = false): void {
    const ctx = this.initContext();
    if (!ctx || this.isMuted) return;
    this.ensureContext();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Low hollow cup resonance
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isQueen ? 280 : 190, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.22);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    if (this.masterGain) gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.26);

    // If Queen, add high shimmer chime
    if (isQueen) {
      setTimeout(() => {
        if (!ctx) return;
        const t2 = ctx.currentTime;
        const shimmer = ctx.createOscillator();
        const sGain = ctx.createGain();
        shimmer.type = 'triangle';
        shimmer.frequency.setValueAtTime(880, t2);
        shimmer.frequency.exponentialRampToValueAtTime(1320, t2 + 0.35);
        sGain.gain.setValueAtTime(0.5, t2);
        sGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.4);
        shimmer.connect(sGain);
        if (this.masterGain) sGain.connect(this.masterGain);
        shimmer.start(t2);
        shimmer.stop(t2 + 0.42);
      }, 50);
    }
  }

  /**
   * Subtle alert when the striker is fouled into a pocket.
   */
  public playFoul(): void {
    const ctx = this.initContext();
    if (!ctx || this.isMuted) return;
    this.ensureContext();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.25);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    if (this.masterGain) gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  /**
   * Harmonious melodic chime on game completion.
   */
  public playVictory(): void {
    const ctx = this.initContext();
    if (!ctx || this.isMuted) return;
    this.ensureContext();

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        if (this.masterGain) gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.5);
      }, idx * 100);
    });
  }
}

export const carromAudio = new CarromAudioEngine();
