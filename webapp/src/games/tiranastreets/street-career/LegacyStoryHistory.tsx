import type {LegacyStoryHistoryData} from './legacyStoryHistory.mjs';
export function LegacyStoryHistory({history}:{history:LegacyStoryHistoryData|null}){
  if(!history)return null;
  return <details className="tsc-legacy-history">
    <summary>Earlier City Stories · {history.completed.length}/{history.total} chapters completed</summary>
    <p>Your earlier progress is retained as history. Those chapters have different objectives, so they do not mark current jobs complete or add rewards to this campaign.</p>
    {history.completed.length>0&&<ul aria-label="Completed earlier chapters">{history.completed.map(title=><li key={title}>{title}</li>)}</ul>}
    {history.active&&<p>Last saved chapter: <strong>{history.active.title}</strong> · Step {history.active.step} of {history.active.total}.</p>}
  </details>;
}
