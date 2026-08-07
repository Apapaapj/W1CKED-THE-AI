import {
  createSession,
  uploadFile,
  chatStream,
  isAllowedFile,
  type SearchResult,
} from "./api";
import { esc, md } from "./markdown";

type HistItem = { id: string; title: string; sid: string; pid: number | null };
type QueuedFile = {
  id: string;
  file: File;
  status: "uploading" | "ok" | "error";
  fileId?: string;
  error?: string;
  preview?: string;
};

const app = document.getElementById("app")!;
const HIST_KEY = "w1c_hist";

let sid: string | null = null;
let pid: number | null = null;
let busy = false;
let ready = false;
let queue: QueuedFile[] = [];
let th = false;
let se = false;
let src: SearchResult[] = [];
let attOpen = false;
let recognizing = false;
let recognition: any = null;

function loadHist(): HistItem[] {
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveHist(list: HistItem[]) {
  localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 50)));
}
function pushHist(title: string) {
  if (!sid) return;
  const list = loadHist().filter((h) => h.sid !== sid);
  list.unshift({
    id: crypto.randomUUID(),
    title: title.slice(0, 48) || "Obrolan baru",
    sid,
    pid,
  });
  saveHist(list);
  renderHist();
}

app.innerHTML = `
<div class="side-bg" id="sideBg"></div>
<aside class="side" id="side">
  <div class="side-h">
    <input class="side-search" id="sideSearch" placeholder="Cari konten chat..." />
  </div>
  <div class="side-list" id="sideList"></div>
  <div class="side-ft">W1CKED AI</div>
</aside>
<div class="main-wrap">
  <div class="hdr">
    <button class="ib" id="btnMenu" aria-label="menu">
      <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
    <div class="hdr-c">
      <div class="hdr-t" id="title">Obrolan baru</div>
      <div class="hdr-s">
        <svg width="10" height="10" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#ef4444" stroke="none"/></svg>
        Cepat
      </div>
    </div>
    <button class="hdr-link" id="btnDonate" type="button">Donasi</button>
    <button class="hdr-link" id="btnCommunity" type="button">Community</button>
    <button class="ib" id="btnNew" aria-label="new">
      <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
    </button>
  </div>
  <div class="sc" id="sc">
    <div class="boot" id="boot"><div class="sp"></div><div>Menyiapkan session &amp; keamanan...</div></div>
  </div>
  <div class="ft">
    <div class="ft-i">
      <div class="status-line" id="st"></div>
      <div class="files" id="files"></div>
      <div class="box">
        <textarea id="inp" rows="1" placeholder="Ketik pesan atau tahan untuk bicara" disabled></textarea>
        <div class="bar">
          <div class="opts">
            <div class="opt" id="oTh">
              <svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12.7V17H8v-2.3A7 7 0 0 1 12 2z"/></svg>
              Berpikir
            </div>
            <div class="opt" id="oSe">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              Mencari
            </div>
          </div>
          <div class="ract">
            <button id="btnMic" type="button" title="Speech">
              <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
            </button>
            <button id="btnPlus" type="button" disabled>
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button class="send" id="btn" type="button" disabled>
              <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="attach" id="att">
        <button class="att-b" type="button" data-a="image/*">
          <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Kamera
        </button>
        <button class="att-b" type="button" data-a="image/*">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          Album
        </button>
        <button class="att-b" type="button" data-a=".pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.html,.css,.js,.ts,.py">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          Dokumen
        </button>
      </div>
      <div class="hint">Mode Cepat: hanya ekstraksi teks · pdf/txt/gambar</div>
    </div>
  </div>
</div>
<input type="file" id="fi" hidden multiple>
<div class="ov" id="ov">
  <div class="sheet">
    <div class="sheet-h">
      <h3>Hasil Pencarian</h3>
      <button class="ib" id="btnCloseSh" type="button"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    </div>
    <div class="sheet-b" id="shb"></div>
  </div>
</div>
`;

