import { AiOutlineBell } from 'react-icons/ai';

export default function NotificationBell({ count = 0 }) {
  return (
    <div className="relative inline-flex items-center">
      <AiOutlineBell className="w-7 h-7" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-accent text-black text-xs font-bold rounded-full px-1">
          {count}
        </span>
      )}
    </div>
  );
}
