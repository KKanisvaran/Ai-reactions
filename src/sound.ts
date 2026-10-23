import type { ReactionName } from './reactions.ts';

export function effectDuration(name: ReactionName, intensity: number): number {
  return 2400 + intensity * 250 + (name === 'coffee' ? 300 : 0);
}

/** Original PCM synthesis: no downloaded sounds, external files or audio packages. */
export function synthesizeSound(name: ReactionName, intensity: number, volume: number): Buffer {
  if (!Number.isInteger(intensity) || intensity < 1 || intensity > 3 ||
      !Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new Error('Paramètres audio invalides.');
  }
  const rate = 22050;
  const count = Math.ceil(effectDuration(name, intensity) * rate / 1000);
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  let seed = 731;
  let low = 0;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0xffffffff * 2 - 1; };
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    let sample = 0;
    if (name === 'boop') {
      // Soft falling "boop" per tap, with a tiny pop on contact.
      for (let hit = 0; hit < intensity; hit++) {
        const u = t - (0.55 + hit * 0.5);
        if (u >= 0 && u < 0.18) {
          const envelope = Math.min(1, u / 0.01) * Math.exp(-u * 14);
          sample += Math.sin(2 * Math.PI * (880 * u - 1100 * u * u)) * envelope * 0.5;
          sample += noise() * Math.exp(-u * 300) * 0.08;
        }
      }
    } else if (name === 'coffee') {
      // Gentle sip, then a bright rising arpeggio: one more note per intensity.
      if (t >= 0.35 && t < 0.85) {
        low += (noise() - low) * 0.08;
        sample += low * Math.sin(Math.PI * (t - 0.35) / 0.5) * 0.5;
      }
      [523, 659, 784, 1047, 1319].slice(0, 2 + intensity).forEach((freq, n) => {
        const u = t - (1.05 + n * 0.13);
        if (u >= 0 && u < 0.4) {
          const envelope = Math.min(1, u / 0.01) * Math.exp(-u * 7);
          sample += (Math.sin(2 * Math.PI * freq * u) + Math.sin(4 * Math.PI * freq * u) * 0.25) * envelope * 0.3;
        }
      });
    } else if (name === 'too_slow') {
      // Slow clock: alternating tick and tock.
      for (let n = 0; n * 0.45 + 0.2 < t; n++) {
        const u = t - (0.2 + n * 0.45);
        if (u < 0.08) sample += Math.sin(2 * Math.PI * (n % 2 ? 1400 : 1900) * u) * Math.exp(-u * 70) * 0.5;
      }
    } else if (name === 'confused') {
      // Rising "huh?" glide, one per intensity level.
      for (let hit = 0; hit < intensity; hit++) {
        const u = t - (0.3 + hit * 0.6);
        if (u >= 0 && u < 0.45) {
          const envelope = Math.min(1, u / 0.02) * Math.min(1, (0.45 - u) / 0.08);
          sample += Math.sin(2 * Math.PI * (220 * u + 300 * u * u)) * envelope * 0.45;
        }
      }
    } else if (name === 'sus') {
      // Two low suspense notes, repeated by intensity.
      for (let hit = 0; hit < intensity; hit++) {
        for (const [offset, frequency] of [[0, 146.83], [0.32, 155.56]] as const) {
          const u = t - (0.3 + hit * 0.75 + offset);
          if (u >= 0 && u < 0.3) sample += (Math.sin(2 * Math.PI * frequency * u) + 0.4 * Math.sin(2 * Math.PI * frequency * 3 * u)) * Math.exp(-u * 6) * 0.4;
        }
      }
    } else if (name === 'ez') {
      // A bright "ding", one per intensity level.
      for (let hit = 0; hit < intensity; hit++) {
        const u = t - (0.4 + hit * 0.5);
        if (u >= 0 && u < 1.2) sample += (Math.sin(2 * Math.PI * 1567.98 * u) + 0.3 * Math.sin(2 * Math.PI * 3135.96 * u)) * Math.exp(-u * 5) * 0.4;
      }
    } else if (name === 'chill' || name === 'facepalm' || name === 'hype' || name === 'rip') {
      // Soft lo-fi Cmaj7, or a descending sad trombone with vibrato.
      // hype: fast rising fanfare; rip: slow minor organ; both decay softly like chill.
      const chill = name !== 'facepalm';
      const notes = name === 'chill' ? [261.63, 329.63, 392, 493.88] : name === 'hype' ? [392, 523.25, 659.25, 783.99, 1046.5, 1318.51]
        : name === 'rip' ? [220, 261.63, 329.63, 207.65] : [392, 369.99, 349.23, 293.66];
      const step = name === 'hype' ? 0.12 : name === 'rip' ? 0.5 : chill ? 0.3 : 0.45;
      for (let n = 0; n < notes.length; n++) {
        const u = t - (0.25 + n * step);
        const length = chill ? 2 : n === notes.length - 1 ? 1.1 : step;
        if (u >= 0 && u < length) {
          const vibrato = chill ? 0 : 0.004 * Math.sin(2 * Math.PI * 6 * u) * (n === notes.length - 1 ? 1 : 0);
          const envelope = Math.min(1, u / 0.03) * (chill ? Math.exp(-u * 1.6) : Math.min(1, (length - u) / 0.05));
          sample += (Math.sin(2 * Math.PI * notes[n]! * (1 + vibrato) * u) +
            (chill ? 0 : 0.35 * Math.sin(2 * Math.PI * notes[n]! * 2 * u))) * envelope * 0.22;
        }
      }
    } else {
      const notes = name === 'reward' ? [523.25, 659.25, 783.99, 1046.5, 1318.51] : [523.25, 659.25, 783.99];
      for (let n = 0; n < notes.length; n++) {
        const u = t - (0.28 + n * 0.18);
        if (u >= 0 && u < 1.25) {
          const envelope = Math.min(1, u / 0.012) * Math.exp(-u * 4.5);
          sample += (Math.sin(2 * Math.PI * notes[n]! * u) +
            0.18 * Math.sin(2 * Math.PI * notes[n]! * 2 * u)) * envelope * 0.27;
        }
      }
    }
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * volume * 32767), 44 + i * 2);
  }
  return wav;
}
