import sharp from 'sharp';
for(const name of ['hero','catalog']){await sharp(`public/${name}.png`).webp({quality:86,effort:5}).toFile(`public/${name}.webp`)}
console.log('Imágenes WebP optimizadas sin alterar el diseño.');