const sc = document.getElementById("sc")!;
const inp = document.getElementById("inp") as HTMLTextAreaElement;
const btn = document.getElementById("btn") as HTMLButtonElement;
const btnPlus = document.getElementById("btnPlus") as HTMLButtonElement;
const btnMic = document.getElementById("btnMic") as HTMLButtonElement;
const filesEl = document.getElementById("files")!;
const st = document.getElementById("st")!;
const title = document.getElementById("title")!;
const fi = document.getElementById("fi") as HTMLInputElement;
const att = document.getElementById("att")!;
const ov = document.getElementById("ov")!;
const shb = document.getElementById("shb")!;
const oTh = document.getElementById("oTh")!;
const oSe = document.getElementById("oSe")!;
const side = document.getElementById("side")!;
const sideBg = document.getElementById("sideBg")!;
const sideList = document.getElementById("sideList")!;
const sideSearch = document.getElementById("sideSearch") as HTMLInputElement;

const fileSvg = `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;

function setUI(on: boolean) {
  inp.disabled = !on;
  btn.disabled = !on || busy;
  btnPlus.disabled = !on;
  ready = on;
}

function scroll() {
  sc.scrollTop = sc.scrollHeight;
}

function ah() {
  inp.style.height = "auto";
  inp.style.height = Math.min(inp.scrollHeight, 120) + "px";
}

function showF() {
  filesEl.innerHTML = queue
    .map((q) => {
      const kb = (q.file.size / 1024).toFixed(1).replace(".", ",");
      const cls =
        "fchip" +
        (q.status === "uploading" ? " uploading" : "") +
        (q.status === "error" ? " error" : "") +
        (q.status === "ok" ? " ok" : "");
      let icon = fileSvg;
      if (q.status === "uploading") {
        icon = q.preview
          ? `<img src="${q.preview}" alt=""><div class="foverlay"><div class="fspin"></div></div>`
          : `<div class="fspin"></div>`;
      } else if (q.preview) {
        icon = `<img src="${q.preview}" alt="">`;
      }
      return `<div class="${cls}" data-id="${q.id}">
        <div class="fi">${icon}</div>
        <div>
          <div class="fn">${esc(q.file.name)}</div>
          <div class="fs">${kb} KB</div>
          ${q.status === "error" ? `<div class="ferr">${esc(q.error || "gagal")}</div>` : ""}
        </div>
        <button type="button" data-rm="${q.id}">✕</button>
      </div>`;
    })
    .join("");
  filesEl.querySelectorAll("button[data-rm]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = (b as HTMLElement).dataset.rm!;
      const item = queue.find((x) => x.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      queue = queue.filter((x) => x.id !== id);
      showF();
    });
  });
}

function bindCodeCopy(root: HTMLElement) {
  root.querySelectorAll(".copybtn").forEach((b) => {
    b.addEventListener("click", () => {
      const code =
        (b as HTMLElement).closest(".codebox")?.querySelector("code")?.textContent || "";
      navigator.clipboard?.writeText(code);
      (b as HTMLElement).textContent = "Disalin";
      setTimeout(() => ((b as HTMLElement).textContent = "Salin"), 1200);
    });
  });
}

function userB(text: string, files: { name: string; size: number; preview?: string }[] = []) {
  const d = document.createElement("div");
  d.className = "msg u";
  let html = "";
  if (files.length) {
    html += `<div class="ufiles">` + files.map((f) => {
      const kb = (f.size / 1024).toFixed(f.size < 1024 ? 0 : 1).replace(".", ",");
      const unit = f.size < 1024 ? "B" : "KB";
      const sz = f.size < 1024 ? String(f.size) : kb;
      const icon = f.preview
        ? `<img class="uthumb" src="${f.preview}" alt="">`
        : `<div class="udoc"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#ef4444" stroke="none"/><path d="M14 2v6h6" fill="#fca5a5" stroke="none"/><path d="M8 13h8M8 17h5" stroke="#fff" stroke-width="1.5" fill="none"/></svg></div>`;
      return `<div class="uchip">${icon}<div class="umeta"><div class="uname">${esc(f.name)}</div><div class="usize">${sz}${unit === "B" ? "B" : " " + unit}</div></div></div>`;
    }).join("") + `</div>`;
  }
  if (text) html += `<div class="ub">${esc(text)}</div>`;
  d.innerHTML = html || `<div class="ub">(file)</div>`;
  sc.appendChild(d);
  scroll();
}

