export const APP_VERSION = "0.8.0";
export const APP_VERSION_CODE = 8;
export const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/eursaultm-hue/Self-disciplined/main/public/update.json";
export type UpdateManifest = { version: string; versionCode: number; downloadUrl: string; notes: string[] };
function compareVersion(a:string,b:string){const aa=a.split(".").map(Number),bb=b.split(".").map(Number);for(let i=0;i<3;i++)if((aa[i]||0)!==(bb[i]||0))return(aa[i]||0)>(bb[i]||0)?1:-1;return 0;}
export async function fetchUpdateManifest():Promise<UpdateManifest|null>{try{const r=await fetch(UPDATE_MANIFEST_URL+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)return null;return await r.json() as UpdateManifest;}catch{return null;}}
export async function checkForUpdate():Promise<UpdateManifest|null>{const m=await fetchUpdateManifest();return m?.version&&compareVersion(m.version,APP_VERSION)>0?m:null;}
