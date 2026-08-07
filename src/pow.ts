const BASE =
  (import.meta as any).env?.VITE_API_ORIGIN ||
  (typeof location !== "undefined" ? location.origin : "");

const STORE = "w1c_pow_key";
const STORE_EXP = "w1c_pow_exp";

export function loadSessionKey(): string {
  try {
    const exp = Number(localStorage.getItem(STORE_EXP) || "0");
    if (exp && Date.now() / 1000 > exp - 60) {
      localStorage.removeItem(STORE);
      localStorage.removeItem(STORE_EXP);
      return "";
    }
    return localStorage.getItem(STORE) || "";
  } catch {
    return "";
  }
}

export function saveSessionKey(key: string, exp?: number) {
  localStorage.setItem(STORE, key);
  if (exp) localStorage.setItem(STORE_EXP, String(exp));
}

export function resetSessionKey() {
  localStorage.removeItem(STORE);
  localStorage.removeItem(STORE_EXP);
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i++) s += u[i].toString(16).padStart(2, "0");
  return s;
}

async function solve(challenge: string, salt: string, difficulty: number): Promise<string> {
  const prefix = "0".repeat(Math.min(Math.max(difficulty, 1), 6));
  let nonce = 0;
  const batch = 64;
  for (;;) {
    for (let i = 0; i < batch; i++) {
      const h = await sha256Hex(`${challenge}:${salt}:${nonce}`);
      if (h.startsWith(prefix)) return String(nonce);
      nonce++;
    }
    await new Promise((r) => setTimeout(r, 0));
  }
}

export async function ensureSessionKey(deviceId: string): Promise<string> {
  const existing = loadSessionKey();
  if (existing.startsWith("shs_")) return existing;

  const chRes = await fetch(`${BASE}/api/Pow_challenge`, { credentials: "same-origin" });
  if (!chRes.ok) {
    const t = await chRes.text();
    throw new Error(`Challenge gagal (${chRes.status}): ${t.slice(0, 80)}`);
  }
  const ch = await chRes.json();
  if (!ch.challenge || !ch.token) throw new Error(ch.error || "pow challenge gagal");

  const diff = Math.min(Number(ch.difficulty || 4), 5);
  const nonce = await solve(ch.challenge, ch.salt || "", diff);

  const keyRes = await fetch(`${BASE}/api/createKey`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: ch.token, nonce, device_id: deviceId }),
  });
  const data = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok || !data.api_key) {
    throw new Error(data.error || `createKey gagal (${keyRes.status})`);
  }
  saveSessionKey(data.api_key, data.expires_at);
  return data.api_key as string;
}
