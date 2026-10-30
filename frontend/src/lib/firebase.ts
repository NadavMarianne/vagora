// Firebase login on phones. The phone remembers who is logged in between app launches.
// (firebase.web.ts is used instead in a browser.)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";

import { firebaseConfig } from "@/config";

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