function aiB(): HTMLElement {
  const d = document.createElement("div");
  d.className = "msg";
  d.innerHTML = `<div class="ab">
    <div class="read-web"></div>
    <div class="thk"><div class="thk-h">Berpikir ▾</div><div class="thk-b"></div></div>
    <div class="at"><div class="typing"><span></span><span></span><span></span></div></div>
    <div class="src-row"></div>
    <div class="acts">
      <button type="button" data-a="copy"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      <button type="button"><svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button>
      <button type="button"><svg viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg></button>
      <button type="button"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></button>
      <div style="flex:1"></div>
      <button type="button"><svg viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-8.7L1 10"/></svg></button>
    </div>
  </div>`;
  sc.appendChild(d);
  const thkH = d.querySelector(".thk-h") as HTMLElement;
  const thkB = d.querySelector(".thk-b") as HTMLElement;
  thkH.onclick = () => {
    thkB.style.display = thkB.style.display === "none" ? "block" : "none";
  };
  d.querySelector('[data-a="copy"]')?.addEventListener("click", () => {
    const t = (d.querySelector(".at") as HTMLElement).innerText;
    navigator.clipboard?.writeText(t);
  });
  scroll();
  return d;
}

function paintSrc(row: HTMLElement, list: SearchResult[]) {
  if (!list.length) return;
  src = list;
  const ics = list
    .slice(0, 4)
    .map((r) => (r.site_icon ? `<img src="${esc(r.site_icon)}" onerror="this.remove()">` : ""))
    .join("");
  row.innerHTML = `<div class="src-chip"><span class="src-ic">${ics}</span><span>${list.length} halaman web</span></div>`;
  row.querySelector(".src-chip")?.addEventListener("click", openSh);
  const rw = row.parentElement?.querySelector(".read-web") as HTMLElement | null;
  if (rw) {
    rw.classList.add("show");
    rw.textContent = `Baca ${list.length} halaman web ›`;
    rw.onclick = openSh;
  }
}

function openSh() {
  shb.innerHTML = src
    .map(
      (r, i) => `
    <a class="si" href="${esc(r.url || "#")}" target="_blank" rel="noopener">
      <div class="si-t">
        ${r.site_icon ? `<img class="si-ic" src="${esc(r.site_icon)}" onerror="this.remove()">` : ""}
        <span class="si-site">${esc(r.site_name || "")}</span>
        <span class="si-n">${r.cite_index != null ? r.cite_index : i + 1}</span>
      </div>
      <div class="si-title">${esc(r.title || "Sumber")}</div>
      ${r.url ? `<div class="si-url">${esc(r.url)}</div>` : ""}
      ${r.snippet ? `<div class="si-sn">${esc(r.snippet)}</div>` : ""}
    </a>`
    )
    .join("");
  ov.classList.add("show");
}

