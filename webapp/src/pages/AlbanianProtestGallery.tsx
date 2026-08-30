import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import MediaWall from '../features/flamingo/MediaWall';
import '../features/flamingo/flamingo.css';

export default function AlbanianProtestGallery() {
  return (
    <div className="flamingo protest-gallery-page">
      <header className="protest-gallery-header">
        <Link to="/" aria-label="Kthehu në faqen kryesore"><ArrowLeft /></Link>
        <div>
          <small>TONPLAYGRAM MBËSHTET SHQIPËRINË</small>
          <strong>Galeria e protestave</strong>
        </div>
        <span aria-hidden="true">🇦🇱</span>
      </header>
      <main className="fr-main">
        <section className="protest-gallery-intro">
          <img src="/assets/flags/albania.svg" alt="Flamuri shqiptar" />
          <div><h1>TonPlayGram mbështet plotësisht protestat shqiptare.</h1><p>Pamje dhe dokumente nga burime të verifikuara, të hapura për të gjithë.</p></div>
        </section>
        <div className="protest-gallery-download-note"><Download /><span>Çdo foto, video ose dokument mund ta shikosh dhe ta shkarkosh në formatin origjinal.</span></div>
        <MediaWall />
        <section className="fr-safety"><ShieldCheck /><div><strong>Publikim i kontrolluar</strong><p>Vetëm zhvilluesi i TonPlayGram mund të publikojë materiale në këtë galeri.</p></div></section>
      </main>
    </div>
  );
}
