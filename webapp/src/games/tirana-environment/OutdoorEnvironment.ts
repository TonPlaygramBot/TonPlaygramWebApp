import * as T from 'three';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';

/** Original CC0 urban HDRI, served locally. Only reflections use the photograph;
 * the mapped city and its animated sky remain the visible environment. */
export class OutdoorEnvironment {
  private target?:T.WebGLRenderTarget;
  private dead=false;
  error='';
  constructor(private scene:T.Scene,renderer:T.WebGLRenderer){
    void new RGBELoader().loadAsync('/assets/tirana-streets/environment/urban_street_04_1k.hdr').then(texture=>{
      if(this.dead){texture.dispose();return;}
      const pmrem=new T.PMREMGenerator(renderer);
      try{
        texture.mapping=T.EquirectangularReflectionMapping;
        this.target=pmrem.fromEquirectangular(texture);
        scene.environment=this.target.texture;
      }finally{texture.dispose();pmrem.dispose();}
    }).catch(error=>{if(!this.dead){this.error=String(error);console.warn('Tirana outdoor lighting unavailable:',error);}});
  }
  dispose(){
    this.dead=true;
    if(this.scene.environment===this.target?.texture)this.scene.environment=null;
    this.target?.dispose();this.target=undefined;
  }
}
