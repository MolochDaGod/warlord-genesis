// Puter.js wrapper — free, user-pays, serverless AI. Loaded via a script tag in
// index.html. The first AI call triggers a Puter sign-in popup; usage is billed
// to the end user's Puter account, not the developer.

export interface PuterChatOptions {
  model?: string;
  stream?: boolean;
}

interface PuterChatMessagePart {
  text?: string;
}

interface PuterChatResponse {
  message?: { content?: string | PuterChatMessagePart[] };
  toString?: () => string;
}

interface PuterAI {
  chat: (
    prompt: string,
    options?: PuterChatOptions,
  ) => Promise<PuterChatResponse | AsyncIterable<PuterChatMessagePart>>;
}

interface PuterAuth {
  isSignedIn: () => boolean;
  signIn: () => Promise<unknown>;
  getUser: () => Promise<{ username?: string }>;
}

interface Puter {
  ai: PuterAI;
  auth: PuterAuth;
  // The current user's Puter session token, used as a Bearer credential for
  // Puter API calls. Present once signed in.
  authToken?: string;
}

declare global {
  interface Window {
    puter?: Puter;
  }
}

export const DEFAULT_MODEL = "gpt-4o-mini";

export function isPuterReady(): boolean {
  return typeof window !== "undefined" && !!window.puter;
}

async function waitForPuter(timeoutMs = 8000): Promise<Puter> {
  const start = Date.now();
  while (!isPuterReady()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        "Puter.js failed to load. Check your network connection and reload.",
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return window.puter!;
}

function extractText(resp: PuterChatResponse): string {
  const content = resp.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((p) => p.text ?? "").join("");
  }
  if (typeof resp.toString === "function") {
    const s = resp.toString();
    if (s && s !== "[object Object]") return s;
  }
  return "";
}

// Streaming chat. Calls onChunk with incremental text; resolves with the full
// text. Falls back to a single response if the model does not stream.
export async function chatStream(
  prompt: string,
  onChunk: (text: string) => void,
  options: PuterChatOptions = {},
): Promise<string> {
  const puter = await waitForPuter();
  const model = options.model ?? DEFAULT_MODEL;
  const result = await puter.ai.chat(prompt, { model, stream: true });

  if (result && typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    let full = "";
    for await (const part of result as AsyncIterable<PuterChatMessagePart>) {
      const text = part?.text ?? "";
      if (text) {
        full += text;
        onChunk(text);
      }
    }
    return full;
  }

  const text = extractText(result as PuterChatResponse);
  if (text) onChunk(text);
  return text;
}

export async function ensureSignedIn(): Promise<string | null> {
  const puter = await waitForPuter();
  try {
    if (!puter.auth.isSignedIn()) await puter.auth.signIn();
    const user = await puter.auth.getUser();
    return user?.username ?? null;
  } catch {
    return null;
  }
}

// Ensure the user is signed in to Puter and return the session token. The token
// is verified server-side (Puter `/whoami`) before any account is created, so
// the client never self-asserts its identity. Returns null if sign-in fails or
// is cancelled.
export async function getPuterToken(): Promise<string | null> {
  const puter = await waitForPuter();
  try {
    if (!puter.auth.isSignedIn()) await puter.auth.signIn();
    if (puter.authToken) return puter.authToken;
    const stored = localStorage.getItem("puter.auth.token");
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}
