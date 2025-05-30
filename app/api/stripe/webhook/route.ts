import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/firebaseAdmin'; // Firestore admin instance
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// Initialize Stripe with the secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("Stripe secret key not found. Make sure STRIPE_SECRET_KEY is set.");
}
const stripe = new Stripe(stripeSecretKey!, {
  apiVersion: '2023-10-16', // Match the version used elsewhere or use latest
  typescript: true,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error("Stripe webhook secret not found. Make sure STRIPE_WEBHOOK_SECRET is set.");
}

// Price ID environment variables (ensure these are set in your .env)
const STRIPE_PRICE_ID_INDIVIDUAL = process.env.STRIPE_PRICE_ID_INDIVIDUAL;
const STRIPE_PRICE_ID_FAMILY = process.env.STRIPE_PRICE_ID_FAMILY;

export async function POST(request: NextRequest) {
  const rawBody = await request.text(); // Standard way to get raw body in App Router
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error("Stripe webhook error: Missing stripe-signature header");
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret!);
  } catch (err: any) {
    console.error(`Stripe webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Processing checkout.session.completed event for session ID:', session.id);

      const firebaseUID = session.metadata?.firebaseUID;
      const selectedPriceId = session.metadata?.selectedPriceId;

      if (!firebaseUID) {
        console.error('Webhook error: firebaseUID missing from session metadata. Session ID:', session.id);
        // Return 200 to Stripe to prevent retries for this type of "bad" data from our side.
        // If this was a critical error that Stripe should retry, return 4xx or 5xx.
        return NextResponse.json({ error: 'firebaseUID missing from metadata.' }, { status: 200 });
      }
      if (!selectedPriceId) {
        console.error('Webhook error: selectedPriceId missing from session metadata. Session ID:', session.id);
        return NextResponse.json({ error: 'selectedPriceId missing from metadata.' }, { status: 200 });
      }

      let tierName = '';
      if (selectedPriceId === STRIPE_PRICE_ID_INDIVIDUAL) {
        tierName = 'individual';
      } else if (selectedPriceId === STRIPE_PRICE_ID_FAMILY) {
        tierName = 'family';
      } else {
        console.error(`Webhook error: Unknown selectedPriceId '${selectedPriceId}' in session metadata. Session ID: ${session.id}`);
        // Return 200 as this is likely a configuration issue on our side (e.g. new price ID not added to env vars)
        // Stripe should not retry this indefinitely.
        return NextResponse.json({ error: `Unknown price ID: ${selectedPriceId}` }, { status: 200 });
      }

      const startDate = Timestamp.now();
      const endDate = new Timestamp(startDate.seconds + (365 * 24 * 60 * 60), startDate.nanoseconds); // Approx 1 year

      const userRef = db.collection('users').doc(firebaseUID);

      try {
        const paymentRecord = {
          paymentId: session.payment_intent?.toString() || session.id, // payment_intent is preferred
          date: startDate,
          amount: session.amount_total ? session.amount_total / 100 : 0, // Stripe amounts are in cents
          tierCharged: tierName,
          membershipPeriod: { start: startDate, end: endDate },
          stripeCustomerId: session.customer?.toString() || null, // Store Stripe Customer ID
          checkoutSessionId: session.id, // Store Checkout Session ID for reference
        };

        await userRef.set({
          membership: {
            status: 'active',
            tier: tierName,
            startDate: startDate,
            endDate: endDate,
            lastPaymentDate: startDate, // Add last payment date
            stripePriceId: selectedPriceId, // Store the price ID that granted membership
            stripeCustomerId: session.customer?.toString() || null,
          },
          paymentHistory: FieldValue.arrayUnion(paymentRecord),
        }, { merge: true }); // Use merge:true to avoid overwriting other user fields

        console.log(`Successfully updated membership for user ${firebaseUID} to tier ${tierName}.`);
      } catch (dbError: any) {
        console.error(`Firestore update error for user ${firebaseUID} after session ${session.id}: ${dbError.message}`);
        // Return 500 to signal to Stripe that it should retry this webhook
        return NextResponse.json({ error: 'Database update failed.', details: dbError.message }, { status: 500 });
      }
      break;

    // Example: Handle subscription updates (e.g., renewals, cancellations from Stripe Billing Portal)
    case 'customer.subscription.updated':
      const subscriptionUpdated = event.data.object as Stripe.Subscription;
      // Logic to update membership status, endDate, etc., based on subscription status
      // (e.g., if subscriptionUpdated.status is 'active', 'canceled', 'past_due')
      // You'd need to map subscriptionUpdated.customer (Stripe Customer ID) back to your firebaseUID
      // This often involves storing the Stripe Customer ID in your user's Firestore document.
      console.log(`Received customer.subscription.updated event for subscription ID: ${subscriptionUpdated.id}, Status: ${subscriptionUpdated.status}`);
      // Add your detailed handling logic here
      break;

    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object as Stripe.Subscription;
      // Logic to handle when a subscription is canceled (e.g., set membership to 'canceled' or 'expired' at period end)
      console.log(`Received customer.subscription.deleted event for subscription ID: ${subscriptionDeleted.id}`);
      // Add your detailed handling logic here
      break;

    // Add other event types you want to handle (e.g., 'invoice.payment_failed', 'invoice.paid')

    default:
      console.log(`Received unhandled Stripe event type: ${event.type}`);
  }

  // Acknowledge receipt of the event to Stripe
  return NextResponse.json({ received: true }, { status: 200 });
}