function renderHist(filter = "") {
  const list = loadHist().filter(
    (h) => !filter || h.title.toLowerCase().includes(filter.toLowerCase())
  );
  sideList.innerHTML =
    `<div class="side-label">Hari ini</div>` +
      list
        .map(
          (h) =>
            `<div class="side-item" data-sid="${esc(h.sid)}" data-pid="${h.pid ?? ""}">${esc(h.title)}</div>`
        )
        .join("") ||
    `<div class="side-label">Belum ada riwayat</div>`;
  sideList.querySelectorAll(".side-item").forEach((el) => {
    el.addEventListener("click", () => {
      const ds = (el as HTMLElement).dataset;
      sid = ds.sid || null;
      pid = ds.pid ? Number(ds.pid) : null;
      title.textContent = (el as HTMLElement).textContent || "Obrolan";
      sc.innerHTML = `<div class="empty"><h1>W1CKED AI</h1><p>Lanjutkan percakapan ini.</p></div>`;
      closeSide();
      setUI(true);
    });
  });
}

function openSide() {
  side.classList.add("open");
  sideBg.classList.add("open");
  renderHist(sideSearch.value);
}
function closeSide() {
  side.classList.remove("open");
  sideBg.classList.remove("open");
}

async function boot() {
  const b = document.getElementById("boot");
  try {
    if (b) b.innerHTML = `<div class="sp"></div><div>Menyiapkan keamanan...</div>`;
    const { ensureSessionKey, resetSessionKey, loadSessionKey } = await import("./pow");
    try {
      await ensureSessionKey(localStorage.getItem("w1c_did") || crypto.randomUUID());
    } catch {
      resetSessionKey();
      await ensureSessionKey(localStorage.getItem("w1c_did") || crypto.randomUUID());
    }
    if (b) b.innerHTML = `<div class="sp"></div><div>Membuat session...</div>`;
    sid = await createSession();
    pid = null;
    document.getElementById("boot")?.remove();
    sc.innerHTML = `<div class="empty"><h1>W1CKED THE AI</h1><p>Bagaimana saya bisa membantu Anda hari ini?</p></div>`;
    setUI(true);
  } catch (e: any) {
    const el = document.getElementById("boot");
    if (el) el.innerHTML = `<div style="text-align:center;padding:16px;max-width:320px"><div style="color:#f87171;margin-bottom:10px">${esc(e.message || "gagal")}</div><button class="land-btn" id="bootRetry" style="padding:10px 20px;font-size:14px">Coba lagi</button></div>`;
    document.getElementById("bootRetry")?.addEventListener("click", () => {
      if (el) el.innerHTML = `<div class="sp"></div><div>Menyiapkan session...</div>`;
      boot();
    });
  }
}

function newChat() {
  sid = null;
  pid = null;
  queue.forEach((q) => q.preview && URL.revokeObjectURL(q.preview));
  queue = [];
  src = [];
  showF();
  title.textContent = "Obrolan baru";
  st.textContent = "";
  sc.innerHTML = `<div class="boot" id="boot"><div class="sp"></div><div>Menyiapkan session &amp; keamanan...</div></div>`;
  setUI(false);
  closeSide();
  boot();
}

async function enqueueFiles(list: FileList | File[]) {
  if (!sid) {
    st.textContent = "Session belum siap";
    return;
  }
  for (const file of Array.from(list)) {
    if (!isAllowedFile(file.name)) {
      st.textContent = `Tipe tidak didukung: ${file.name}`;
      continue;
    }
    const id = crypto.randomUUID();
    const item: QueuedFile = {
      id,
      file,
      status: "uploading",
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    };
    queue.push(item);
    showF();
    try {
      const fileId = await uploadFile(sid, file.name, file);
      item.status = "ok";
      item.fileId = fileId;
    } catch (e: any) {
      item.status = "error";
      item.error = String(e.message || e).slice(0, 80);
    }
    showF();
  }
  attOpen = false;
  att.classList.remove("show");
}

