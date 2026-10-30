// Firebase's login errors in plain words.
import { FirebaseError } from "firebase/app";

const messages: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-password": "Enter your password.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/email-already-in-use": "There's already an account with this email. Try logging in.",
  "auth/password-does-not-meet-requirements":
    "Your password needs at least 8 characters, with a number, a capital letter, " +
    "and a special character (like ! or #).",
  "auth/weak-password": "That password is too weak.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
  "auth/network-request-failed": "Can't connect. Check your internet connection.",
};

export function explainAuthError(error: unknown): string {
  if (error instanceof FirebaseError) return messages[error.code] ?? error.message;
  return "Something went wrong. Try again.";
}
