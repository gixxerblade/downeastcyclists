import {getFirestoreClient} from '@/src/lib/firestore-client';

/**
 * Verify what documents exist in Firestore
 */

async function verifyFirestore() {
  console.log('Connecting to Firestore...\n');
  const db = getFirestoreClient();

  // Check project ID
  const projectId = (db as any).projectId || process.env.GOOGLE_PROJECT_ID || 'unknown';
  console.log(`Project ID: ${projectId}\n`);

  // List all users
  console.log('=== USERS COLLECTION ===');
  const usersSnapshot = await db.collection('users').get();
  console.log(`Total users: ${usersSnapshot.size}`);

  if (usersSnapshot.empty) {
    console.log('No users found!');
  } else {
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`\nUser ID: ${doc.id}`);
      console.log(`  Email: ${data.email}`);
      console.log(`  Stripe Customer: ${data.stripeCustomerId}`);
      console.log(`  Created: ${data.createdAt?.toDate?.()?.toISOString() || 'N/A'}`);
    });
  }

  // Check for memberships under each user
  console.log('\n\n=== MEMBERSHIPS ===');
  for (const userDoc of usersSnapshot.docs) {
    const membershipsSnapshot = await db
      .collection('users')
      .doc(userDoc.id)
      .collection('memberships')
      .get();

    if (!membershipsSnapshot.empty) {
      console.log(`\nMemberships for user ${userDoc.id}:`);
      membershipsSnapshot.forEach((membershipDoc) => {
        const data = membershipDoc.data();
        console.log(`  Membership ID: ${membershipDoc.id}`);
        console.log(`    Plan: ${data.planType}`);
        console.log(`    Status: ${data.status}`);
        console.log(`    End Date: ${data.endDate?.toDate?.()?.toISOString() || 'N/A'}`);
      });
    }
  }

  if (usersSnapshot.empty) {
    console.log('\nNo memberships found (no users exist).');
  }
}

verifyFirestore()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