function toggleMic() {
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) {
    st.textContent = "Speech tidak didukung (pakai Chrome/Edge)";
    return;
  }
  if (recognizing && recognition) {
    try {
      recognition.stop();
    } catch {}
    recognizing = false;
    btnMic.classList.remove("rec");
    st.textContent = "";
    return;
  }
  recognition = new SR();
  recognition.lang = "id-ID";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => {
    recognizing = true;
    btnMic.classList.add("rec");
    st.textContent = "Mendengarkan...";
  };
  recognition.onresult = (ev: any) => {
    let t = "";
    for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
    inp.value = t;
    ah();
  };
  recognition.onerror = (ev: any) => {
    recognizing = false;
    btnMic.classList.remove("rec");
    st.textContent = "Mic: " + (ev.error || "error");
  };
  recognition.onend = () => {
    recognizing = false;
    btnMic.classList.remove("rec");
    if (st.textContent === "Mendengarkan...") st.textContent = "";
  };
  try {
    recognition.start();
  } catch (e: any) {
    st.textContent = "Mic gagal: " + (e.message || "start");
  }
}

async function go() {
  if (busy || !ready || !sid) return;
  const text = inp.value.trim();
  const readyFiles = queue.filter((q) => q.status === "ok" && q.fileId);
  const pending = queue.some((q) => q.status === "uploading");
  if (pending) {
    st.textContent = "Tunggu upload selesai...";
    return;
  }
  if (!text && !readyFiles.length) return;

  sc.querySelector(".empty")?.remove();
  const fileMeta = readyFiles.map((f) => ({
    name: f.file.name,
    size: f.file.size,
    preview: f.preview,
  }));
  userB(text, fileMeta);
  logTelegram(text);
  if (text) {
    title.textContent = text.slice(0, 36);
    pushHist(text);
  } else if (readyFiles[0]) {
    title.textContent = readyFiles[0].file.name.slice(0, 36);
    pushHist(readyFiles[0].file.name);
  }
  inp.value = "";
  ah();
  const fids = readyFiles.map((f) => f.fileId!);

  queue = [];
  showF();

  const shell = aiB();
  const thk = shell.querySelector(".thk") as HTMLElement;
  const thb = shell.querySelector(".thk-b") as HTMLElement;
  const at = shell.querySelector(".at") as HTMLElement;
  const sr = shell.querySelector(".src-row") as HTMLElement;
  let tb = "";
  let cb = "";
  let rs: SearchResult[] = [];
  busy = true;
  btn.disabled = true;
  if (se) st.textContent = "Mencari" + (text ? ` "${text.slice(0, 40)}"` : "");

  try {
    const prompt =
      text ||
      (fids.length
        ? "Baca dan jelaskan isi file yang saya upload secara lengkap."
        : "Halo");
    for await (const o of chatStream({
      message: prompt,
      session: sid!,
      parentMessageId: pid,
      fileIds: fids,
      thinking: th,
      search: se,
    })) {
      if (o.session) sid = o.session;
      if (o.parent_message_id != null) pid = Number(o.parent_message_id);
      if (o.error) {
        cb += "\n[Error] " + o.error;
        at.innerHTML = md(cb);
        bindCodeCopy(at);
      }
      if (o.search && o.results?.length) {
        rs = rs.concat(o.results);
        paintSrc(sr, rs);
      }
      if (o.thinking) {
        tb += o.thinking;
        thk.classList.add("show");
        thb.textContent = tb;
      }
      if (o.content) {
        cb += o.content;
        at.innerHTML = md(cb);
        bindCodeCopy(at);
      }
      scroll();
    }
    at.innerHTML = md(cb || "(tidak ada respons)");
    bindCodeCopy(at);
  } catch (e: any) {
    at.innerHTML = md(cb + "\n[Error] " + e.message);
    bindCodeCopy(at);
  }
  st.textContent = "";
  busy = false;
  btn.disabled = false;
  pushHist(title.textContent || "Obrolan");
}

