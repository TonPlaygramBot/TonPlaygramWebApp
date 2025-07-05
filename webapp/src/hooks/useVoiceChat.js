import { useEffect, useRef } from 'react';
import io from 'socket.io-client';

export function useVoiceChat(roomId) {
  const socketRef = useRef();
  const peersRef = useRef({});
  const localStreamRef = useRef();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        localStreamRef.current = stream;
        socketRef.current = io('https://your-signaling-server.com:3001');
        socketRef.current.emit('join-room', { roomId });

        socketRef.current.on('user-joined', ({ userId }) => {
          const pc = createPeer(userId, socketRef.current, stream);
          peersRef.current[userId] = pc;
        });

        socketRef.current.on('offer', async ({ offer, from }) => {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          peersRef.current[from] = pc;
          attachStream(pc, stream, socketRef.current, from);
          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current.emit('answer', { answer: pc.localDescription, to: from });
        });

        socketRef.current.on('answer', async ({ answer, from }) => {
          const pc = peersRef.current[from];
          if (pc) await pc.setRemoteDescription(answer);
        });

        socketRef.current.on('ice-candidate', ({ candidate, from }) => {
          const pc = peersRef.current[from];
          if (pc) pc.addIceCandidate(candidate);
        });
      })
      .catch(err => console.error('Error accessing mic:', err));

    return () => {
      socketRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, [roomId]);

  function createPeer(userId, socket, stream) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    attachStream(pc, stream, socket, userId);
    pc.createOffer()
      .then(o => pc.setLocalDescription(o))
      .then(() => {
        socket.emit('offer', { offer: pc.localDescription, to: userId });
      });
    return pc;
  }

  function attachStream(pc, stream, socket, userId) {
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = ({ streams: [remoteStream] }) => {
      const audioEl = document.createElement('audio');
      audioEl.srcObject = remoteStream;
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
    };

    pc.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('ice-candidate', { candidate: e.candidate, to: userId });
      }
    };
  }
}
