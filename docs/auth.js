// =====================================================
// 🔑 LOGIN E UTILIDADES (usado em todas as páginas do site)
// =====================================================

// Endereço público do bot (FadeHost → Apps and bots → Web address)
const API = "https://miguelgamebp-bot.fadehost.app";

// =====================================================

// ---------- sessão ----------

function guardar(token) {
  try {
    if (token) localStorage.setItem("painel_token", token);
    else localStorage.removeItem("painel_token");
  } catch { /* sem armazenamento */ }
}

function lerToken() {
  try { return localStorage.getItem("painel_token"); } catch { return null; }
}

// A sessão é um texto assinado pelo bot; aqui só olhamos a validade
// (quem confere de verdade é sempre o bot).
function logado() {
  const t = lerToken();

  if (!t) return false;

  try {
    const base = t.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const dados = JSON.parse(atob(base.padEnd(Math.ceil(base.length / 4) * 4, "=")));

    return Number(dados.exp) > Date.now();
  } catch {
    return false;
  }
}

let erroLogin = false;

// O login volta com #token=... ou #erro=login (o fragmento nunca vai para o servidor).
// Âncoras normais do site (#comandos etc.) não são mexidas.
if (location.hash.length > 1) {
  const p = new URLSearchParams(location.hash.slice(1));

  if (p.has("token") || p.has("erro")) {
    if (p.get("token")) guardar(p.get("token"));
    if (p.get("erro")) erroLogin = true;

    history.replaceState(null, "", location.pathname + location.search);
  }
}

const URL_LOGIN = API + "/auth/login";

// ---------- ajudantes ----------

function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);

  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }

  e.append(...filhos);

  return e;
}

function aviso(texto, erro = false) {
  const toast = document.getElementById("toast");

  if (!toast) return;

  toast.textContent = texto;
  toast.className = "toast visivel" + (erro ? " erro" : "");
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => toast.classList.remove("visivel"), 2200);
}

async function chamar(caminho, opcoes = {}) {
  const r = await fetch(API + caminho, {
    ...opcoes,
    headers: {
      Authorization: "Bearer " + lerToken(),
      ...(opcoes.body ? { "Content-Type": "application/json" } : {})
    }
  });

  if (r.status === 401) {
    guardar(null);
    atualizarCabecalho();
    window.aoSessaoExpirar?.();
    throw new Error("sessão expirada");
  }

  const dados = await r.json().catch(() => ({}));

  if (!r.ok) throw new Error(dados.erro || "Erro inesperado.");

  return dados;
}

function iniciais(nome) {
  return (nome || "?").trim().slice(0, 2).toUpperCase();
}

function icone(url, nome) {
  return url
    ? el("img", { src: url, alt: "", width: 44, height: 44, loading: "lazy" })
    : el("div", { class: "sem-icone" }, iniciais(nome));
}

function telaLogin(app, texto) {
  app.replaceChildren(
    el("h1", {}, "Entre com o Discord"),
    el("p", { class: "legenda" }, texto || "Autorize o aplicativo a ver quem você é (só o seu nome e avatar) para usar o painel."),
    ...(erroLogin ? [el("div", { class: "aviso erro" }, "Não consegui entrar. Tente de novo.")] : []),
    el("a", { class: "botao", href: URL_LOGIN }, "Entrar com Discord")
  );
}

// ---------- botão do cabeçalho: Entrar / Dashboard + menu de páginas ----------

// Páginas do site (para o menu de 3 barras do cabeçalho)
const PAGINAS = [
  { href: "index.html", emoji: "🏠", nome: "Início" },
  { href: "index.html#comandos", emoji: "📜", nome: "Comandos" },
  { href: "daily.html", emoji: "🎁", nome: "Daily" }
];

function menuDePaginas() {
  const atual = (location.pathname.split("/").pop() || "index.html");

  const botao = el("button", {
    class: "hamburguer hamburguer-topo", type: "button", "aria-label": "Abrir menu do site",
    "aria-expanded": "false", "aria-haspopup": "true"
  }, el("i"), el("i"), el("i"));

  const menu = el("div", { class: "menu-painel", hidden: "" },
    ...PAGINAS.map(p => el("a", {
      class: "item-menu", href: p.href,
      "aria-current": p.href === atual ? "page" : "false"
    }, `${p.emoji} ${p.nome}`)));

  const fechar = () => { menu.hidden = true; botao.setAttribute("aria-expanded", "false"); };

  botao.addEventListener("click", e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    botao.setAttribute("aria-expanded", String(!menu.hidden));
  });

  menu.addEventListener("click", e => e.stopPropagation());
  document.addEventListener("click", fechar);
  document.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });

  return el("div", { class: "menu-area menu-site" }, botao, menu);
}

function atualizarCabecalho() {
  const slot = document.getElementById("auth-slot");

  if (!slot) return;

  slot.replaceChildren(
    logado()
      ? el("a", { class: "botao botao-pequeno", href: "painel.html" }, "Dashboard")
      : el("a", { class: "botao botao-pequeno", href: URL_LOGIN }, "Entrar"),
    menuDePaginas()
  );
}

atualizarCabecalho();
