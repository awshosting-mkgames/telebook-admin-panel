import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Vite — par `npm start` se hi chalta hai (package.json me script ka naam
//  "start" rakha hai).
//
//  Create React App (react-scripts) jaan-bujh kar nahi liya: woh ab maintain
//  nahi hota, install par hi security warning deta hai, aur React ki apni
//  docs usse hata chuki hain. Vite wahi kaam karta hai, bahut tez, aur
//  command wahi rehti hai jo aap chahte the.
// ─────────────────────────────────────────────────────────────────────────────
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    // Panel kisi bhi folder me rakha ja sake (sirf static files hain)
    assetsDir: 'assets',
  },
  // Relative paths — panel ko kisi sub-folder me rakhne par bhi chalta rahe
  base: './',
});
