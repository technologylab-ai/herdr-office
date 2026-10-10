/** V8 keeps Opus's accepted glass visuals: copy exact HUD alpha movies and masks, without rendering new graphics. */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sequence } from './plan.mjs';

const directory = path.resolve('artifacts/marketing/v8');
const requested = process.argv.slice(2).filter(value => !value.startsWith('--'));
const sources = {
  'floors-buildnode': 'artifacts/marketing/v7',
  'floors-return': 'artifacts/marketing/v7',
  'bookmark-floor-jump': 'artifacts/marketing/v6',
};
if (requested.some(id => !(id in sources))) throw new Error('Only the three affected Build Node HUDs are copied by this command.');
await mkdir(directory, { recursive: true });
const results = [];
for (const scene of sequence.filter(scene => scene.id in sources && (!requested.length || requested.includes(scene.id)))) {
  const files = [];
  for (const suffix of ['-hud.mov', '-glass-mask.png', '-hud.png']) {
    const source = path.resolve(sources[scene.id], scene.id + suffix);
    const destination = path.join(directory, scene.id + suffix);
    await copyFile(source, destination);
    const [before, after] = await Promise.all([readFile(source), readFile(destination)]);
    const sha256 = createHash('sha256').update(before).digest('hex');
    if (sha256 !== createHash('sha256').update(after).digest('hex')) throw new Error('Accepted HUD copy differs from its source.');
    files.push({ file: path.basename(destination), source: path.relative(process.cwd(), source), sha256 });
  }
  results.push({ id: scene.id, duration: scene.duration, frames: Math.round(scene.duration * 30), unchangedAcceptedGlass: true, files });
}
await writeFile(path.join(directory, 'hud-copy-report.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
