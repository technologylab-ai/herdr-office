import { renderHUDs } from './design.mjs';
const args = process.argv.slice(2);
const results = await renderHUDs(args.filter(a => !a.startsWith('--')), { previewsOnly: args.includes('--preview') });
console.log(JSON.stringify(results));
