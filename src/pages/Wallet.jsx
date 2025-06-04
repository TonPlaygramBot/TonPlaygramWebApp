export default function Wallet() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Wallet</h2>
      <p>10,000 TPC</p>
      <p>1.25 TON</p>
      <div className="mt-4">
        <button className="bg-primary text-white px-4 py-2 rounded mr-2" disabled>
          Deposit TON
        </button>
        <button className="bg-primary text-white px-4 py-2 rounded" disabled>
          Withdraw TPC
        </button>
      </div>
    </div>
  );
}
