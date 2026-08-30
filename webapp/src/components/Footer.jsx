import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-surface text-subtext text-sm border-t-2 border-accent">
      <div className="container mx-auto p-4 text-center">
        <p>&copy; {new Date().getFullYear()} TonPlaygram</p>
        <nav className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label="Legal">
          <Link className="underline hover:text-text" to="/privacy">Privacy</Link>
          <Link className="underline hover:text-text" to="/terms">Terms</Link>
          <Link className="underline hover:text-text" to="/competition-policy">Competition &amp; fair play</Link>
          <Link className="underline hover:text-text" to="/delete-account">Delete account</Link>
        </nav>
      </div>
    </footer>
  );
}
