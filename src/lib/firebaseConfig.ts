/**
 * Optional Firestore pull sync — same Firebase project as Chinotto mobile.
 * Env names mirror mobile (`EXPO_PUBLIC_*` there → `VITE_*` here). See docs/SYNC.md.
 */
export function isFirebaseSyncConfigured(): boolean {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  return Boolean(apiKey && projectId);
}

export function getFirebaseWebOptions() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY!.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID!.trim();
  const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  /* Firebase Auth redirect loads https://{authDomain}/__/auth/handler; omitting env must still send a valid domain (createAuthUri 400 otherwise). */
  const authDomain = envAuthDomain || `${projectId}.firebaseapp.com`;
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  };
}
