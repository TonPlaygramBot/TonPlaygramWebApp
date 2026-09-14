declare const layouts:Record<string,{
 sha256:string;
 axis:number[];
 wheels:{center:number[];radius:number;axis?:number[]}[];
 meshes:Record<string,{triangles:number;runs:number[][]}>;
}>;
export default layouts;
