import React from 'react';
const shapes:Record<string,React.ReactNode>={
 views:<><path d="M3 7h5l2-3h4l2 3h5v13H3z"/><circle cx="12" cy="13" r="3.6"/></>,
 jump:<><path d="m5 17 5-5 4 2 3-6m-4 0h4v4M4 21h16"/><circle cx="11" cy="6" r="2"/></>,
 shield:<><path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z"/><path d="M12 7v9m-4.5-4.5h9"/></>,
 ship:<><path d="m2 15 5 4h11l4-7-7 1H2zM6 13V8h9v5M8 8V4h3v4m5 4V5m0 1 4 4M2 22q3-2 6 0 3-2 6 0 3-2 7 0"/></>,
 plane:<><path d="m2 13 8-2 2-8 2-1 1 9 6 4v2l-7-2-1 5 2 2-4-1-3 1 2-3v-4l-8-.5z"/></>,
 hill:<><path d="m1 17 6-9 4 5 5-9 7 13M4 21v-5l5-4 5 4v5M2 21h19m-5-1v-5l4-3 3 3m-15 6v-3h3v3"/></>,
 train:<><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 6h8M7 18l-4 4m14-4 4 4M5 21h14"/><circle cx="8.5" cy="15" r=".8"/><circle cx="15.5" cy="15" r=".8"/></>,
 brand:<><path d="m12 1 10 6v10l-10 6-10-6V7z"/><path d="m12 5 6 3.5v7L12 19l-6-3.5v-7z"/><path d="m12 1 0 7m10-1-6.1 3.5M22 17l-6-3.5M12 23v-7M2 17l6.1-3.5M2 7l6.1 3.5"/><circle cx="12" cy="12" r="2.5"/></>,
 stages:<><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/></>,
 sound:<><path d="M3 9h4l5-4v14l-5-4H3zM16 8c2.1 2.1 2.1 5.9 0 8m3-11c4 4 4 10 0 14"/></>,
 mute:<><path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/></>,
 pause:<><path fill="currentColor" stroke="none" d="M6 4h4v16H6zm8 0h4v16h-4z"/></>,
 coin:<><circle cx="12" cy="12" r="9"/><path d="m12 6 4.5 6-4.5 6-4.5-6z"/></>,
 target:<><circle cx="12" cy="12" r="7.1"/><circle cx="12" cy="12" r="2.1"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/></>,
 shoot:<><path d="M8.5 3.2H5.2l-2 2v3.3m12.3-5.3h3.3l2 2v3.3M3.2 15.5v3.3l2 2h3.3m7 0h3.3l2-2v-3.3"/><circle cx="12" cy="12" r="4.1"/><circle cx="12" cy="12" r=".85" fill="currentColor"/></>,
 reload:<><path d="M20.2 10a8.5 8.5 0 0 0-14.7-3L3 10m0-6v6h6m-5 4a8.5 8.5 0 0 0 14.6 3l2.4-3m0 6v-6h-6"/></>,
 close:<path d="m5 5 14 14M19 5 5 19"/>,play:<path d="M7 4.5 20 12 7 19.5z" fill="currentColor" stroke="none"/>,
 mouse:<><rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6"/></>,
 touch:<><path d="M9 13V6a1.6 1.6 0 0 1 3.2 0v5-1a1.4 1.4 0 0 1 2.7 0v1a1.4 1.4 0 0 1 2.7 0v.7a1.4 1.4 0 0 1 2.7 0v3.7c0 2.6-.9 4.6-2.8 6H11l-4.8-6c-1.5-2 .4-3.4 1.7-2.4L9 14"/><path d="m2 6 2-2m-2 2 2 2m-2-2h4"/></>,
 check:<path d="m4 12 5 5L20 6"/>,menu:<><path d="M4 5h5v5H4zm11 0h5v5h-5zM4 15h5v5H4zm11 0h5v5h-5z"/></>,
 film:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16m10-16v16M3 8h4m-4 8h4m10-8h4m-4 8h4"/></>,
 wind:<><path d="M2 10h12a3 3 0 1 0-3-3m-9 7h15a3 3 0 1 1-3 3"/></>,
 medal:<><circle cx="12" cy="9" r="6"/><path d="m8 14-1 7 5-3 5 3-1-7"/></>,
 trophy:<><path d="M7 3h10v6c0 4-2 6-5 6s-5-2-5-6zM7 5H3v2c0 4 2 5 5 5m9-7h4v2c0 4-2 5-5 5m-4 3v5m-5 1h10"/></>
};
export function Icon({name,size=20}:{name:string,size?:number}){return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>}
