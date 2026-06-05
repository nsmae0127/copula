/**
 * Sound Synthesizer using Web Audio API.
 * Generates beautiful, lightweight UI sound feedback in real-time.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Clean chime sound played upon commitment completion.
 * Synthesizes a rapid arpeggio (C5 -> E5 -> G5 -> C6) with exponential decay.
 */
export function playChimeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser security autoplays rules)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (C major arpeggio)
  const duration = 0.8;

  notes.forEach((freq, index) => {
    const delay = index * 0.08; // 80ms arpeggio interval
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Smooth pure triangle/sine wave mixture
    osc.type = "sine";
    osc.frequency.value = freq;
    
    // Volume envelope
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.02); // Fast attack
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration); // Smooth decay
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now + delay);
    osc.stop(now + delay + duration + 0.1);
  });
}

/**
 * Lightweight organic click/tap sound for navigation and button inputs.
 * Synthesizes a fast pitch sweep decay.
 */
export function playTapSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  
  // Fast frequency sweep for a natural popping/clicking sound
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);

  // Volume envelope
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.08);
}
