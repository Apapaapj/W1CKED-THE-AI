import { ensureSessionKey, loadSessionKey } from "./pow";

export type SearchResult = {
  url?: string;
  title?: string;
  snippet?: string;
  cite_index?: number;
  site_name?: string;
  site_icon?: string;
};

export type StreamChunk = {
  session?: string;
  parent_message_id?: number | null;
  thinking?: string;
  content?: string;
  reply?: string;
  error?: string;
  done?: boolean;
  search?: boolean;
  results?: SearchResult[];
  queries?: string[];
};

const API =
  (import.meta as any).env?.VITE_API_URL ||
  (typeof location !== "undefined" ? `${location.origin}/api/chat` : "/api/chat");

export const ALLOWED_EXT = [
  "pdf", "txt", "md", "csv", "json", "xml", "html", "htm", "css", "js", "ts", "tsx", "jsx",
  "py", "java", "c", "cpp", "h", "go", "rs", "rb", "php", "sql", "yaml", "yml", "toml",
  "log", "ini", "cfg", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf",
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
];

export function isAllowedFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ALLOWED_EXT.includes(ext);
}

function deviceId(): string {
  const k = "w1c_did";
  let id = localStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(k, id);
  }
  return id;
}

function getDsToken(): string {
  try {
    const raw = localStorage.getItem("w1c_ds_auth");
    if (!raw) return "";
    const d = JSON.parse(raw);
    return d?.token || "";
  } catch {
    return "";
  }
}

let cachedKey = "";

async function headers(json = true): Promise<Record<string, string>> {
  if (!cachedKey) {
    cachedKey = loadSessionKey();
    if (!cachedKey) cachedKey = await ensureSessionKey(deviceId());
  }
  const h: Record<string, string> = {
    "X-Api-Key": cachedKey,
    "X-Device-Id": deviceId(),
    "X-App-Version": "1.0.0",
    "X-Client-Platform": "web",
    "X-Client-Locale": "id_ID",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function readJson(r: Response): Promise<any> {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Server error (HTTP ${r.status}): ${text.slice(0, 160).replace(/\s+/g, " ")}`
    );
  }
}

export async function createSession(): Promise<string> {
  const r = await fetch(API, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ action: "create_session" }),
  });
  const d = await readJson(r);
  if (!d.session) throw new Error(d.error || "no session");
  return d.session;
}

export async function uploadFile(
  session: string,
  filename: string,
  file: Blob
): Promise<string> {
  const url = `${API}?session=${encodeURIComponent(session)}&filename=${encodeURIComponent(filename)}`;
  let r: Response;
  try {
    r = await fetch(url, {
      method: "PUT",
      headers: {
        ...(await headers(false)),
        "Content-Type": "application/octet-stream",
      },
      body: file,
    });
  } catch (e: any) {
    throw new Error("Gagal fetch upload: " + (e.message || "network"));
  }
  const d = await readJson(r);
  if (!d.file_id) throw new Error(d.error || "upload gagal");
  return d.file_id as string;
}

export async function* chatStream(opts: {
  message: string;
  session: string;
  parentMessageId: number | null;
  fileIds?: string[];
  thinking?: boolean;
  search?: boolean;
}): AsyncGenerator<StreamChunk> {
  const r = await fetch(API, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      message: opts.message,
      stream: true,
      thinking: !!opts.thinking,
      search: !!opts.search,
      session: opts.session,
      parent_message_id: opts.parentMessageId,
      file_ids: opts.fileIds || [],
    }),
  });

  const ct = r.headers.get("content-type") || "";
  if (!r.ok || !r.body || !ct.includes("text/event-stream")) {
    const t = await r.text();
    let msg = t.slice(0, 200);
    try {
      const j = JSON.parse(t);
      msg = j.error || j.message || msg;
    } catch {}
    yield { error: `http ${r.status}: ${msg}` };
    return;
  }

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const p of parts) {
      const line = p.trim();
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        yield JSON.parse(raw) as StreamChunk;
      } catch {}
    }
  }
}
