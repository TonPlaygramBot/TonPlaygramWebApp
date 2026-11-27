// Fallback silhouettes render these approximate bays without adding any meshes.
// Match the modeled LOD's floor spacing and edge column count; don't imply
// the number of real windows is known when the map only gives a footprint.
export function wallWindowProjection(building, rows, width) {
 const columns=Math.min(24,Math.floor(width/4));
 if(!columns||!rows.length||building.special) return null;
 const t=building.tags||{};
 if(t.construction||t.historic||t.military||t.amenity||
   !['yes','residential','apartments','house','detached','terrace','semidetached_house','retail','commercial','office'].includes(t.building))return null;
 const spacing=rows.length>1?rows[1].y-rows[0].y:Math.max(4, building.h+2);
 return {columns, first:rows[0].y, spacing, max:rows.length};
}
export function windowVertex(projected, horizontal, elevation) {
 if(!projected) return [0,0,0];
 // Local wall U follows the source polygon edge even on diagonal roads.
 const pack = (value, scale) => Math.round(65535 * Math.max(0, Math.min(1, value/scale)));
 return [pack(horizontal*projected.columns, 24), pack((elevation-projected.first)/projected.spacing+2.5, 128), pack(projected.max, 128)];
}
