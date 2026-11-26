export type LegacyStoryHistoryData={completed:string[];total:number;active:null|{title:string;step:number;total:number}};
export function loadLegacyStoryHistory(storage?:Pick<Storage,'getItem'>):LegacyStoryHistoryData|null;
