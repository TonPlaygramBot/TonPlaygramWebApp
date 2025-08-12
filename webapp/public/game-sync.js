(function(){
  const params = new URLSearchParams(location.search);
  const roomId = params.get('roomId') || params.get('tableId');
  if (!roomId) return;
  const s = document.createElement('script');
  s.src = '/socket.io/socket.io.js';
  s.onload = () => {
    const socket = io();
    socket.emit('joinGame', { roomId });
    const api = {
      send(event, payload){ socket.emit('gameAction', { roomId, event, payload }); },
      on(event, handler){ window.addEventListener(event, (e) => handler(e.detail)); }
    };
    window.gameSync = api;
    socket.on('gameAction', ({ event, payload }) => {
      window.dispatchEvent(new CustomEvent(event, { detail: payload }));
    });
  };
  document.head.appendChild(s);
})();
