export default function GameCard({ title, description }) {
  return (
    <div className="border p-4 rounded shadow">
      <h3 className="font-bold mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
