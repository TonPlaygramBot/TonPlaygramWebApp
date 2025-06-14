<tbody>
  {leaderboard.map((u) => (
    <tr
      key={u.telegramId}
      className={`border-b border-border ${
        u.telegramId === telegramId ? 'bg-primary/20' : ''
      }`}
    >
      <td className="px-2 py-1">{u.rank}</td>
      <td className="px-2 py-1">
        {u.nickname || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.telegramId}
      </td>
      <td className="px-2 py-1 text-right">{u.balance}</td>
    </tr>
  ))}
</tbody>
