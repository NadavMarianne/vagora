// Talking to the backend. Every request carries the Firebase login token.
import { API_URL } from "@/config";
import { auth } from "@/lib/firebase";

/** The backend said no. `status` is the HTTP code, `message` its explanation. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function explain(detail: unknown): string {
  if (typeof detail === "string") return detail;
  // Validation errors come as a list; show the first one.
  if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === "string") {
    return detail[0].msg;
  }
  return "Something went wrong.";
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const token = await auth.currentUser?.getIdToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "Can't reach vagora. Check your internet connection.");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, explain(data?.detail));
  return data as T;
}

/** Wakes the backend and the database while the app starts, so the first screen loads fast. */
export function warmUp() {
  fetch(`${API_URL}/health`).catch(() => {});
}
