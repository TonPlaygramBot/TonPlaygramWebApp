# tailuge/billiards

Source: https://github.com/tailuge/billiards
Pinned revision: c85f0476c40f74259b8ce9cdd7a0082b8f0eeccc
License: GPL-3.0 (see LICENSE). Copyright the upstream contributors.

Physics files retain the upstream algorithms. `Ball` omits rendering imports and
mesh creation so it can be used by the game, tests and shot planning. `utils`
contains only the numerical helpers needed by these modules.

The Pool Royal adapter and aim module are derived from this source and distributed
under GPL-3.0. Distribution of the combined game must satisfy GPL-3.0, including
availability of corresponding source; the root MIT notice does not replace this
license.
