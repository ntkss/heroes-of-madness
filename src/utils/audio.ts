// Browser-native retro arcade audio synthesizer using the Web Audio API and Web Speech API.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  // Resume context if suspended (browser autoplay policy security)
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playBeep(
  freq = 600,
  duration = 0.08,
  type: OscillatorType = "sine",
  volume = 0.1,
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  // Smooth volume decay to prevent audio pops
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// Retro 8-bit coin pickup sound (two-tone sweep)
export function playCoin() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;

  // Note 1
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "square";
  osc1.frequency.setValueAtTime(987.77, t); // B5
  gain1.gain.setValueAtTime(0.08, t);
  gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  osc1.start(t);
  osc1.stop(t + 0.08);

  // Note 2 (shifted slightly in time)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(1318.51, t + 0.08); // E6
  gain2.gain.setValueAtTime(0.08, t + 0.08);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc2.start(t + 0.08);
  osc2.stop(t + 0.35);
}

// Laser sweeping down
export function playLaser() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// Low frequency thud/slam (locking cards)
export function playLockName() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

// White-noise explosion sound for huge impacts / randomized team lock-in
export function playExplosion() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const bufferSize = ctx.sampleRate * 0.4; // 0.4 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Fill buffer with random white noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  // Add lowpass filter to make it rumbling rather than static hiss
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.4);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
  noise.stop(ctx.currentTime + 0.4);
}

// Arcade winning tune
export function playWin() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;
  const notes = [
    { freq: 523.25, start: 0, duration: 0.1 }, // C5
    { freq: 659.25, start: 0.1, duration: 0.1 }, // E5
    { freq: 783.99, start: 0.2, duration: 0.1 }, // G5
    { freq: 1046.5, start: 0.3, duration: 0.3 }, // C6
  ];

  notes.forEach((note) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(note.freq, t + note.start);

    gain.gain.setValueAtTime(0.12, t + note.start);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      t + note.start + note.duration,
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t + note.start);
    osc.stop(t + note.start + note.duration);
  });
}

// Energetic arcade announcer speech synthesis
export function speakAnnounce(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // Cancel any ongoing speaking to avoid queue build-up
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Find a suitable english voice (preferably male / deep or robotic)
  const voices = window.speechSynthesis.getVoices();
  const targetVoice =
    voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.toLowerCase().includes("google") ||
          v.name.toLowerCase().includes("premium") ||
          v.name.toLowerCase().includes("male")),
    ) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0];

  if (targetVoice) {
    utterance.voice = targetVoice;
  }

  // Adjust parameters to sound more retro/arcade-announcer like
  utterance.pitch = 0.85; // Deep energetic voice
  utterance.rate = 1.15; // Rapid/high adrenaline rate
  utterance.volume = 0.8;

  window.speechSynthesis.speak(utterance);
}
