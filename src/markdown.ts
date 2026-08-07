export function esc(t: string): string {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hl(code: string): string {
  let s = esc(code);
  const keywords =
    "const|let|var|function|return|if|else|for|while|class|import|from|export|default|async|await|try|catch|new|this|true|false|null|undefined|def|print|public|private|static|void|int|string|bool|package|type|interface|extends|implements|switch|case|break|continue|throw|typeof|in|of|as|with|yield|pass|lambda|self|None|True|False|and|or|not|echo|foreach|endif|endfor";
  s = s.replace(new RegExp("\\b(" + keywords + ")\\b", "g"), '<span class="kw">$1</span>');
  s = s.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="st">$1</span>');
  s = s.replace(/(\/\/[^\n]*)/g, '<span class="cm">$1</span>');
  s = s.replace(/(#[^\n]*)/g, '<span class="cm">$1</span>');
  s = s.replace(/\b(\d+\.?\d*)\b/g, '<span class="nu">$1</span>');
  s = s.replace(/(\$[a-zA-Z_][a-zA-Z0-9_]*)/g, '<span class="fn">$1</span>');
  s = s.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span class="fn">$1</span>');
  return s;
}

function codeBox(lang: string, code: string): string {
  const l = (lang || "code").toLowerCase() || "code";
  return `<div class="codebox"><div class="codehd"><span>${esc(l)}</span><button type="button" class="copybtn">Salin</button></div><pre><code>${hl(code.replace(/\n$/, ""))}</code></pre></div>`;
}

export function md(text: string): string {
  const blocks: string[] = [];
  let out = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = blocks.length;
    blocks.push(codeBox(lang, code));
    return `@@CODE${idx}@@`;
  });

  const open = out.match(/```(\w*)\n?([\s\S]*)$/);
  let trailing = "";
  if (open && !out.endsWith("```")) {
    trailing = open[0];
    out = out.slice(0, out.length - trailing.length);
  }

  out = esc(out);
  out = out.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
  out = out.replace(/\[citation:(\d+)\]/g, '<span class="ci" data-c="$1">$1</span>');
  out = out.replace(/^### (.+)$/gm, '<div class="h">$1</div>');
  out = out.replace(/\n/g, "<br>");
  out = out.replace(/@@CODE(\d+)@@/g, (_, n) => blocks[Number(n)] || "");

  if (trailing) {
    const m = trailing.match(/^```(\w*)\n?([\s\S]*)$/);
    if (m) {
      out += codeBox(m[1] || "code", m[2]);
    } else {
      out += esc(trailing).replace(/\n/g, "<br>");
    }
  }
  return out;
}
