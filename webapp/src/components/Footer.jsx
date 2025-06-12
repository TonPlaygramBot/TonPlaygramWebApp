export default function Footer() {
  return (
    <footer className="bg-dark text-gray-300 text-sm border-t border-yellow-600">
      <div className="container mx-auto p-4 flex items-center justify-center space-x-6">
        <div className="flex items-center space-x-1">
          <span className="text-blue-400 text-2xl">🔵</span>
          <span className="font-bold text-white">10,500 TPZ</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-blue-400 text-2xl">🔵</span>
          <span className="font-bold text-white">1,25 TON</span>
        </div>
      </div>
    </footer>
  );
}
