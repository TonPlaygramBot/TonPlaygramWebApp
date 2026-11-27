// OpenStreetMap contributors, ODbL 1.0: anchor from the complete Karl Topia
// loop (not the mean of individual way 549166142's west-only vertices).
// The circular landscaping profile is a photo-informed visual estimate.
export const ZOGU_I_ZI = Object.freeze({
  x:-1204.24,z:-615.04,radius:23,poolRadius:11,
  roadWays:['37229363','548351119','549125847','549166140','549166141','549166142','736331978'],
  source:'https://www.iknshpk.al/en/surveillance-reconception-fountain-zogu-i-zi-tirana',
  photo:'https://www.flickr.com/photos/thetaipanofhongkong/54841213439'
});

export const GARDEN_BUILDING = Object.freeze({
  x:-1092,z:72,
  // Only dress the mapped 24/16-storey tower parts and four-storey podiums;
  // 889954218 is the redundant low outline, not an extra visible facade.
  levels:Object.freeze({'889954219':24,'889954220':16,'889954860':4,'959099624':4}),
  source:'https://nova.al/en/projects/completed-projects-hidden/34-tirana-garden-building',
  photo:'https://duashpi.al/en/property/69b9472cea7bc2e6f108f3e3/apartment-212-for-sale-at-tirana-garden-building.html'
});
