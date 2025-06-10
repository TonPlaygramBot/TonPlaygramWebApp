export default function Footer() {
  return (
    <footer className="bg-white border-t text-sm text-gray-500">
      <div className="container mx-auto p-4 text-center">
        &copy; {new Date().getFullYear()} TonPlaygram
      </div>
    </footer>
  );
}
