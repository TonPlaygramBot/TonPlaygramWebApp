import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../utils/socket.js';

const turnUrls = String(import.meta.env.VITE_WEBRTC_TURN_URLS || import.meta.env.VITE_WEBRTC_TURN_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(turnUrls.length > 0
      ? [{
          urls: turnUrls,
          username: import.meta.env.VITE_WEBRTC_TURN_USERNAME || '',
          credential: import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL || ''
        }]
      : [])
  ],
  // Collect all candidates before giving up. Mobile networks frequently need
  // a little longer to move from a host candidate to a server-reflexive one.
  iceCandidatePoolSize: 4
};

const EMPTY_MEDIA_STATE = Object.freeze({ microphone: true, camera: true });
const MAX_REMOTE_PEERS = 3;

export default function useLiveVideoChat({ roomId, displayName, enabled, video = true }) {
  const [isConnected, setIsConnected] = useState(false);
  const [remotePeers, setRemotePeers] = useState([]);
  const [mediaState, setMediaState] = useState(EMPTY_MEDIA_STATE);
  const [error, setError] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingIceCandidatesRef = useRef(new Map());
  const disconnectTimersRef = useRef(new Map());
  const startPromiseRef = useRef(null);
  const sessionGenerationRef = useRef(0);

  const safeRoomId = useMemo(() => String(roomId || '').trim(), [roomId]);

  const upsertRemotePeer = useCallback((socketId, patch = {}) => {
    setRemotePeers((prev) => {
      const current = prev.find((peer) => peer.socketId === socketId);
      if (current) {
        return prev.map((peer) => (peer.socketId === socketId ? { ...peer, ...patch } : peer));
      }
      return [...prev, { socketId, displayName: 'Player', stream: null, ...patch }];
    });
  }, []);

  const removeRemotePeer = useCallback((socketId) => {
    setRemotePeers((prev) => prev.filter((peer) => peer.socketId !== socketId));
  }, []);

  const closePeer = useCallback((socketId) => {
    const disconnectTimer = disconnectTimersRef.current.get(socketId);
    if (disconnectTimer) window.clearTimeout(disconnectTimer);
    disconnectTimersRef.current.delete(socketId);
    const peer = peersRef.current.get(socketId);
    if (peer) {
      peer.close();
      peersRef.current.delete(socketId);
    }
    pendingIceCandidatesRef.current.delete(socketId);
    removeRemotePeer(socketId);
  }, [removeRemotePeer]);

  const addOrQueueIceCandidate = useCallback(async (socketId, peerConnection, candidate) => {
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      return;
    }

    const queued = pendingIceCandidatesRef.current.get(socketId) || [];
    queued.push(candidate);
    pendingIceCandidatesRef.current.set(socketId, queued);
  }, []);

  const flushIceCandidates = useCallback(async (socketId, peerConnection) => {
    const queued = pendingIceCandidatesRef.current.get(socketId) || [];
    pendingIceCandidatesRef.current.delete(socketId);
    for (const candidate of queued) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const emitSignal = useCallback((targetSocketId, data) => {
    if (!safeRoomId || !targetSocketId || !data) return;
    socket.emit('liveChat:signal', {
      roomId: safeRoomId,
      targetSocketId,
      data
    });
  }, [safeRoomId]);

  const ensurePeerConnection = useCallback((socketId, participant = {}) => {
    if (!socketId || socketId === socket.id) return null;
    const existing = peersRef.current.get(socketId);
    if (existing) return existing;
    // Murlan Royale is a four-player call: one local stream plus at most three
    // independent remote peer connections in the room mesh.
    if (peersRef.current.size >= MAX_REMOTE_PEERS) return null;

    const peerConnection = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(socketId, peerConnection);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        emitSignal(socketId, { type: 'ice-candidate', candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      // WebKit may deliver a track without event.streams. Keep a stable remote
      // MediaStream in that case so portrait iOS/Telegram clients render it.
      const currentPeer = peersRef.current.get(socketId);
      const [receivedStream] = event.streams;
      const stream = receivedStream || currentPeer?.remoteStream || new MediaStream();
      if (!receivedStream && !stream.getTracks().includes(event.track)) {
        stream.addTrack(event.track);
      }
      peerConnection.remoteStream = stream;
      upsertRemotePeer(socketId, {
        displayName: participant.displayName || 'Player',
        stream,
        mediaState: participant.mediaState || EMPTY_MEDIA_STATE
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        const disconnectTimer = disconnectTimersRef.current.get(socketId);
        if (disconnectTimer) window.clearTimeout(disconnectTimer);
        disconnectTimersRef.current.delete(socketId);
        return;
      }
      if (['failed', 'closed'].includes(state)) {
        closePeer(socketId);
        return;
      }
      // WebKit briefly reports `disconnected` while Telegram switches between
      // Wi-Fi and cellular. Closing immediately made the call one-way because
      // the other device kept its still-valid peer connection.
      if (state === 'disconnected' && !disconnectTimersRef.current.has(socketId)) {
        disconnectTimersRef.current.set(socketId, window.setTimeout(() => {
          disconnectTimersRef.current.delete(socketId);
          if (peerConnection.connectionState === 'disconnected') closePeer(socketId);
        }, 8000));
      }
    };

    upsertRemotePeer(socketId, {
      displayName: participant.displayName || 'Player',
      mediaState: participant.mediaState || EMPTY_MEDIA_STATE
    });

    return peerConnection;
  }, [closePeer, emitSignal, upsertRemotePeer]);

  const createOfferForPeer = useCallback(async (socketId, participant = {}) => {
    const peerConnection = ensurePeerConnection(socketId, participant);
    if (!peerConnection) return;
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      emitSignal(socketId, { type: 'offer', sdp: offer });
    } catch (offerError) {
      console.error('live chat createOffer failed', offerError);
    }
  }, [emitSignal, ensurePeerConnection]);

  const stopLiveChat = useCallback(() => {
    sessionGenerationRef.current += 1;
    disconnectTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    disconnectTimersRef.current.clear();
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    setRemotePeers([]);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (safeRoomId) {
      socket.emit('liveChat:leave', { roomId: safeRoomId });
    }

    setIsConnected(false);
  }, [safeRoomId]);

  const startLiveChat = useCallback(async () => {
    if (!enabled || !safeRoomId || isConnected) return startPromiseRef.current;
    // React StrictMode and fast Telegram WebView renders can invoke this action
    // twice before state updates. Sharing the in-flight request prevents two
    // simultaneous camera captures, which can terminate the Telegram WebView.
    if (startPromiseRef.current) return startPromiseRef.current;

    const startPromise = (async () => {
      const sessionGeneration = sessionGenerationRef.current;
      setError('');
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera and microphone are unavailable in this browser. Open TonPlaygram over HTTPS or inside Telegram with media permissions enabled.');
        }
        if (!socket.connected) socket.connect();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          },
          video: video
            ? {
                // A small portrait-friendly capture is enough for the circular game
                // avatar and avoids exhausting Telegram's mobile WebView decoder.
                width: { ideal: 320, max: 480 },
                height: { ideal: 320, max: 480 },
                frameRate: { ideal: 15, max: 20 },
                facingMode: 'user'
              }
            : false
        });

        // The user may turn the avatar off while the Telegram permission sheet is
        // still open. Do not resurrect that cancelled call when permission returns.
        if (sessionGeneration !== sessionGenerationRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        const nextMediaState = {
          microphone: stream.getAudioTracks().some((track) => track.enabled),
          camera: video && stream.getVideoTracks().some((track) => track.enabled)
        };
        setMediaState(nextMediaState);

        socket.emit('liveChat:join', {
          roomId: safeRoomId,
          participant: {
            displayName: displayName || 'Player',
            mediaState: nextMediaState
          }
        });
        setIsConnected(true);
      } catch (mediaError) {
        const message = mediaError instanceof Error ? mediaError.message : 'Unable to access camera and microphone.';
        setError(message);
        console.error('live chat media init failed', mediaError);
      } finally {
        startPromiseRef.current = null;
      }
    })();
    startPromiseRef.current = startPromise;
    return startPromise;
  }, [displayName, enabled, isConnected, safeRoomId, video]);

  const toggleTrack = useCallback((kind) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks();
    if (tracks.length === 0) return;
    const nextEnabled = !tracks.every((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    setMediaState((prev) => {
      const next = {
        ...prev,
        microphone: kind === 'audio' ? nextEnabled : prev.microphone,
        camera: kind === 'video' ? nextEnabled : prev.camera
      };
      socket.emit('liveChat:media_state', { roomId: safeRoomId, mediaState: next });
      return next;
    });
  }, [safeRoomId]);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleSocketConnect = () => {
      // Socket.IO allocates a new socket id after a mobile network interruption.
      // Rejoin and renegotiate instead of leaving the remote player attached to
      // peer connections addressed to the obsolete id.
      peersRef.current.forEach((peer) => peer.close());
      peersRef.current.clear();
      pendingIceCandidatesRef.current.clear();
      setRemotePeers([]);
      if (!localStreamRef.current || !safeRoomId) return;
      socket.emit('liveChat:join', {
        roomId: safeRoomId,
        participant: { displayName: displayName || 'Player', mediaState }
      });
    };

    const handleParticipants = ({ participants = [] } = {}) => {
      participants.forEach((participant) => {
        upsertRemotePeer(participant.socketId, {
          displayName: participant.displayName || 'Player',
          mediaState: participant.mediaState || EMPTY_MEDIA_STATE
        });
      });
    };

    const handlePeerJoined = ({ socketId, participant } = {}) => {
      if (!socketId || socketId === socket.id) return;
      createOfferForPeer(socketId, participant || {});
    };

    const handleSignal = async ({ fromSocketId, data, participant } = {}) => {
      if (!fromSocketId || !data) return;
      const peerConnection = ensurePeerConnection(fromSocketId, participant || {});
      if (!peerConnection) return;

      try {
        if (data.type === 'offer' && data.sdp) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await flushIceCandidates(fromSocketId, peerConnection);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          emitSignal(fromSocketId, { type: 'answer', sdp: answer });
          return;
        }

        if (data.type === 'answer' && data.sdp) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await flushIceCandidates(fromSocketId, peerConnection);
          return;
        }

        if (data.type === 'ice-candidate' && data.candidate) {
          await addOrQueueIceCandidate(fromSocketId, peerConnection, data.candidate);
        }
      } catch (signalError) {
        console.error('live chat signal handling failed', signalError);
      }
    };

    const handlePeerLeft = ({ socketId } = {}) => {
      if (!socketId) return;
      closePeer(socketId);
    };

    const handleMediaState = ({ socketId, mediaState: nextMediaState } = {}) => {
      if (!socketId) return;
      upsertRemotePeer(socketId, { mediaState: nextMediaState || EMPTY_MEDIA_STATE });
    };

    const handleRoomFull = ({ message } = {}) => {
      setError(message || 'This live video room already has four players.');
    };

    socket.on('connect', handleSocketConnect);
    socket.on('liveChat:participants', handleParticipants);
    socket.on('liveChat:peer-joined', handlePeerJoined);
    socket.on('liveChat:signal', handleSignal);
    socket.on('liveChat:peer-left', handlePeerLeft);
    socket.on('liveChat:media_state', handleMediaState);
    socket.on('liveChat:room-full', handleRoomFull);

    return () => {
      socket.off('connect', handleSocketConnect);
      socket.off('liveChat:participants', handleParticipants);
      socket.off('liveChat:peer-joined', handlePeerJoined);
      socket.off('liveChat:signal', handleSignal);
      socket.off('liveChat:peer-left', handlePeerLeft);
      socket.off('liveChat:media_state', handleMediaState);
      socket.off('liveChat:room-full', handleRoomFull);
    };
  }, [addOrQueueIceCandidate, closePeer, createOfferForPeer, displayName, emitSignal, enabled, ensurePeerConnection, flushIceCandidates, mediaState, safeRoomId, upsertRemotePeer]);

  useEffect(() => () => stopLiveChat(), [stopLiveChat]);

  return {
    error,
    isConnected,
    localStream,
    mediaState,
    remotePeers,
    startLiveChat,
    stopLiveChat,
    toggleCamera: () => toggleTrack('video'),
    toggleMicrophone: () => toggleTrack('audio')
  };
}
