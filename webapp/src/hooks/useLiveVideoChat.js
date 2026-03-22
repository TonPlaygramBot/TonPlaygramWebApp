import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../utils/socket.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const EMPTY_MEDIA_STATE = Object.freeze({ microphone: true, camera: true });

export default function useLiveVideoChat({ roomId, displayName, enabled }) {
  const [isConnected, setIsConnected] = useState(false);
  const [remotePeers, setRemotePeers] = useState([]);
  const [mediaState, setMediaState] = useState(EMPTY_MEDIA_STATE);
  const [error, setError] = useState('');
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());

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
    const peer = peersRef.current.get(socketId);
    if (peer) {
      peer.close();
      peersRef.current.delete(socketId);
    }
    removeRemotePeer(socketId);
  }, [removeRemotePeer]);

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
      const [stream] = event.streams;
      if (!stream) return;
      upsertRemotePeer(socketId, {
        displayName: participant.displayName || 'Player',
        stream,
        mediaState: participant.mediaState || EMPTY_MEDIA_STATE
      });
    };

    peerConnection.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(peerConnection.connectionState)) {
        closePeer(socketId);
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
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    setRemotePeers([]);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (safeRoomId) {
      socket.emit('liveChat:leave', { roomId: safeRoomId });
    }

    setIsConnected(false);
  }, [safeRoomId]);

  const startLiveChat = useCallback(async () => {
    if (!safeRoomId || isConnected) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: 'user'
        }
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setMediaState({
        microphone: stream.getAudioTracks().every((track) => track.enabled),
        camera: stream.getVideoTracks().every((track) => track.enabled)
      });

      socket.emit('liveChat:join', {
        roomId: safeRoomId,
        participant: {
          displayName: displayName || 'Player',
          mediaState: { microphone: true, camera: true }
        }
      });
      setIsConnected(true);
    } catch (mediaError) {
      const message = mediaError instanceof Error ? mediaError.message : 'Unable to access camera and microphone.';
      setError(message);
      console.error('live chat media init failed', mediaError);
    }
  }, [displayName, isConnected, safeRoomId]);

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
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          emitSignal(fromSocketId, { type: 'answer', sdp: answer });
          return;
        }

        if (data.type === 'answer' && data.sdp) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          return;
        }

        if (data.type === 'ice-candidate' && data.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
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

    socket.on('liveChat:participants', handleParticipants);
    socket.on('liveChat:peer-joined', handlePeerJoined);
    socket.on('liveChat:signal', handleSignal);
    socket.on('liveChat:peer-left', handlePeerLeft);
    socket.on('liveChat:media_state', handleMediaState);

    return () => {
      socket.off('liveChat:participants', handleParticipants);
      socket.off('liveChat:peer-joined', handlePeerJoined);
      socket.off('liveChat:signal', handleSignal);
      socket.off('liveChat:peer-left', handlePeerLeft);
      socket.off('liveChat:media_state', handleMediaState);
    };
  }, [closePeer, createOfferForPeer, emitSignal, enabled, ensurePeerConnection, upsertRemotePeer]);

  useEffect(() => () => stopLiveChat(), [stopLiveChat]);

  return {
    error,
    isConnected,
    localVideoRef,
    mediaState,
    remotePeers,
    startLiveChat,
    stopLiveChat,
    toggleCamera: () => toggleTrack('video'),
    toggleMicrophone: () => toggleTrack('audio')
  };
}
