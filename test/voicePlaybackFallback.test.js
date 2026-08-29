import { jest } from '@jest/globals';

const mockPost = jest.fn();

jest.mock('../webapp/src/utils/api.js', () => ({
  post: (...args) => mockPost(...args)
}));

describe('voice playback fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    mockPost.mockReset();

    const speakMock = jest.fn();
    const cancel = jest.fn();

    global.window = {
      localStorage: {
        getItem: jest.fn(() => 'guest')
      },
      speechSynthesis: { speak: speakMock, cancel, getVoices: () => [{ name: 'Test English', lang: 'en-US', default: true }] },
      SpeechSynthesisUtterance: class {
        constructor(text) {
          this.text = text;
          this.onend = null;
          this.onerror = null;
        }
      },
      Audio: class {
        addEventListener() {}
        removeEventListener() {}
        play() {
          return Promise.reject(new Error('Audio blocked'));
        }
        pause() {}
      }
    };

    global.Audio = global.window.Audio;

    global.__speakMock = global.window.speechSynthesis.speak;
    global.window.speechSynthesis.speak = (utterance) => {
      global.__speakMock(utterance);
      setTimeout(() => {
        if (typeof utterance?.onend === 'function') utterance.onend();
      }, 0);
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.Audio;
    delete global.__speakMock;
  });

  test('runVoiceHelpSession is disabled when help center is removed', async () => {
    const { runVoiceHelpSession } = await import('../webapp/src/utils/voiceHelpAssistant.js');

    const session = await runVoiceHelpSession({ accountId: 'guest', locale: 'en-US' });

    expect(mockPost).not.toHaveBeenCalled();
    expect(session).toEqual({ intro: null, answerQuestion: expect.any(Function) });
  });

  test('speakCommentaryLines uses browser speech without remote synthesis', async () => {
    const { speakCommentaryLines } = await import('../webapp/src/utils/textToSpeech.js');

    await speakCommentaryLines([{ text: 'Great shot', speaker: 'Host' }], {
      voiceHints: { Host: ['en-US'] }
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(global.__speakMock).toHaveBeenCalled();
  });
});
