import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with the secret key and API version
// Ensure STRIPE_SECRET_KEY is set in your environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("Stripe secret key not found. Make sure STRIPE_SECRET_KEY is set in your environment variables.");
  // In a real application, you might want to throw an error or handle this more gracefully
  // For now, this will cause Stripe initialization to fail if the key is missing.
}
const stripe = new Stripe(stripeSecretKey!, {
  apiVersion: '2023-10-16', // Use the API version specified in the prompt or a newer stable one
  typescript: true, // Enable TypeScript support if using a version that supports it
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { priceId, uid } = body;

    if (!priceId || !uid) {
      return NextResponse.json({ error: 'priceId and uid are required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
        console.error("NEXT_PUBLIC_BASE_URL is not set. This is required for success and cancel URLs.");
        return NextResponse.json({ error: 'Application base URL is not configured.' }, { status: 500 });
    }

    const success_url = `${baseUrl}/dashboard/profile?payment_success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${baseUrl}/dashboard/profile?payment_cancelled=true`;

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', // Assuming memberships are subscriptions
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: { // Pass custom data to access in webhooks or after session completion
        firebaseUID: uid,
        selectedPriceId: priceId,
      },
      // If you want to pre-fill customer email or link to an existing Stripe Customer:
      // customer_email: userEmail, // (You'd need to fetch this based on UID or pass it from client)
      // client_reference_id: uid, // Useful for reconciliation if you're not creating Stripe Customer objects explicitly yet
    });

    if (session.id) {
      return NextResponse.json({ sessionId: session.id }, { status: 200 });
    } else {
      // This case should ideally not be reached if session creation was successful without error
      console.error("Stripe session created but no ID was returned.", session);
      return NextResponse.json({ error: 'Failed to create Stripe session: No session ID returned' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error creating Stripe Checkout session:', error);
    // Handle specific Stripe errors if needed, e.g., error.type
    if (error instanceof Stripe.errors.StripeError) {
        return NextResponse.json({ error: `Stripe error: ${error.message}` }, { status: error.statusCode || 500 });
    } else if (error instanceof SyntaxError) { // JSON parsing error
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error creating checkout session' }, { status: 500 });
  }
}
