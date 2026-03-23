import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_STATE = Object.freeze({ microphone: true, camera: true });

export default function useLocalMediaPreview() {
  const [stream, setStream] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [mediaState, setMediaState] = useState(DEFAULT_STATE);
  const [error, setError] = useState('');
  const streamRef = useRef(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsActive(false);
    setMediaState(DEFAULT_STATE);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) {
      setIsActive(true);
      return;
    }
    setError('');
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: 'user'
        }
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      setIsActive(true);
      setMediaState({
        microphone: nextStream.getAudioTracks().every((track) => track.enabled),
        camera: nextStream.getVideoTracks().every((track) => track.enabled)
      });
    } catch (mediaError) {
      const message = mediaError instanceof Error ? mediaError.message : 'Unable to access camera and microphone.';
      setError(message);
      setIsActive(false);
    }
  }, []);

  const toggleTrack = useCallback((kind) => {
    const activeStream = streamRef.current;
    if (!activeStream) return;
    const tracks = kind === 'audio' ? activeStream.getAudioTracks() : activeStream.getVideoTracks();
    if (!tracks.length) return;
    const nextEnabled = !tracks.every((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setMediaState((prev) => ({
      ...prev,
      microphone: kind === 'audio' ? nextEnabled : prev.microphone,
      camera: kind === 'video' ? nextEnabled : prev.camera
    }));
  }, []);

  useEffect(() => () => stop(), [stop]);

  return {
    stream,
    isActive,
    mediaState,
    error,
    start,
    stop,
    toggleCamera: () => toggleTrack('video'),
    toggleMicrophone: () => toggleTrack('audio')
  };
}
