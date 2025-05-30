import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.');
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    // Depending on the application's needs, you might want to throw the error,
    // or handle it in a way that allows the app to run with limited functionality.
    // For this example, we'll log it and let the app continue,
    // but operations requiring Firebase Admin will fail.
  }
}

export const db = admin.firestore();
export const authAdmin = admin.auth(); // If needed for other admin tasks
export default admin;
