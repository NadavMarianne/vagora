// Firebase login in a browser. The browser remembers who is logged in.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { firebaseConfig } from "@/config";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
