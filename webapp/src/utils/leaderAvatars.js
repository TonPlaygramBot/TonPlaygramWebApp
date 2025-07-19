export const LEADER_AVATARS = [
  '/assets/icons/AlbaniaLeader.webp',
  '/assets/icons/UkraineLeader.webp',
  '/assets/icons/CanadaLeader.webp',
  '/assets/icons/GermanyLeader.webp',
  '/assets/icons/JapanLeader.webp',
  '/assets/icons/UnitedKingdomLeader .webp',
  '/assets/icons/FranceLeader.webp',
  '/assets/icons/IndiaLeader.webp',
  '/assets/icons/ChinaLeader.webp',
  '/assets/icons/RussiaLeader.webp',
  '/assets/icons/UsaLeader.webp',
  '/assets/icons/ItalyLeader.webp',
  '/assets/icons/GreeceLeader.webp',
  '/assets/icons/TurkeyLeader.webp',
  '/assets/icons/VenezuelaLeader.webp',
  '/assets/icons/BukinaFasoLeader.webp',
  '/assets/icons/DubaiLeader.webp',
  '/assets/icons/SudArabiaLeader.webp',
  '/assets/icons/IsraelLeader.webp',
  '/assets/icons/JordanLeader.webp',
  '/assets/icons/EgyptLeader.webp',
  '/assets/icons/IranLeader.webp',
  '/assets/icons/SerbiaLeader.webp',
  '/assets/icons/HungaryLeader.webp',
  '/assets/icons/BelarusLeader.webp',
  '/assets/icons/NorthKoreaLeader.webp'
];

export const LEADER_PHOTO_AVATARS = LEADER_AVATARS.map(p => p.replace('.webp', '.jpg'));

export const LEADER_NAMES = [
  'E.Rama',
  'V.Zelensky',
  'J.Trudeau',
  'O.Scholz',
  'F.Kishida',
  'R.Sunak',
  'E.Macron',
  'N.Modi',
  'X.Jinping',
  'V.Putin',
  'D.Trump',
  'G.Meloni',
  'K.Mitsotakis',
  'R.Erdogan',
  'N.Maduro',
  'I.Traore',
  'M.Maktoum',
  'M.BinSalman',
  'B.Netanyahu',
  'A.II',
  'A.El-Sisi',
  'E.Raisi',
  'A.Vucic',
  'V.Orban',
  'A.Lukashenko',
  'K.JongUn'
];

export const LEADER_NAME_MAP = Object.fromEntries(
  LEADER_AVATARS.map((src, i) => [src, LEADER_NAMES[i]])
);
