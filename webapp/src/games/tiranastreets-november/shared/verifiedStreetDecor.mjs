import {VERIFIED_TREE_METADATA} from './verifiedStreetDecorData.mjs';

const treeSources = new Map(VERIFIED_TREE_METADATA.map(t=>[t.id,t]));
export function withVerifiedTreeMetadata(tree){
 const source=treeSources.get(tree.id);
 if(!source||Math.hypot(tree.x-source.x,tree.z-source.z)>.03)return tree;
 return {...tree, ...(source.height===undefined?{}:{height:source.height}),
  ...(source.crown===undefined?{}:{crown:source.crown}),
  ...(source.shape===undefined?{}:{shape:source.shape}),
  sourceId:source.id, mapVersion:source.version, mapTags:source.tags,
  speciesAccuracy:'Retained mapped taxonomy/foliage tags, not a botanical survey',
  dimensionsAccuracy:source.height===undefined?'Dimension estimate retained':'Height set from OSM height tag'};
}
