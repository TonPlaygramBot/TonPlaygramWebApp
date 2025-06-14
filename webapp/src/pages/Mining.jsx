<tbody>
  {leaderboard.map((u, idx) => (
    <tr
      key={u.telegramId}
      className={`border-b border-border ${u.telegramId === telegramId ? 'bg-accent text-black' : ''}`}
    >
      <td className="p-2">{idx + 1}</td>
      <td className="p-2 flex items-center space-x-2">
        {u.photo && (
          <img src={u.photo} alt="" className="w-6 h-6 rounded-full" />
        )}
        <span>{u.nickname || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'User'}</span>
      </td>
      <td className="p-2 text-right">{u.balance}</td>
    </tr>
  ))}
  {rank && rank > 100 && (
    <tr className="bg-accent text-black">
      <td className="p-2">{rank}</td>
      <td className="p-2">You</td>
      <td className="p-2 text-right">{balances.tpc ?? '...'}</td>
    </tr>
  )}
</tbody>