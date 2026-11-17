import { beforeEach, expect, it, vi } from 'vitest';
const sound = vi.hoisted(() => ({ muted: false }));
vi.mock('./sound.js', () => ({ isGameMuted: () => sound.muted, getGameVolume: () => .5 }));
let oscillator, gain, resume, AudioContext;
beforeEach(() => {
  vi.resetModules();sound.muted=false;
  oscillator={frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};
  gain={gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()};
  resume=vi.fn().mockResolvedValue();
  AudioContext=vi.fn(function(){return {state:'running',currentTime:2,destination:{},createOscillator:()=>oscillator,createGain:()=>gain,resume};});
  window.AudioContext=AudioContext;
});
it('uses a short bounded tier chime and game volume',async()=>{const audio=await import('./giftAudio.js');audio.prepareGiftAudio();audio.playGiftChime(3);expect(oscillator.start).toHaveBeenCalledTimes(4);expect(oscillator.stop.mock.calls.at(-1)[0]).toBeLessThan(2.6);expect(gain.gain.linearRampToValueAtTime.mock.calls[0][0]).toBe(.04);oscillator.onended();expect(gain.disconnect).toHaveBeenCalled();});
it('does not initialize or play audio when muted',async()=>{sound.muted=true;const audio=await import('./giftAudio.js');audio.prepareGiftAudio();audio.playGiftChime();expect(AudioContext).not.toHaveBeenCalled();expect(oscillator.start).not.toHaveBeenCalled();});
it('unsupported audio does not throw or block confirmation',async()=>{window.AudioContext=undefined;const audio=await import('./giftAudio.js');expect(()=>{audio.prepareGiftAudio();audio.playGiftChime();}).not.toThrow();});
it('checks mute again after purchase resolves',async()=>{const audio=await import('./giftAudio.js');audio.prepareGiftAudio();sound.muted=true;audio.playGiftChime();expect(oscillator.start).not.toHaveBeenCalled();});
it('resume rejection is absorbed and a suspended context stays silent',async()=>{resume.mockRejectedValue(new Error('blocked'));window.AudioContext=vi.fn(function(){return {state:'suspended',resume};});const audio=await import('./giftAudio.js');audio.prepareGiftAudio();await Promise.resolve();audio.playGiftChime();expect(resume).toHaveBeenCalledOnce();expect(oscillator.start).not.toHaveBeenCalled();});
