/** Original Blender collection. Metres, native +X nose; no mesh/material reduction. */
export const VEHICLE_COLLECTION = Object.freeze([
  {
    "id": "benz",
    "name": "Mercedes-Benz S 65 AMG W221",
    "url": "/assets/tirana-streets/vehicle-collection/benz.glb",
    "sha256": "e648902e335047042efad448ea7fd1c658dfd4dc2d2ae58b076e2294aec9ad80",
    "bytes": 5001948,
    "length": 5.220000267028809,
    "width": 2.113741159439087,
    "height": 1.5063360929489136,
    "driverSeat": [
      -0.12,
      0.57,
      -0.43
    ]
  },
  {
    "id": "bmw",
    "name": "BMW M3 GT3",
    "url": "/assets/tirana-streets/vehicle-collection/bmw.glb",
    "sha256": "4d73b3d7896e48933c4647946704ec7fc9d83d3c6b7dc8b923ef9d5f9ae25bd5",
    "bytes": 3610124,
    "length": 4.75,
    "width": 1.9765241146087646,
    "height": 1.3826935291290283,
    "driverSeat": [
      -0.24,
      0.47,
      -0.42
    ]
  },
  {
    "id": "range",
    "name": "Range Rover Sport 2018",
    "url": "/assets/tirana-streets/vehicle-collection/range.glb",
    "sha256": "25dbd07c141712c57bd011aebe51702b32246cc83c6783ec11c52b24e74edd45",
    "bytes": 7551144,
    "length": 4.869999885559082,
    "width": 2.172074794769287,
    "height": 1.8073318004608154,
    "driverSeat": [
      -0.12,
      0.85,
      -0.43
    ]
  },
  {
    "id": "audi",
    "name": "Audi A8 Custom 2018",
    "url": "/assets/tirana-streets/vehicle-collection/audi.glb",
    "sha256": "fdb03e19a9a3598b06dcffc6a2ac894766b9c765f435efb08f50a1389f56cb96",
    "bytes": 6959904,
    "length": 5.170000076293945,
    "width": 2.1459572315216064,
    "height": 1.487999439239502,
    "driverSeat": [
      -0.08,
      0.55,
      -0.43
    ]
  },
  {
    "id": "ford",
    "name": "Ford Focus",
    "url": "/assets/tirana-streets/vehicle-collection/ford.glb",
    "sha256": "e48610296f748220ff77ef254934734b07a77e1db12f1ee03c87070aecb4cdcb",
    "bytes": 3476592,
    "length": 4.059999942779541,
    "width": 1.826794981956482,
    "height": 1.5723010301589966,
    "driverSeat": [
      -0.2,
      0.61,
      -0.39
    ]
  },
  {
    "id": "fiat",
    "name": "Fiat Punto GT 1995",
    "url": "/assets/tirana-streets/vehicle-collection/fiat.glb",
    "sha256": "1e831d44bc6b3ff253d5e8496a226d2e422068efb9d45022e3f155ddac5c9bcb",
    "bytes": 16341268,
    "length": 3.759999990463257,
    "width": 1.9221205711364746,
    "height": 1.7362756729125977,
    "driverSeat": [
      -0.1,
      0.51,
      -0.37
    ]
  },
  {
    "id": "jaguar",
    "name": "Jaguar I-Pace",
    "url": "/assets/tirana-streets/vehicle-collection/jaguar.glb",
    "sha256": "332470befbafc6e443905fb713e50ab9304d25a67e1a2f5c8d259c871b10b5a0",
    "bytes": 3621176,
    "length": 4.680000305175781,
    "width": 2.0794687271118164,
    "height": 1.603254795074463,
    "driverSeat": [
      -0.1,
      0.68,
      -0.42
    ]
  },
  {
    "id": "ferrari",
    "name": "Ferrari 458 Spider",
    "url": "/assets/tirana-streets/vehicle-collection/ferrari.glb",
    "sha256": "f61dd84634a03205ba59cc839006489757f3579f26dfda1c76fb55492036c5ac",
    "bytes": 3967680,
    "length": 4.529999732971191,
    "width": 2.2553367614746094,
    "height": 1.2349133491516113,
    "driverSeat": [
      -0.32,
      0.38,
      -0.38
    ]
  },
  {
    "id": "bugatti",
    "name": "Bugatti La Voiture Noire 2019",
    "url": "/assets/tirana-streets/vehicle-collection/bugatti.glb",
    "sha256": "03adf35a5462c92d3dbecbd7cc433a5983751c7d924966f3bba996c50ce84e99",
    "bytes": 4784968,
    "length": 4.539999961853027,
    "width": 2.016184091567993,
    "height": 1.1363942623138428,
    "driverSeat": [
      -0.12,
      0.23,
      -0.38
    ]
  },
  {
    "id": "landrover",
    "name": "Land Rover Defender Grasmere",
    "url": "/assets/tirana-streets/vehicle-collection/landrover.glb",
    "sha256": "90753148ceedd1087ed6a388def51b1809d0b00623589860e29c6f49bc73b2e2",
    "bytes": 5733524,
    "length": 5.0199995040893555,
    "width": 2.1208837032318115,
    "height": 2.036067485809326,
    "driverSeat": [
      0.06,
      1.02,
      -0.43
    ]
  }
].map(c=>Object.freeze({...c,driverSeat:Object.freeze(c.driverSeat)})));
export const COLLECTION_BY_ID = new Map(VEHICLE_COLLECTION.map(c=>[c.id,c]));
export function collectionVehicleFor(car) { return COLLECTION_BY_ID.get(car.collectionVehicle); }
export const COLLECTION_DRIVER_URL = '/assets/table-tennis/chess-human.glb';