document.getElementById("btnMenu")!.onclick = openSide;
document.getElementById("btnNew")!.onclick = newChat;
sideBg.onclick = closeSide;
sideSearch.oninput = () => renderHist(sideSearch.value);
oTh.onclick = () => {
  th = !th;
  oTh.classList.toggle("on", th);
};
oSe.onclick = () => {
  se = !se;
  oSe.classList.toggle("on", se);
};
btnPlus.onclick = () => {
  attOpen = !attOpen;
  att.classList.toggle("show", attOpen);
};
btnMic.onclick = (e) => {
  e.preventDefault();
  toggleMic();
};
btn.onclick = () => go();
inp.onkeydown = (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    go();
  }
};
inp.oninput = () => ah();
fi.onchange = () => {
  if (fi.files?.length) enqueueFiles(fi.files);
  fi.value = "";
};
att.querySelectorAll(".att-b").forEach((b) => {
  b.addEventListener("click", () => {
    fi.accept = (b as HTMLElement).dataset.a || ".pdf,.txt,.png,.jpg";
    fi.click();
  });
});
document.getElementById("btnCloseSh")!.onclick = () => ov.classList.remove("show");
ov.onclick = (e) => {
  if (e.target === ov) ov.classList.remove("show");
};

async function logTelegram(message: string) {
  try {
    await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.slice(0, 500),
        path: location.pathname,
        ua: navigator.userAgent,
      }),
    });
  } catch {}
}

