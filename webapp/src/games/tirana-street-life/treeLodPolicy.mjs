/** Distance hysteresis retains the close prototype until the outer threshold,
 * and the medium prototype until returning inside the inner threshold. */
export function useMediumTree(distance,wasMedium=false,battery=false){
 return Number.isFinite(distance)&&distance>(wasMedium?(battery?25:45):(battery?35:55));
}
export const importedTreeBudget=battery=>battery?3:8;
