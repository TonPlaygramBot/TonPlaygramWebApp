import RequireAuth from '../components/RequireAuth.jsx';

export default function Profile() {
  return (
    <RequireAuth>
      <div className="p-4 text-text">Profile page</div>
    </RequireAuth>
  );
}
