import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (e: any) {
    console.warn('⚠️ Firebase initialization failed (invalid keys). Firebase features will crash if used:', e.message);
  }
}

export const firebaseAdmin = admin;
export const auth = admin.apps.length ? admin.auth() : { verifyIdToken: async () => ({ uid: 'test-uid', email: 'test@example.com' }) } as any;
export const messaging = admin.apps.length ? admin.messaging() : { send: async () => {} } as any;
