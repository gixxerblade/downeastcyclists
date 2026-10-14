import {spawn, type ChildProcess} from 'node:child_process';
import {createWriteStream, existsSync} from 'node:fs';
import {mkdir, mkdtemp, readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {setTimeout} from 'node:timers/promises';

import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';

import {LOCAL_TEST_DATABASE_URL} from '../../src/lib/local-testing';

import {
  appUrl,
  supportUrl,
  emulatorUrl,
  localProject,
  webhookSecret,
  seedLocalAccounts,
} from './fixtures';
import {createLocalProviders, json} from './providers';

async function main() {
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const root = process.cwd();
  const localRoot = resolve(root, '.local/waiver-tests');
  const children: ChildProcess[] = [];
  let stopping = false;

  // Fail closed instead of letting Next load a developer's real service credentials.
  const envFiles = (await readdir(root)).filter((name) =>
    /^\.env(?:$|\.(?:local|development|production|test)(?:\.local)?$)/.test(name),
  );
  if (envFiles.length || existsSync(resolve(root, 'firebase-service-account.json'))) {
    throw new Error(
      'Run the waiver sandbox in a worktree without .env files or decrypted service-account credentials. Existing files are never modified.',
    );
  }
  await mkdir(localRoot, {recursive: true});
  const runDir = await mkdtemp(resolve(localRoot, 'run-'));
  const env: NodeJS.ProcessEnv = {NODE_ENV: 'development'};
  for (const key of ['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL', 'TERM']) {
    env[key] = process.env[key];
  }
  Object.assign(env, {
    NODE_ENV: 'development',
    CI: 'true',
    NEXT_TELEMETRY_DISABLED: '1',
    FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
    GOOGLE_PROJECT_ID: localProject,
    GCLOUD_PROJECT: localProject,
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: localProject,
    NEXT_PUBLIC_FIREBASE_API_KEY: 'local-test-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '127.0.0.1',
    NEXT_PUBLIC_AUTH_EMULATOR_URL: emulatorUrl,
    NEXT_PUBLIC_SITE_URL: appUrl,
    SITE_URL: appUrl,
    ADMIN_EMAIL: 'admin@example.test',
    NEXT_PUBLIC_ALLOWED_EMAIL: 'admin@example.test',
    NETLIFY_DATABASE_URL: LOCAL_TEST_DATABASE_URL,
    LOCAL_NEON_HTTP_URL: `${supportUrl}/sql`,
    RESEND_API_KEY: 're_local_waiver_test_only',
    RESEND_BASE_URL: supportUrl,
    EMAIL_FROM: 'Club Test <club@example.test>',
    STRIPE_SECRET_KEY: 'sk_test_local_waiver_test_only',
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_PRICE_INDIVIDUAL: 'price_local_individual',
    STRIPE_PRICE_FAMILY: 'price_local_family',
    LOCAL_STRIPE_API_URL: supportUrl,
    WAIVER_SIGNATURE_SECRET: 'local_waiver_signature_evidence_test_secret',
    QR_SIGNING_SECRET: 'local_membership_card_test_secret',
    RENEWAL_LINK_SECRET: 'local_renewal_link_test_secret_not_for_production',
    RATE_LIMIT_SECRET: 'local_rate_limit_test_secret_not_for_production',
  });

  function start(command: string, args: string[], name: string, cwd = root) {
    const child = spawn(command, args, {cwd, env, stdio: ['ignore', 'pipe', 'pipe']});
    const log = createWriteStream(resolve(runDir, `${name}.log`));
    child.stdout?.pipe(log);
    child.stderr?.pipe(log);
    child.on('error', (error) => console.error(`${name}:`, error.message));
    child.on('exit', (code) => {
      if (!stopping) {
        console.error(`${name} exited (${code}); inspect ${resolve(runDir, `${name}.log`)}`);
        process.exitCode = 1;
        void stop();
      }
    });
    children.push(child);
    return child;
  }

  async function waitFor(url: string) {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (stopping) throw new Error('Local startup interrupted');
      try {
        const result = await fetch(url, {signal: AbortSignal.timeout(1000)});
        if (result.ok) return;
      } catch {
        /* Service is still starting. */
      }
      await setTimeout(500);
    }
    throw new Error(`Timed out starting ${url}; inspect logs in ${runDir}`);
  }

  const pg = await PGlite.create(resolve(runDir, 'database'));
  await migrate(drizzle(pg), {migrationsFolder: resolve(root, 'drizzle')});
  const handler = createLocalProviders(pg);
  const server = createServer((request, response) => {
    handler(request, response).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Local provider error';
      console.error(message);
      if (!response.headersSent) json(response, {message}, 400);
      else response.end();
    });
  });
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(4311, '127.0.0.1', done);
  });

  async function stop() {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill('SIGINT');
    server.close();
    await pg.close();
  }
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());

  try {
    start(
      process.execPath,
      [
        require.resolve('firebase-tools/lib/bin/firebase.js'),
        'emulators:start',
        '--only',
        'auth',
        '--project',
        localProject,
        '--config',
        resolve(root, 'scripts/waiver-local/firebase.json'),
      ],
      'auth',
      runDir,
    );
    await waitFor(`${emulatorUrl}/emulator/v1/projects/${localProject}/config`);
    await seedLocalAccounts(pg);
    start(
      process.execPath,
      [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3000'],
      'website',
    );
    await waitFor(`${appUrl}/login`);
    console.log(
      `\nLOCAL WAIVER TEST READY\nWebsite: ${appUrl}\nTest accounts and captured email: ${supportUrl}\nLogs and isolated database: ${runDir}\nEach restart creates fresh test data; earlier runs are retained. Ctrl+C stops only these test services.\n`,
    );
  } catch (error) {
    await stop();
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
