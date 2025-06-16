// All possible ordered combinations for a pair of dice
// Exported as an array of [die1, die2]
const diceCombinations = [];
for (let a = 1; a <= 6; a++) {
  for (let b = 1; b <= 6; b++) {
    diceCombinations.push([a, b]);
  }
}
export default diceCombinations;
