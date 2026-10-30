// App settings. None of these are secret: they ship inside the app.

// The backend. Set EXPO_PUBLIC_API_URL to use another one, like a backend on your computer.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://vagora-three.vercel.app";

// The Firebase project for development (vagora-dev). Production gets its own (decision 0012).
export const firebaseConfig = {
  apiKey: "AIzaSyBk3Dw7t_5WunJOcahchPXXuB7J9ImC-c4",
  authDomain: "vagora-dev.firebaseapp.com",
  projectId: "vagora-dev",
  storageBucket: "vagora-dev.firebasestorage.app",
  messagingSenderId: "335541715251",
  appId: "1:335541715251:web:fe4d123c788fb0acce7e46",
};
