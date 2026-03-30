// Voice commentary and TTS are intentionally disabled across the web app.

export const installSpeechSynthesisUnlock = () => {};

export const getSpeechSynthesis = () => null;

export const getSpeechSupport = () => false;

export const onSpeechSupportChange = (callback) => {
  if (typeof callback === 'function') callback(false);
  return () => {};
};

export const primeSpeechSynthesis = () => {};

export const stopSpeaking = () => {};

export const resolveVoiceForSpeaker = () => null;

export const speakText = async () => false;

export const speakCommentaryLines = async () => false;
