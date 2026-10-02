import { build } from 'esbuild';
await build({entryPoints:['src/game/engine.ts'],outfile:'supabase/functions/_shared/game-engine.js',bundle:true,format:'esm',platform:'neutral',target:'es2022',define:{'import.meta.env.BASE_URL':'"/"'},tsconfig:'tsconfig.app.json'});
