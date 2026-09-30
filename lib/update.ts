export const APP_VERSION = "0.7.0";
export const APP_VERSION_CODE = 7;
export const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/eursaultm-hue/Self-disciplined/main/public/update.json";
export type UpdateManifest = { version: string; versionCode: number; downloadUrl: string; notes: string[] };
function compareVersion(a:string,b:string){const aa=a.split(".").map(Number),bb=b.split(".").map(Number);for(let i=0;i<3;i++)if((aa[i]||0)!==(bb[i]||0))return(aa[i]||0)>(bb[i]||0)?1:-1;return 0;}
export async function checkForUpdate():Promise<UpdateManifest|null>{try{const r=await fetch(UPDATE_MANIFEST_URL+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)return null;const m=await r.json() as UpdateManifest;return m?.version&&compareVersion(m.version,APP_VERSION)>0?m:null;}catch{return null;}}
