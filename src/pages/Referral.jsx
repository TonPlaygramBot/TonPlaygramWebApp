export default function Referral() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Referral</h2>
      <p>Your code: <strong>ABC123</strong></p>
      <input
        className="border p-2 w-full mt-2"
        value="https://t.me/TonPlaygramBot?start=ABC123"
        readOnly
      />
    </div>
  );
}
