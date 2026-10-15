// Original procedural sound design. No recordings or third-party audio assets.
let context: AudioContext | undefined;
let lastPlayed = 0;
export const soundSettings = () => {
  try { return { enabled: localStorage.getItem('uiSoundEnabled') !== 'false', volume: Math.min(.5, Math.max(0, Number(localStorage.getItem('uiSoundVolume') ?? '.18'))) }; }
  catch { return { enabled: true, volume: .18 }; }
};
export function playUiSound(kind: 'tap' | 'click' | 'notice' = 'tap') {
  const settings = soundSettings();
  if (!settings.enabled || !settings.volume || typeof window === 'undefined' || !window.AudioContext) return;
  if (performance.now() - lastPlayed < (kind === 'click' ? 65 : 40)) return;
  lastPlayed = performance.now();
  if (kind === 'notice' && (!context || context.state !== 'running')) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    const now = context.currentTime;
    const tones = kind === 'notice' ? [660, 880] : [kind === 'click' ? 390 : 560];
    tones.forEach((frequency, index) => {
      const start = now + index * .065, oscillator = context!.createOscillator(), gain = context!.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .78, start + .075);
      gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(settings.volume * .3, start + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .11);
      oscillator.connect(gain); gain.connect(context!.destination); oscillator.start(start); oscillator.stop(start + .12);
    });
  } catch { /* Audio support must never prevent an interaction. */ }
}
