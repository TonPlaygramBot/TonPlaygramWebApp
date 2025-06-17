export default function Footer() {
  return (
    <footer className="bg-transparent text-subtext text-sm border-t border-accent">
      <div className="container mx-auto p-4 text-center">
        &copy; {new Date().getFullYear()} TonPlaygram
      </div>
    </footer>
  );
}
