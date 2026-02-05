export const installSpeechSynthesisUnlock = () => {};

export const getSpeechSynthesis = () => null;

export const getSpeechSupport = () => false;

export const onSpeechSupportChange = (callback) => {
  if (typeof callback === 'function') {
    callback(false);
  }
  return () => {};
};

export const primeSpeechSynthesis = () => {};

export const resolveVoiceForSpeaker = () => null;

export const speakCommentaryLines = async () => {};
