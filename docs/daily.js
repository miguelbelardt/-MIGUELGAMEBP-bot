// =====================================================
// 🎁 DAILY (resgate e aviso)
// =====================================================

const app = document.getElementById("app");

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

  if (!logado()) return telaLogin(app, "Autorize o aplicativo para resgatar o seu daily.");

  app.replaceChildren(el("div", { id: "daily" }));

  return montarDaily();
}

window.aoSessaoExpirar = tela;

tela();
