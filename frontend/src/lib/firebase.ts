// Firebase login on phones. The phone remembers who is logged in between app launches.
// (firebase.web.ts is used instead in a browser.)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";

import { firebaseConfig } from "@/config";

// While developing, code reloads run this file again, and Firebase allows only one setup.
// So reuse what's already set up.
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function setUpAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
}

export const auth = setUpAuth();
