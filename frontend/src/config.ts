// App settings. None of these are secret: they ship inside the app.
import * as Updates from "expo-updates";

// Which setup the app talks to. The production APK is built on the "production" update channel
// (see eas.json), and the channel stays with it through every over-the-air update.
// Expo Go has no channel, so it uses development (decision 0028).
const production = Updates.channel === "production";

// The backend. Set EXPO_PUBLIC_API_URL to use another one, like a pull request's preview.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (production ? "https://vagora-api-prod.vercel.app" : "https://vagora-three.vercel.app");

// The Firebase projects: vagora-dev for development, vagora-prod for the real app.
export const firebaseConfig = production
  ? {
      apiKey: "AIzaSyBAf3vMR75PnXlMG3ApJ9m5PjxD7grP3WM",
      authDomain: "vagora-prod.firebaseapp.com",
      projectId: "vagora-prod",
      storageBucket: "vagora-prod.firebasestorage.app",
      messagingSenderId: "395409658999",
      appId: "1:395409658999:web:a9bd9c391c44028d10a272",
    }
  : {
      apiKey: "AIzaSyBk3Dw7t_5WunJOcahchPXXuB7J9ImC-c4",
      authDomain: "vagora-dev.firebaseapp.com",
      projectId: "vagora-dev",
      storageBucket: "vagora-dev.firebasestorage.app",
      messagingSenderId: "335541715251",
      appId: "1:335541715251:web:fe4d123c788fb0acce7e46",
    };
