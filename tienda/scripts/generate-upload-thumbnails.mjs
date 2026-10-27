import {readdir,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const source=path.resolve('.private/upload-originals');
const target=path.resolve('ftp-dist/uploads/thumbs');
await mkdir(target,{recursive:true});
let originals=0,thumbnails=0,count=0;
for(const name of await readdir(source)){
 if(!/^[a-f0-9-]+\.(?:png|jpg|webp)$/i.test(name))continue;
 const input=path.join(source,name);
 const output=path.join(target,'opt-'+path.parse(name).name+'.webp');
 await sharp(input).rotate().resize({width:600,withoutEnlargement:true}).webp({quality:75,effort:4}).toFile(output);
 originals+=(await stat(input)).size;
 thumbnails+=(await stat(output)).size;
 count++;
}
console.log(`Generated ${count} thumbnails: ${originals} -> ${thumbnails} bytes`);
