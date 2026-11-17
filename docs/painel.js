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
    el("div", { id: "daily" }),
    el("h1", {}, "Seus servidores"),
    el("p", { class: "legenda" }, "Servidores onde o bot está e você tem permissão de Administrador ou Gerenciar Servidor.")
  );

  montarDaily();

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
  clearInterval(relogio);
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

// ---------- daily ----------

let relogio = null;
let animando = false;
let ultimoResultado = null; // { recompensa, sequencia } do resgate feito nesta visita

function formatarRestante(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = n => String(n).padStart(2, "0");

  return `${dois(h)}:${dois(m)}:${dois(s)}`;
}

function formatarHora(ts) {
  return new Date(ts).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const numero = n => Number(n).toLocaleString("pt-BR");

// O número sobe rápido e vai desacelerando até parar no valor sorteado pelo bot.
// (O valor já foi decidido e pago pelo bot: a animação é só visual.)
function animarContagem(alvo, destino, duracao = 4800) {
  return new Promise(resolve => {
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduzir) {
      alvo.textContent = numero(destino);
      resolve();

      return;
    }

    const inicio = performance.now();

    function passo(agora) {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 4); // ease-out forte: começa veloz e freia

      alvo.textContent = numero(Math.round(destino * suave));

      if (t < 1) requestAnimationFrame(passo);
      else resolve();
    }

    requestAnimationFrame(passo);
  });
}

async function resgatarDaily(botao, caixaResultado) {
  if (animando) return;

  animando = true;
  botao.disabled = true;
  botao.textContent = "Resgatando…";

  let dados;

  try {
    dados = await chamar("/api/daily/resgatar", { method: "POST" });
  } catch (e) {
    animando = false;
    aviso(e.message, true);
    montarDaily();

    return;
  }

  const ganho = dados.resultado.recompensa;

  const contador = el("span", { class: "contador" }, "0");

  caixaResultado.replaceChildren(
    el("div", { class: "ganho" },
      el("small", {}, "Você ganhou"),
      el("div", { class: "valor" }, "💰 ", contador, " moedas"))
  );

  botao.remove();

  await animarContagem(contador, ganho);

  ultimoResultado = { recompensa: ganho, sequencia: dados.resultado.sequencia };
  animando = false;

  aviso("Daily resgatado ✓");
  montarDaily();
}

async function montarDaily() {
  const alvo = document.getElementById("daily");

  if (!alvo || animando) return;

  clearInterval(relogio);

  let d;

  try {
    d = await chamar("/api/daily");
  } catch {
    alvo.replaceChildren();

    return;
  }

  const sequencia = d.nuncaPegou
    ? "Você ainda não pegou nenhum daily."
    : d.sequenciaPerdida
      ? "Sequência perdida. Pegue hoje pra recomeçar!"
      : `🔥 Sequência: ${d.sequencia} dia(s)`;

  const estado = el("b", {});
  const caixaResultado = el("div", { class: "resultado-daily" });

  if (ultimoResultado && !d.disponivel) {
    caixaResultado.append(
      el("div", { class: "ganho" },
        el("small", {}, "Você ganhou hoje"),
        el("div", { class: "valor" }, `💰 ${numero(ultimoResultado.recompensa)} moedas`))
    );
  }

  function desenharEstado() {
    if (d.disponivel) {
      estado.textContent = "🎁 Seu daily está disponível!";

      return;
    }

    const restante = d.proximoEm - Date.now();

    if (restante <= 0) {
      montarDaily();

      return;
    }

    estado.textContent = `⏳ Próximo daily em ${formatarRestante(restante)}`;
  }

  desenharEstado();
  relogio = setInterval(desenharEstado, 1000);

  const botao = d.disponivel
    ? el("button", { class: "botao botao-daily", type: "button" }, "🎁 Resgatar daily")
    : null;

  botao?.addEventListener("click", () => resgatarDaily(botao, caixaResultado));

  const caixa = el("input", { type: "checkbox", "aria-label": "Avisar por DM quando o daily estiver disponível" });
  caixa.checked = d.notificacao.ativa;
  caixa.disabled = !d.notificacao.ativa && !d.notificacao.podeLigar;

  caixa.addEventListener("change", async () => {
    const valor = caixa.checked;

    try {
      await chamar("/api/daily/notificacao", { method: "PUT", body: JSON.stringify({ ativa: valor }) });
      aviso(valor ? "Aviso ligado ✓" : "Aviso desligado ✓");
      montarDaily();
    } catch (e) {
      caixa.checked = !valor;
      aviso(e.message, true);
    }
  });

  const dica = d.notificacao.ativa
    ? (d.notificacao.em ? `Você recebe uma DM depois das 00:00 (previsto: ${formatarHora(d.notificacao.em)}).` : "Aviso por DM ligado.")
    : d.notificacao.podeLigar
      ? "Receba uma DM quando o próximo daily estiver disponível."
      : "O aviso liga sozinho quando você resgatar o daily.";

  alvo.replaceChildren(
    el("h1", {}, "🎁 Seu daily"),
    el("div", { class: "opcao" },
      el("div", { class: "txt" }, el("b", {}, `💰 Saldo: ${numero(d.saldo)} moedas`), el("span", {}, sequencia))),
    el("div", { class: "opcao daily-centro" }, estado, ...(botao ? [botao] : []), caixaResultado),
    el("div", { class: "opcao" },
      el("div", { class: "txt" }, el("b", {}, "🔔 Aviso por DM"), el("span", {}, dica)),
      el("label", { class: "interruptor" }, caixa, el("i")))
  );
}

function tela() {
  clearInterval(relogio);
  ultimoResultado = null;

  if (!token) return telaLogin();
  return telaServidores();
}

tela();