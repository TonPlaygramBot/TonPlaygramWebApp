export default function Token({ icon, value }) {
  return (
    <div className="flex items-center space-x-1">
      <img src={icon} alt="token" className="w-5 h-5" />
      <span>{value}</span>
    </div>
  );
}
