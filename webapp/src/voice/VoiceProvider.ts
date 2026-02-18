export type VoiceSpeakOptions = {
  voiceId: string;
  persona?: string;
  context?: 'help' | 'commentary';
  gameId?: string;
  hints?: string[];
};

export interface VoiceProvider {
  speak(text: string, opts: VoiceSpeakOptions): Promise<HTMLAudioElement>;
  stop(): void;
  healthCheck?(): Promise<boolean>;
}
