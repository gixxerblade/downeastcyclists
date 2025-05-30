// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, User, createUserWithEmailAndPassword, getIdToken } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ''
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (user) {
      const idToken = await getIdToken(user);
      try {
        await fetch('/api/auth/set-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: idToken }),
        });
        // console.log('ID token cookie set successfully');
      } catch (cookieError) {
        console.error('Error setting ID token cookie:', cookieError);
        // Depending on policy, you might want to throw an error here or sign the user out
      }
    }
    return user;
  } catch (error: any) {
    console.error('Error signing in:', error.message);
    throw error;
  }
};

// Sign up with email and password
export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (user) {
      const { uid, email: userEmail, displayName } = user;

      // After successful Firebase Auth user creation, create user profile in Firestore
      try {
        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uid,
            email: userEmail,
            displayName: displayName || null
          }),
        });

        if (!response.ok) { // Check if response status is not 2xx
          const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
          // Log the detailed error from the API if available
          console.error('Error creating user profile:', response.status, errorData);
          // Potentially delete the auth user here if profile creation is critical
          // await user.delete(); // This would require careful error handling
          throw new Error(`Failed to create user profile (status ${response.status}). ${errorData.error || 'Unknown error'}`);
        }
        // Profile creation successful
      } catch (profileError: any) {
        console.error('Error during profile creation call:', profileError);
        // Also consider deleting the auth user here
        // For now, re-throw the error to signal failure
        throw new Error(`User profile creation failed: ${profileError.message}`);
      }
    }

    return user;
  } catch (error: any) {
    // Catch errors from createUserWithEmailAndPassword or the profile creation steps
    console.error('Error signing up:', error.message);
    throw error;
  }
};

// Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    // Attempt to clear the cookie first
    await fetch('/api/auth/clear-token', {
      method: 'POST', // Or GET, depending on your API route implementation
    });
    // console.log('ID token cookie cleared successfully');
  } catch (cookieError) {
    console.error('Error clearing ID token cookie:', cookieError);
    // Proceed with Firebase sign out even if cookie clearing fails client-side
  }

  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Error signing out from Firebase:', error.message);
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Export auth for use in other files
export { auth };
