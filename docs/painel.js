// =====================================================
// ⚙️ CONFIGURAÇÃO
// =====================================================
// Endereço público do bot (FadeHost → Apps and bots → Web address)
const API = "https://miguelgamebp-bot.fadehost.app";

// =====================================================

const app = document.getElementById("app");
const toast = document.getElementById("toast");

function guardar(token) {
  try {
    if (token) localStorage.setItem("painel_token", token);
    else localStorage.removeItem("painel_token");
  } catch { /* sem armazenamento */ }
}

function lerToken() {
  try { return localStorage.getItem("painel_token"); } catch { return null; }
}

let token = lerToken();
let erroLogin = false;

// O login volta com #token=... ou #erro=login (o fragmento nunca vai para o servidor)
if (location.hash.length > 1) {
  const p = new URLSearchParams(location.hash.slice(1));

  if (p.get("token")) { token = p.get("token"); guardar(token); }
  if (p.get("erro")) erroLogin = true;

  history.replaceState(null, "", location.pathname);
}

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
  toast.textContent = texto;
  toast.className = "toast visivel" + (erro ? " erro" : "");
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => toast.classList.remove("visivel"), 2200);
}

async function chamar(caminho, opcoes = {}) {
  const r = await fetch(API + caminho, {
    ...opcoes,
    headers: {
      Authorization: "Bearer " + token,
      ...(opcoes.body ? { "Content-Type": "application/json" } : {})
    }
  });

  if (r.status === 401) {
    guardar(null);
    token = null;
    tela();
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

// ---------- telas ----------

function telaLogin() {
  app.replaceChildren(
    el("h1", {}, "Painel do bot"),
    el("p", { class: "legenda" }, "Entre com o Discord para configurar o bot nos servidores onde você é administrador."),
    ...(erroLogin ? [el("div", { class: "aviso erro" }, "Não consegui entrar. Tente de novo.")] : []),
    el("a", { class: "botao", href: API + "/auth/login" }, "Entrar com Discord")
  );
}

async function telaServidores() {
  app.replaceChildren(el("p", { class: "legenda" }, "Carregando seus servidores…"));

  let eu, lista;

  try {
    [eu, lista] = await Promise.all([chamar("/api/me"), chamar("/api/guilds")]);
  } catch (e) {
    if (token) app.replaceChildren(el("div", { class: "aviso erro" }, "Não consegui falar com o bot: " + e.message));
    return;
  }

  const avatar = eu.avatar
    ? `https://cdn.discordapp.com/avatars/${eu.id}/${eu.avatar}.png?size=64`
    : null;

  const sair = el("button", { class: "link", type: "button", onclick: () => { guardar(null); token = null; tela(); } }, "Sair");

  app.replaceChildren(
    el("div", { class: "usuario" },
      avatar ? el("img", { src: avatar, alt: "" }) : el("div", { class: "sem-icone" }, iniciais(eu.nome)),
      el("span", {}, eu.nome),
      sair
    ),
    el("h1", {}, "Seus servidores"),
    el("p", { class: "legenda" }, "Servidores onde o bot está e você tem permissão de Administrador ou Gerenciar Servidor.")
  );

  if (!lista.servidores.length) {
    app.append(el("div", { class: "aviso" }, "Nenhum servidor encontrado. Adicione o bot a um servidor seu e volte aqui."));
    return;
  }

  app.append(
    el("div", { class: "servidores" },
      ...lista.servidores.map(s =>
        el("button", { class: "servidor", type: "button", onclick: () => telaConfig(s.id) },
          icone(s.icone, s.nome), el("b", {}, s.nome)))
    )
  );
}

async function telaConfig(id) {
  app.replaceChildren(el("p", { class: "legenda" }, "Carregando…"));

  let cfg;

  try {
    cfg = await chamar(`/api/guilds/${id}/config`);
  } catch (e) {
    if (token) {
      app.replaceChildren(
        el("div", { class: "aviso erro" }, e.message),
        el("button", { class: "link", type: "button", onclick: telaServidores }, "← Voltar")
      );
    }
    return;
  }

  async function salvar(dados, desfazer) {
    try {
      await chamar(`/api/guilds/${id}/config`, { method: "PUT", body: JSON.stringify(dados) });
      aviso("Salvo ✓");
    } catch (e) {
      desfazer?.();
      aviso(e.message, true);
    }
  }

  const linhas = cfg.opcoes.map(o => {
    const caixa = el("input", { type: "checkbox", "aria-label": o.nome });
    caixa.checked = o.valor;
    caixa.addEventListener("change", () => salvar({ [o.chave]: caixa.checked }, () => { caixa.checked = !caixa.checked; }));

    return el("div", { class: "opcao" },
      el("div", { class: "txt" }, el("b", {}, `${o.emoji} ${o.nome}`), el("span", {}, o.descricao)),
      el("label", { class: "interruptor" }, caixa, el("i"))
    );
  });

  const canais = el("select", { "aria-label": "Canal dos avisos de nível" },
    el("option", { value: "" }, "Onde a pessoa subiu de nível"),
    ...cfg.canais.map(c => el("option", { value: c.id }, "#" + c.nome))
  );
  canais.value = cfg.canal_nivel || "";

  let canalAtual = canais.value;
  canais.addEventListener("change", () => {
    const anterior = canalAtual;
    canalAtual = canais.value;
    salvar({ canal_nivel: canais.value || null }, () => { canais.value = anterior; canalAtual = anterior; });
  });

  const mult = el("select", { "aria-label": "Multiplicador de XP" },
    ...cfg.multiplicadores.map(m => el("option", { value: String(m) }, "x" + String(m).replace(".", ",")))
  );
  mult.value = String(cfg.multiplicador_xp);

  let multAtual = mult.value;
  mult.addEventListener("change", () => {
    const anterior = multAtual;
    multAtual = mult.value;
    salvar({ multiplicador_xp: Number(mult.value) }, () => { mult.value = anterior; multAtual = anterior; });
  });

  app.replaceChildren(
    el("button", { class: "link", type: "button", onclick: telaServidores }, "← Servidores"),
    el("div", { class: "cab-servidor" }, icone(cfg.servidor.icone, cfg.servidor.nome), el("h1", {}, cfg.servidor.nome)),
    el("p", { class: "legenda" }, "As mudanças são salvas na hora e valem só para este servidor."),
    ...linhas,
    el("div", { class: "opcao" },
      el("div", { class: "txt" }, el("b", {}, "📣 Canal dos avisos de nível"), el("span", {}, "Onde o bot avisa quando alguém sobe de nível.")),
      canais),
    el("div", { class: "opcao" },
      el("div", { class: "txt" }, el("b", {}, "✨ Multiplicador de XP"), el("span", {}, "Vale para o XP ganho conversando aqui.")),
      mult)
  );
}

function tela() {
  if (!token) return telaLogin();
  return telaServidores();
}

tela();
