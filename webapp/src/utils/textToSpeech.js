const listeners = new Set();

export const installSpeechSynthesisUnlock = () => {};

export const getSpeechSynthesis = () => null;

export const getSpeechSupport = () => false;

export const onSpeechSupportChange = (callback) => {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  callback(false);
  return () => listeners.delete(callback);
};

export const primeSpeechSynthesis = () => Promise.resolve(false);

export const resolveVoiceForSpeaker = () => null;

export const speakCommentaryLines = async () => false;
