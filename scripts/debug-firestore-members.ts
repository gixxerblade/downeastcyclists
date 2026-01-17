/**
 * Debug script to inspect Firestore membership data
 * Run with: npx tsx scripts/debug-firestore-members.ts
 */

import { Firestore } from "@google-cloud/firestore";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const db = new Firestore({
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.split("\\n").join("\n"),
  },
});

async function debugFirestoreMembers() {
  console.log("🔍 Debugging Firestore Membership Data\n");
  console.log("=" .repeat(60));

  // 1. Check all users
  console.log("\n1️⃣  Checking users collection...");
  const usersSnapshot = await db.collection("users").get();
  console.log(`   Found ${usersSnapshot.size} user document(s)\n`);

  if (usersSnapshot.empty) {
    console.log("   ❌ No users found in Firestore!");
    console.log("   💡 This means no members have been created yet.");
    return;
  }

  // 2. Check each user's memberships
  console.log("\n2️⃣  Checking memberships for each user...\n");
  let totalMemberships = 0;
  let activeCount = 0;
  let canceledCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    console.log(`   User: ${userDoc.id}`);
    console.log(`   └─ Email: ${userData.email || "N/A"}`);
    console.log(`   └─ Name: ${userData.name || "N/A"}`);
    console.log(`   └─ Stripe Customer: ${userData.stripeCustomerId || "N/A"}`);

    // Check memberships subcollection
    const membershipsSnapshot = await db
      .collection("users")
      .doc(userDoc.id)
      .collection("memberships")
      .get();

    if (membershipsSnapshot.empty) {
      console.log(`   └─ ⚠️  No memberships found for this user\n`);
    } else {
      console.log(`   └─ Memberships: ${membershipsSnapshot.size}\n`);

      membershipsSnapshot.docs.forEach((membershipDoc, index) => {
        const membership = membershipDoc.data();
        totalMemberships++;

        if (membership.status === "active" || membership.status === "trialing") {
          activeCount++;
        }
        if (membership.status === "canceled") {
          canceledCount++;
        }

        console.log(`      ${index + 1}. Membership ID: ${membershipDoc.id}`);
        console.log(`         ├─ Status: ${membership.status || "N/A"}`);
        console.log(`         ├─ Plan Type: ${membership.planType || "N/A"}`);
        console.log(
          `         ├─ Start Date: ${membership.startDate?.toDate?.() || membership.startDate || "N/A"}`
        );
        console.log(
          `         ├─ End Date: ${membership.endDate?.toDate?.() || membership.endDate || "N/A"}`
        );
        console.log(
          `         ├─ Stripe Subscription: ${membership.stripeSubscriptionId || "N/A"}`
        );
        console.log(
          `         └─ Stripe Price: ${membership.stripePriceId || "N/A"}\n`
        );
      });
    }

    // Check membership cards
    const cardDoc = await db
      .collection("users")
      .doc(userDoc.id)
      .collection("cards")
      .doc("current")
      .get();

    if (cardDoc.exists) {
      const card = cardDoc.data()!;
      console.log(`   └─ Digital Card:`);
      console.log(`      ├─ Membership Number: ${card.membershipNumber || "N/A"}`);
      console.log(`      └─ QR Code: ${card.qrCodeUrl ? "Generated" : "Missing"}\n`);
    } else {
      console.log(`   └─ ⚠️  No digital card found\n`);
    }

    console.log("   " + "-".repeat(56) + "\n");
  }

  // 3. Check stats document
  console.log("\n3️⃣  Checking stats document...");
  const statsDoc = await db.collection("stats").doc("memberships").get();

  if (!statsDoc.exists) {
    console.log("   ❌ Stats document does NOT exist");
    console.log("   💡 Run 'Refresh Stats' in admin dashboard to create it");
  } else {
    const stats = statsDoc.data()!;
    console.log("   ✅ Stats document exists:");
    console.log(`   ├─ Total Members: ${stats.totalMembers || 0}`);
    console.log(`   ├─ Active Members: ${stats.activeMembers || 0}`);
    console.log(`   ├─ Expired Members: ${stats.expiredMembers || 0}`);
    console.log(`   ├─ Canceled Members: ${stats.canceledMembers || 0}`);
    console.log(`   ├─ Individual Count: ${stats.individualCount || 0}`);
    console.log(`   ├─ Family Count: ${stats.familyCount || 0}`);
    console.log(`   └─ Last Updated: ${stats.updatedAt || "N/A"}`);
  }

  // 4. Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Users: ${usersSnapshot.size}`);
  console.log(`Total Memberships: ${totalMemberships}`);
  console.log(`Active Memberships: ${activeCount}`);
  console.log(`Canceled Memberships: ${canceledCount}`);
  console.log(`Stats Document: ${statsDoc.exists ? "✅ Exists" : "❌ Missing"}`);

  if (totalMemberships === 0) {
    console.log("\n❌ ISSUE: No memberships found!");
    console.log("   This means:");
    console.log("   1. No subscriptions have been created via Stripe checkout");
    console.log("   2. OR webhook hasn't fired to create membership documents");
    console.log("   3. OR membership data is in a different location");
  } else if (!statsDoc.exists) {
    console.log("\n⚠️  ISSUE: Stats document missing!");
    console.log(
      "   Solution: Click 'Refresh Stats' button in Membership Management tab"
    );
    console.log("   Or run: POST /api/admin/stats");
  } else if (statsDoc.exists && statsDoc.data()!.totalMembers !== totalMemberships) {
    const statsData = statsDoc.data()!;
    console.log("\n⚠️  ISSUE: Stats are out of sync!");
    console.log(
      `   Stats shows ${statsData.totalMembers} but found ${totalMemberships} actual memberships`
    );
    console.log("   Solution: Click 'Refresh Stats' to recalculate");
  } else {
    console.log("\n✅ Everything looks good!");
    console.log("   If admin dashboard still shows 0, check:");
    console.log("   1. Browser console for API errors");
    console.log("   2. Authentication (are you logged in as admin?)");
    console.log("   3. Session cookie is valid");
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

debugFirestoreMembers()
  .then(() => {
    console.log("✅ Debug complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
