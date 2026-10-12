import { getSettings } from './settings';

let ctx: AudioContext | null = null;

/** Short synthesized blip (no audio files). Silently does nothing if audio is unavailable. */
export function blip(freq: number, seconds = 0.08, type: OscillatorType = 'square', gain = 0.05, delay = 0): void {
  if (!getSettings().sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  } catch {
    /* audio is optional */
  }
}

export const sfx = {
  scan: (): void => blip(1760, 0.07, 'square', 0.04),
  coin: (): void => {
    blip(988, 0.07, 'triangle', 0.07);
    blip(1318, 0.16, 'triangle', 0.07, 0.07);
  },
  cash: (): void => blip(660, 0.05, 'triangle', 0.06),
  done: (): void => {
    blip(784, 0.1, 'triangle', 0.07);
    blip(988, 0.1, 'triangle', 0.07, 0.1);
    blip(1318, 0.22, 'triangle', 0.07, 0.2);
  },
  error: (): void => blip(160, 0.22, 'sawtooth', 0.06),
  pop: (): void => blip(480 + Math.random() * 120, 0.05, 'sine', 0.05),
  chime: (): void => {
    blip(1046, 0.12, 'triangle', 0.05);
    blip(1318, 0.2, 'triangle', 0.05, 0.1);
  },
  levelUp: (): void => {
    [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.16, 'triangle', 0.07, i * 0.1));
  },
};
