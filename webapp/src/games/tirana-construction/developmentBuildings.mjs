// Authored construction footprints inside verified OSM sites, avoiding existing buildings.
// Current heights/stages are illustrative; see developmentSites.mjs for provenance.
export const DEVELOPMENT_BUILDINGS = [
  {
    "id": "development:mount-tirana",
    "name": "Mount Tirana",
    "p": [
      [
        177.834,
        -273.878
      ],
      [
        162.634,
        -247.551
      ],
      [
        127.992,
        -267.551
      ],
      [
        143.192,
        -293.878
      ]
    ],
    "h": 44.8,
    "minHeight": 0,
    "holes": [],
    "neighbourhood": true,
    "source": "https://www.openstreetmap.org/way/1198141918",
    "heightSource": "authored",
    "heightBasis": "Illustrative construction phase, not current measured height",
    "constructionStage": "frame",
    "tags": {
      "building": "construction",
      "construction": "mixed_use"
    },
    "development": "mount-tirana"
  },
  {
    "id": "development:hora-vertikale",
    "name": "Hora Vertikale",
    "p": [
      [
        -1336.1,
        -282.521
      ],
      [
        -1336.1,
        -267.321
      ],
      [
        -1356.1,
        -267.321
      ],
      [
        -1356.1,
        -282.521
      ]
    ],
    "h": 32,
    "minHeight": 0,
    "holes": [],
    "neighbourhood": true,
    "source": "https://www.openstreetmap.org/way/1319729560",
    "heightSource": "authored",
    "heightBasis": "Illustrative construction phase, not current measured height",
    "constructionStage": "infill",
    "tags": {
      "building": "construction",
      "construction": "mixed_use"
    },
    "development": "hora-vertikale"
  },
  {
    "id": "development:bond-tower",
    "name": "Bond Tower",
    "p": [
      [
        -1856.256,
        -888.743
      ],
      [
        -1865.376,
        -872.947
      ],
      [
        -1886.161,
        -884.947
      ],
      [
        -1877.041,
        -900.743
      ]
    ],
    "h": 38.4,
    "minHeight": 0,
    "holes": [],
    "neighbourhood": true,
    "source": "https://www.openstreetmap.org/way/1482335158",
    "heightSource": "authored",
    "heightBasis": "Illustrative construction phase, not current measured height",
    "constructionStage": "unfinished",
    "tags": {
      "building": "construction",
      "construction": "mixed_use"
    },
    "development": "bond-tower"
  }
];