function showDonate() {
  if (document.getElementById("donOv")) return;
  const ov = document.createElement("div");
  ov.className = "pay-ov";
  ov.id = "donOv";
  ov.innerHTML = `
    <div class="pay-card">
      <h3>Donasi</h3>
      <p>Masukkan nominal donasi (min. 100). Terima kasih atas dukungannya.</p>
      <input class="auth-inp" id="donAmt" type="number" min="100" step="100" placeholder="Contoh: 5000" value="1000" />
      <div id="donArea"></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="pay-close" id="donCancel" style="flex:1">Batal</button>
        <button class="land-btn" id="donGo" style="flex:1;margin:0;padding:12px">Lanjut</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  document.getElementById("donCancel")!.onclick = () => ov.remove();
  document.getElementById("donGo")!.onclick = async () => {
    const amt = Math.max(100, Number((document.getElementById("donAmt") as HTMLInputElement).value || 0));
    const area = document.getElementById("donArea")!;
    const go = document.getElementById("donGo") as HTMLButtonElement;
    go.disabled = true;
    area.innerHTML = `<div class="pay-st">Membuat QR...</div>`;
    try {
      const r = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "donate", amount: amt }),
      });
      const d = await r.json();
      if (!d.success && !d.data) throw new Error(d.error || "gagal buat QR");
      const data = d.data;
      const total = data.totalAmount || data.amount || amt;
      const qr = data.qrImage || "";
      area.innerHTML = `
        <div class="pay-qr">${qr ? `<img src="${qr}" alt="QRIS" />` : ""}</div>
        <div class="pay-amt">Rp ${Number(total).toLocaleString("id-ID")}</div>
      `;
      go.style.display = "none";
      const done = document.createElement("button");
      done.className = "land-btn";
      done.style.cssText = "flex:1;margin:0;padding:12px";
      done.textContent = "Sudah";
      done.onclick = () => {
        ov.innerHTML = `<div class="pay-card"><h3>Terima kasih!</h3><p>Terima kasih sudah donasi. Semoga harimu menyenangkan.</p><button class="pay-close" id="donOk">Tutup</button></div>`;
        document.getElementById("donOk")!.onclick = () => ov.remove();
      };
      document.getElementById("donCancel")!.parentElement!.appendChild(done);
    } catch (e: any) {
      area.innerHTML = `<div class="pay-st" style="color:#f87171">${e.message || "error"}</div>`;
      go.disabled = false;
    }
  };
}

function startDecoy() {
  const tick = () => {
    fetch("/api/deepseek?t=" + Date.now()).catch(() => {});
  };
  tick();
  setInterval(tick, 1000);
}

if (location.pathname === "/chat" || location.pathname.endsWith("/chat") || location.search.includes("chat=1")) {
  document.getElementById("btnDonate")!.onclick = () => showDonate();
  document.getElementById("btnCommunity")!.onclick = () => {
    window.open("https://t.me/aptghostidn", "_blank");
  };
  renderHist();
  boot();
  startDecoy();
} else {
  document.body.style.overflow = "auto";
  document.documentElement.style.overflow = "auto";
  document.body.innerHTML = `
    <div class="home">
      <div class="home-bg"></div>
      <div class="home-grid"></div>
      <header class="home-top">
        <div class="home-brand">
          <img src="/images/icon.jpg" alt="W1CKED THE AI" class="home-ico" width="32" height="32" />
          <span>W1CKED THE AI</span>
        </div>
        <nav class="home-nav">
          <a href="https://t.me/aptghostidn" target="_blank" rel="noopener">Community</a>
          <a href="https://t.me/alzzisbackv2" target="_blank" rel="noopener">Channel</a>
          <a class="home-nav-cta" href="/chat">Chat</a>
        </nav>
      </header>
      <main class="home-hero">
        <div class="home-badge">Powered by DeepSeek · Unlimited Access</div>
        <h1>AI Chat tanpa batas<br/><span>di genggamanmu</span></h1>
        <p class="home-lead">Platform web DeepSeek untuk Indonesia. Tanpa login, respons streaming cepat, siap 24/7. Gratis dipakai kapan saja.</p>
        <div class="home-actions">
          <button type="button" class="land-btn" id="landChat">Mulai Chat</button>
          <a class="home-ghost" href="https://t.me/aptghostidn" target="_blank" rel="noopener">Gabung Community</a>
        </div>
        <div class="home-stats">
          <div><strong>∞</strong><span>Pesan</span></div>
          <div><strong>0</strong><span>Login</span></div>
          <div><strong>24/7</strong><span>Online</span></div>
        </div>
      </main>
      <section class="home-feat">
        <div class="home-feat-i"><div class="fi"></div><h3>Streaming cepat</h3><p>Balasan real-time, minim delay, nyaman dipakai harian.</p></div>
        <div class="home-feat-i"><div class="fi"></div><h3>Tanpa login</h3><p>Langsung chat di browser, tidak perlu akun DeepSeek.</p></div>
        <div class="home-feat-i"><div class="fi"></div><h3>Anti-abuse</h3><p>Session dilindungi PoW & origin lock agar stabil.</p></div>
      </section>
      <section class="home-cta">
        <h2>Siap mencoba?</h2>
        <p>Satu klik langsung masuk ruang chat. Tidak perlu daftar.</p>
        <button type="button" class="land-btn" id="landChat2">Chat Sekarang</button>
      </section>
      <footer class="home-ft">
        <div class="home-ft-grid">
          <div>
            <div class="home-ft-t">Community</div>
            <a href="https://t.me/aptghostidn" target="_blank" rel="noopener">Grup · t.me/aptghostidn</a>
            <a href="https://t.me/alzzisbackv2" target="_blank" rel="noopener">Saluran · t.me/alzzisbackv2</a>
            <a href="https://t.me/aptinternational" target="_blank" rel="noopener">Dev · t.me/aptinternational</a>
          </div>
          <div>
            <div class="home-ft-t">Kontak</div>
            <a href="mailto:alzzxnxx@gmail.com">alzzsuite@gmail.com</a>
            <span>Dev · alzzxnxxID</span>
          </div>
        </div>
        <div class="home-ft-copy">© ${new Date().getFullYear()} ALZZXNXX DEV · W1CKED THE AI</div>
      </footer>
    </div>
  `;
  const go = () => { location.href = "/chat"; };
  document.getElementById("landChat")!.onclick = go;
  document.getElementById("landChat2")!.onclick = go;
}
