import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const macBlender = '/Applications/Blender.app/Contents/MacOS/Blender';
const executable = process.env.BLENDER_BIN ||
  (process.platform === 'darwin' && existsSync(macBlender) ? macBlender : 'blender');
const script = fileURLToPath(new URL('./build_models.py', import.meta.url));
const result = spawnSync(executable, ['--background', '--factory-startup', '--python', script], { stdio: 'inherit' });
if (result.error) {
  console.error(`Cannot start Blender: ${result.error.message}. Install Blender or set BLENDER_BIN to its executable.`);
}
process.exit(result.status ?? 1);
