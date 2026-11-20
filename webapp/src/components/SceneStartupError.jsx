export default function SceneStartupError({ onReload, onLobby }) {
  return (
    <div role="alert" className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-950/95 p-6">
      <div className="max-w-sm text-center">
        <p className="font-semibold">The 3D board could not start.</p>
        <p className="mt-2 text-sm text-white/70">Reload the game to try again, or return to the lobby. If this continues, check that WebGL is available in your browser.</p>
        <button type="button" onClick={onReload} className="mt-4 min-h-11 rounded-xl bg-cyan-700 px-5 py-3 font-semibold">Reload game</button>
        <button type="button" onClick={onLobby} className="ml-2 mt-4 min-h-11 rounded-xl border border-white/20 px-5 py-3">Lobby</button>
      </div>
    </div>
  );
}
