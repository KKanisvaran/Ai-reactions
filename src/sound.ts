import type { ReactionName } from './reactions.ts';

export function effectDuration(name: ReactionName, intensity: number): number {
  return 2400 + intensity * 250 + (name === 'whip_hard' ? 300 : 0);
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
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0xffffffff * 2 - 1; };
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    let sample = 0;
    if (name === 'whip' || name === 'whip_hard') {
      for (let hit = 0; hit < intensity; hit++) {
        const u = t - (0.55 + hit * 0.5);
        if (u > -0.24 && u < 0) {
          const sweep = (u + 0.24) / 0.24;
          sample += noise() * sweep * sweep * (name === 'whip_hard' ? 0.18 : 0.38);
        }
        if (u >= 0 && u < 0.22) {
          if (name === 'whip_hard') {
            // Short woody knock and a low cartoon thud, distinct from the whip crack.
            sample += noise() * Math.exp(-u * 140) * 0.35;
            sample += Math.sin(2 * Math.PI * 185 * u) * Math.exp(-u * 28) * 0.65;
            sample += Math.sin(2 * Math.PI * 470 * u) * Math.exp(-u * 45) * 0.23;
            sample += Math.sin(2 * Math.PI * 74 * u) * Math.exp(-u * 20) * 0.18;
          } else {
            sample += noise() * Math.exp(-u * 55);
            sample += Math.sin(2 * Math.PI * 95 * u) * Math.exp(-u * 24) * 0.24;
          }
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
