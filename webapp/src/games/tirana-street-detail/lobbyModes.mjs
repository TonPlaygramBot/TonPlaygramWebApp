/** Public local-mode URLs. Never carry a paid match ID or stake into a career. */
export const LOCAL_ACTIVITIES = Object.freeze([
  Object.freeze({id:'street-career', title:'Career mode', description:'Drive, take jobs, unlock chapters and build your life in Tirana.', action:'START / CONTINUE CAREER'}),
  Object.freeze({id:'career', title:'City Stories', description:'On-foot courier jobs and the existing Dajti excursion.', action:'OPEN CITY STORIES'})
]);
export function localActivityURL(activity) {
  if (!LOCAL_ACTIVITIES.some(item => item.id === activity)) throw new Error('Unknown local activity');
  return `/games/tiranastreets?${new URLSearchParams({mode:'ai',activity})}`;
}
