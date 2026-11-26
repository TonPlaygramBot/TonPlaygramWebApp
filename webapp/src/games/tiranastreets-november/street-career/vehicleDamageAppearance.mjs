/** Mechanical wear preserves paint. Soot belongs to a vehicle exposed to fire. */
export function vehicleDamageAppearance(car){
  const wear=Math.max(0,Math.min(1,car.destroyed?1:1-(car.health??140)/140));
  const charred=!!(car.exploded||car.burning);
  return {brightness:1-wear*(charred?.78:.14),roughness:wear*(charred?.95:.62),charred};
}
