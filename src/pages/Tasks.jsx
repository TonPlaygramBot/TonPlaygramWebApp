import React from 'react';

export default function Tasks() {
  return (
    <div className="p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Tasks</h2>
      <button className="bg-accent text-white px-4 py-2 rounded flex items-center justify-center gap-2">
        <img src="/assets/complete-task.png" alt="Task" className="w-4 h-4" />
        Complete Task
      </button>
    </div>
  );
}
