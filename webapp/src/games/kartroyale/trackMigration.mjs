// Saved IDs migrate to genuinely new courses; retired geometry is never selected.
const retired = {
 skanderbeg:'tirana-zogu-pare', blloku:'tirana-sulejman-delvina',
 lana:'tirana-gjollesha-lana', pyramid:'tirana-myslym-shyri',
 stadium:'tirana-prokop-mima', 'lana-pyramid-grand':'tirana-kavaja-gjollesha',
 farke:'tirana-myslym-shyri', surrel:'tirana-zogu-pare', liqeni:'tirana-prokop-mima'
};
export const TRACK_ALIASES=Object.freeze({...retired,
 harbor:retired.skanderbeg,neon:retired.blloku,canyon:retired.lana,
 alpine:retired.pyramid,coast:retired.stadium
});
export const normalizeTrack=id=>TRACK_ALIASES[id]||id;
