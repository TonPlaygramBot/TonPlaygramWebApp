import { useEffect, useState } from 'react';
import { listTasks, completeTask } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function Tasks() {
  const [tasks, setTasks] = useState(null);

  const load = async () => {
    const data = await listTasks(getTelegramId());
    setTasks(data);
  };

  useEffect(() => { load(); }, []);

  const handleComplete = async (id) => {
    await completeTask(getTelegramId(), id);
    load();
  };

  if (!tasks) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Tasks</h2>
      <ul className="space-y-2">
        {tasks.map(t => (
          <li key={t.id} className="border p-2 flex justify-between items-center">
            <span>{t.description}</span>
            {t.completed ? (
              <span className="text-green-600">Completed</span>
            ) : (
              <button onClick={() => handleComplete(t.id)} className="px-2 py-1 bg-blue-500 text-white rounded">Complete</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
