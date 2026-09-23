import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],worker:{format:'es'},optimizeDeps:{entries:['index.html']},server:{host:'127.0.0.1'},build:{target:'es2022'}});
