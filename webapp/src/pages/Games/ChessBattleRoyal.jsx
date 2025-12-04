import React, { useEffect, useState } from 'react';

const MODEL_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf';

function Chess3DModel() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (
      window.customElements &&
      window.customElements.get &&
      window.customElements.get('model-viewer')
    ) {
      setReady(true);
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src =
      'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    script.onload = () => setReady(true);
    script.onerror = () => setReady(false);
    document.head.appendChild(script);
  }, []);

  return (
    <div className="viewer-root">
      <div className="viewer-main">
        {ready ? (
          <model-viewer
            src={MODEL_URL}
            alt="A Beautiful Game - open source chess set"
            camera-controls
            auto-rotate
            autoplay
            exposure="1.0"
            shadow-intensity="1"
            style={{
              width: '100%',
              height: '100%',
              background:
                'radial-gradient(circle at top, #333 0, #050509 55%, #000 100%)',
              borderRadius: '18px'
            }}
          />
        ) : (
          <div className="loading-placeholder">
            Po ngarkohet fusha dhe gurët 3D ABeautifulGame.gltf...
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChessBattleRoyal() {
  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }
        html, body, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
        }
        .app-root {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at top, #222 0, #050509 55%, #000 100%);
          color: #f5f5f5;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow: hidden;
        }
        .viewer-root {
          width: min(96vw, 960px);
          height: min(96vh, 720px);
          display: flex;
          align-items: stretch;
          justify-content: stretch;
        }
        .viewer-main {
          flex: 1;
          border-radius: 20px;
          overflow: hidden;
          box-shadow:
            0 18px 40px rgba(0,0,0,0.9),
            0 0 0 1px rgba(255,255,255,0.05);
          background: radial-gradient(circle at top, #333 0, #050509 55%, #000 100%);
          display: flex;
          align-items: stretch;
          justify-content: stretch;
        }
        .loading-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          opacity: 0.85;
          padding: 1rem;
          text-align: center;
        }
        @media (max-width: 768px) {
          .viewer-root {
            width: 100vw;
            height: 100vh;
          }
        }
      `}</style>
      <div className="app-root">
        <Chess3DModel />
      </div>
    </>
  );
}
