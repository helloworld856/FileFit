import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],worker:{format:'es'},optimizeDeps:{noDiscovery:true,include:['react','react/jsx-runtime','react-dom/client','lucide-react','jszip','heic2any','tesseract.js','pdfjs-dist','@pdf-lib/fontkit','pdf-lib']},server:{host:'127.0.0.1',watch:{ignored:['**/test-results/**','**/playwright-report/**']}},build:{target:'es2022',manifest:'asset-manifest.json'}});
