import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
 plugins:[react()],publicDir:false,
 define:{'process.env.NODE_ENV':JSON.stringify('production')},
 resolve:{alias:{'@':path.resolve(__dirname,'..')}},
 build:{outDir:path.resolve(__dirname,'mobile-preview'),emptyOutDir:true,target:'es2020',
  lib:{entry:path.resolve(__dirname,'mobile-preview-entry.tsx'),formats:['es'],fileName:()=> 'preview.js',cssFileName:'preview'},
 },
});
