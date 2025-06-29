'use client';

import { useEffect, useState, Suspense } from 'react'; // Added Suspense
import { getCurrentUser } from '@/utils/firebase'; // Assuming @ points to src
import { useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams
import type { User as FirebaseAuthUser } from 'firebase/auth'; // Type for Firebase Auth user
import { useUserProfileQuery, UserProfile } from '@/hooks/useUserQueries'; // Import the hook and type
import { loadStripe } from '@stripe/stripe-js/pure'; // Import Stripe.js loader

// Placeholder Price IDs - replace with your actual Stripe Price IDs
const INDIVIDUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_INDIVIDUAL_PRICE_ID || 'price_individual_placeholder';
const FAMILY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_FAMILY_PRICE_ID || 'price_family_placeholder';

// Initialize Stripe.js promise
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<any | null> | null = null;
if (stripePublishableKey) {
  stripePromise = loadStripe(stripePublishableKey);
} else {
  console.warn("Stripe publishable key not found. Payment functionality will be disabled.");
}


function ProfilePageContent() { // Extracted content into a new component for Suspense
  const router = useRouter();
  const searchParams = useSearchParams(); // For reading URL query params
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);


  useEffect(() => {
    const authUser = getCurrentUser();
    if (!authUser) {
      router.push('/login');
    } else {
      setFirebaseUser(authUser);
    }
  }, [router]);

  useEffect(() => {
    const paymentSuccess = searchParams.get('payment_success');
    const paymentCancelled = searchParams.get('payment_cancelled');

    if (paymentSuccess === 'true') { // Ensure it's a string comparison
      setPaymentMessage({type: 'success', text: "Payment successful! Your membership details will update shortly."});
      if (firebaseUser?.uid) { // Only refetch if UID is available (query would be enabled)
        refetchProfile();
      }
      // Optionally, remove query params from URL after processing
      // router.replace('/dashboard/profile', { scroll: false });
    }
    if (paymentCancelled === 'true') { // Ensure it's a string comparison
      setPaymentMessage({type: 'info', text: "Payment cancelled. You can try again anytime."});
      // router.replace('/dashboard/profile', { scroll: false });
    }
  }, [searchParams, router, refetchProfile, firebaseUser?.uid]); // Added refetchProfile and firebaseUser.uid

  // Use TanStack Query hook for data fetching
  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch: refetchProfile // To refetch profile after payment attempt
  } = useUserProfileQuery(firebaseUser?.uid);

  const handlePayment = async (priceId: string) => {
    if (!firebaseUser?.uid) {
      setPaymentMessage({type: 'error', text: "User not authenticated. Please log in again."});
      return;
    }
    if (!stripePromise) {
      setPaymentMessage({type: 'error', text: "Stripe is not configured. Payment cannot be processed."});
      console.error("Stripe Promise not available. Check publishable key.");
      return;
    }

    setIsProcessingPayment(true);
    setPaymentMessage(null);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, uid: firebaseUser.uid }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create checkout session.');
      }

      const { sessionId } = await response.json();
      if (!sessionId) {
        throw new Error('No session ID returned from server.');
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe.js failed to load.");
      }

      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });

      if (stripeError) {
        console.error("Stripe redirectToCheckout error:", stripeError);
        setPaymentMessage({type: 'error', text: stripeError.message || "Failed to redirect to Stripe. Please try again."});
      }
      // If redirectToCheckout is successful, the user is navigated away from the page.
      // They will be redirected to success_url or cancel_url.
    } catch (err: any) {
      console.error("Payment handling error:", err);
      setPaymentMessage({type: 'error', text: err.message || "An unexpected error occurred during payment."});
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) {
      return dateString; // Return original string if date is invalid
    }
  };

  // Render based on TanStack Query state
  if (isLoading && !firebaseUser) {
    // Still waiting for firebaseUser to be set, or initial load before query is enabled
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">User Profile</h1>
        <p>Authenticating...</p>
      </div>
    );
  }

  if (isLoading && firebaseUser) { // Query is enabled and loading
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">User Profile</h1>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">User Profile</h1>
        <p className="text-red-500">Error fetching profile: {error?.message || 'An unknown error occurred.'}</p>
      </div>
    );
  }

  // Display payment messages
  const renderPaymentMessage = () => {
    if (!paymentMessage) return null;
    const baseClasses = "p-4 rounded-md my-4 text-sm";
    const styles = {
      success: "bg-green-100 border border-green-400 text-green-700",
      error: "bg-red-100 border border-red-400 text-red-700",
      info: "bg-blue-100 border border-blue-400 text-blue-700",
    };
    return <div className={`${baseClasses} ${styles[paymentMessage.type]}`}>{paymentMessage.text}</div>;
  };

  if (!profile && firebaseUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">User Profile</h1>
        {renderPaymentMessage()}
        <p>No profile data available. This could be because your profile is still being created or an issue occurred. Try refreshing in a moment.</p>
        <button
            onClick={() => refetchProfile()}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={isLoading}
        >
            {isLoading ? 'Refreshing...' : 'Refresh Profile'}
        </button>
      </div>
    );
  }

  if (!profile) { // Should not be reached if firebaseUser is set and no error/loading
      return (
          <div className="container mx-auto px-4 py-8">
              <h1 className="text-2xl font-semibold mb-4">User Profile</h1>
              <p>Loading...</p>
          </div>
      )
  }


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">User Profile</h1>
      {renderPaymentMessage()}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-4">
          <strong className="text-gray-700">Email:</strong>
          <span className="ml-2 text-gray-900">{profile.email}</span>
        </div>
        <div className="mb-4">
          <strong className="text-gray-700">Display Name:</strong>
          <span className="ml-2 text-gray-900">{profile.displayName || 'N/A'}</span>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Membership Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <strong className="text-gray-700">Status:</strong>
            <span className="ml-2 text-gray-900 capitalize">{profile.membership.status}</span>
          </div>
          <div>
            <strong className="text-gray-700">Tier:</strong>
            <span className="ml-2 text-gray-900 capitalize">{profile.membership.tier || 'N/A'}</span>
          </div>
          <div>
            <strong className="text-gray-700">Start Date:</strong>
            <span className="ml-2 text-gray-900">{formatDate(profile.membership.startDate)}</span>
          </div>
          <div>
            <strong className="text-gray-700">End Date:</strong>
            <span className="ml-2 text-gray-900">{formatDate(profile.membership.endDate)}</span>
          </div>
        </div>

        {profile.membership.status !== 'active' && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              Become a Member or Renew Your Membership
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Support cyclist advocacy and enjoy member benefits!
            </p>
            <div className="space-y-3 sm:space-y-0 sm:flex sm:space-x-3">
              <button
                onClick={() => handlePayment(INDIVIDUAL_PRICE_ID)}
                disabled={isProcessingPayment || !stripePromise}
                className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition ease-in-out duration-150"
              >
                {isProcessingPayment ? 'Processing...' : 'Join as Individual ($30/year)'}
              </button>
              <button
                onClick={() => handlePayment(FAMILY_PRICE_ID)}
                disabled={isProcessingPayment || !stripePromise}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition ease-in-out duration-150"
              >
                {isProcessingPayment ? 'Processing...' : 'Join as Family ($50/year)'}
              </button>
            </div>
            {!stripePromise && <p className="text-xs text-red-500 mt-2">Stripe payments are currently unavailable. Please check your configuration.</p>}
          </div>
        )}
         {profile.membership.status === 'active' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-700 font-semibold">You are currently an active member. Thank you for your support!</p>
                <p className="text-sm text-green-600 mt-1">Your current membership tier is: <span className="font-medium capitalize">{profile.membership.tier}</span>.</p>
                {profile.membership.endDate && <p className="text-sm text-green-600">Your membership is valid until: {formatDate(profile.membership.endDate)}.</p>}
            </div>
        )}
      </div>
    </div>
  );
}

// Wrap ProfilePageContent with Suspense for useSearchParams
export default function ProfilePage() {
  return (
    <Suspense fallback={<div>Loading page details...</div>}>
      <ProfilePageContent />
    </Suspense>
  );
}
