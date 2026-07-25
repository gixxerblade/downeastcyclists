import {spawnSync} from 'node:child_process';

if (process.env.CI === 'true') {
  console.log(
    'Skipping effect-tsgo patch in CI; CI uses unpatched TypeScript 7 from @typescript/native for typechecking.',
  );
  process.exit(0);
}

const result = spawnSync('effect-tsgo', ['patch', '--typescript-package', '@typescript/native'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
