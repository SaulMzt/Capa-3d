import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({plugins:[react()],root:__dirname,publicDir:path.resolve(__dirname,'../public'),resolve:{alias:{'@':path.resolve(__dirname,'..')}},build:{outDir:path.resolve(__dirname,'../ftp-dist'),emptyOutDir:false,manifest:true,target:'es2020'}});
