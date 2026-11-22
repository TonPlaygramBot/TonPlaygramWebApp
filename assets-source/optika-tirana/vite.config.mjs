import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const three=resolve(root,'../../webapp/node_modules/three');
export default {root,resolve:{alias:[{find:/^three$/,replacement:resolve(three,'build/three.module.js')},{find:/^three\/examples\//,replacement:resolve(three,'examples')+'/'}]},base:'./',publicDir:false};
