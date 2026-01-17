/**
 * Script to set admin custom claim for a Firebase user
 *
 * Usage:
 *   pnpm tsx scripts/set-admin-claim.ts <email>
 *
 * Example:
 *   pnpm tsx scripts/set-admin-claim.ts admin@example.com
 */

import {resolve} from 'path';

// Load environment variables from .env.local
import {config} from 'dotenv';

config({path: resolve(__dirname, '../.env.local')});

import {Effect} from 'effect';

import {initializeFirebaseAdmin} from '../src/lib/firebase-admin';

const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Please provide an email address');
  console.log('Usage: pnpm tsx scripts/set-admin-claim.ts <email>');
  process.exit(1);
}

const program = Effect.gen(function* () {
  console.log(`🔍 Looking up user: ${email}`);

  const auth = yield* initializeFirebaseAdmin();

  // Get user by email
  const user = yield* Effect.tryPromise({
    try: () => auth.getUserByEmail(email),
    catch: (error) => {
      console.error(`❌ Failed to find user with email: ${email}`);
      return new Error(`User not found: ${error}`);
    },
  });

  console.log(`✅ Found user: ${user.uid}`);
  console.log(`📝 Setting admin claim...`);

  // Set admin custom claim
  yield* Effect.tryPromise({
    try: () => auth.setCustomUserClaims(user.uid, {admin: true}),
    catch: (error) => {
      console.error(`❌ Failed to set custom claims`);
      return new Error(`Failed to set claims: ${error}`);
    },
  });

  console.log(`✅ Admin claim set successfully!`);
  console.log(
    `\n⚠️  Important: The user needs to sign out and sign back in for the claim to take effect.`,
  );
  console.log(`   You can verify the claim with: pnpm tsx scripts/verify-admin-claim.ts ${email}`);
});

Effect.runPromise(program).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
