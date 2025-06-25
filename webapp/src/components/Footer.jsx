export default function Footer() {
  return (
    <footer className="bg-surface text-subtext text-sm border-t-2 border-accent">
      <div className="container mx-auto p-4 text-center">
        &copy; {new Date().getFullYear()} TonPlaygram
      </div>
    </footer>
  );
}
