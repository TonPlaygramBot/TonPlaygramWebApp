import { Link } from 'react-router-dom';

// Use the same verified, encrypted composer from every messaging entry point.
export default function InboxWidget() {
  return <section className="p-4 border border-border rounded-xl bg-surface space-y-3">
    <h3 className="font-semibold">Your conversations</h3>
    <p className="text-sm text-subtext">Chat privately, call friends, and choose when new messages disappear in your Social Hub.</p>
    <Link className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold" to="/messages">Open Social Hub</Link>
  </section>;
}
