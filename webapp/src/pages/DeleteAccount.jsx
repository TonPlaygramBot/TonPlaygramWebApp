import { Link } from 'react-router-dom';

export default function DeleteAccount() {
  return <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-24 pt-6 text-text">
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-300">Account control</p>
    <h1 className="mt-2 text-3xl font-bold">Delete your TonPlaygram account</h1>
    <div className="mt-5 space-y-4 rounded-2xl border border-border bg-surface p-4 text-sm leading-6 text-subtext">
      <p>You can permanently delete an authenticated account from the bottom of the <strong className="text-text">My Account</strong> screen.</p>
      <p>Deletion removes your profile, linked provider identifiers, push tokens, preferences, inventories, and embedded account history. Public blockchain records cannot be deleted. Minimal anonymized records may be retained only where required for fraud prevention, disputes, or law.</p>
      <p>Pending withdrawals or unresolved competitive settlements must finish or be reviewed before deletion. This protects your balance and other players.</p>
    </div>
    <Link className="mt-5 block w-full rounded-2xl bg-red-500 px-4 py-3 text-center font-semibold text-white" to="/account#delete-account">Open My Account</Link>
    <p className="mt-5 text-sm text-subtext">Cannot access your account? Email <a className="underline text-text" href="mailto:privacy@tonplaygram.com?subject=TonPlaygram%20account%20deletion">privacy@tonplaygram.com</a> from the address linked to the account and include your Account ID. We verify ownership before processing.</p>
    <div className="mt-6 flex gap-4 text-sm"><Link className="underline" to="/privacy">Privacy Policy</Link><Link className="underline" to="/terms">Terms</Link></div>
  </main>;
}
