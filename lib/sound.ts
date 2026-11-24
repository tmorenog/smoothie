// Tiny synthesized sound effects (Web Audio). No audio files, no network.

export type SoundName = "tap" | "buy" | "drop" | "blend" | "pour" | "coins" | "meow" | "level" | "error" | "alarm" | "ding";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12, endFreq?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

function noise(c: AudioContext, dur: number, freq: number, gain = 0.08) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 0.3;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

export function playSound(name: SoundName) {
  const c = audio();
  if (!c) return;
  switch (name) {
    case "tap":
      return tone(c, 660, 0, 0.06, "triangle", 0.05);
    case "buy":
      tone(c, 880, 0, 0.08, "triangle", 0.08);
      return tone(c, 1320, 0.07, 0.1, "triangle", 0.07);
    case "drop":
      return tone(c, 420, 0, 0.12, "sine", 0.1, 200);
    case "blend":
      noise(c, 2.4, 700, 0.07);
      return tone(c, 110, 0, 2.4, "sawtooth", 0.025, 160);
    case "pour":
      return noise(c, 1.8, 400, 0.05);
    case "coins":
      [0, 0.08, 0.16].forEach((t, i) => tone(c, 988 + i * 330, t, 0.14, "square", 0.04));
      return;
    case "meow":
      tone(c, 620, 0, 0.18, "sine", 0.09, 900);
      return tone(c, 900, 0.17, 0.25, "sine", 0.07, 520);
    case "level":
      [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.1, 0.22, "triangle", 0.08));
      return;
    case "error":
      return tone(c, 220, 0, 0.18, "square", 0.04, 180);
    case "alarm":
      [0, 0.25, 0.5].forEach((t) => tone(c, 740, t, 0.12, "square", 0.04));
      return;
    case "ding":
      return tone(c, 1568, 0, 0.6, "sine", 0.08);
  }
}
