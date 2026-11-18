// =====================================================
// 🖥️ DASHBOARD (servidores e configurações)
// =====================================================

const app = document.getElementById("app");

async function telaServidores() {
  app.replaceChildren(el("p", { class: "legenda" }, "Carregando seus servidores…"));

  let eu, lista;

  try {
    [eu, lista] = await Promise.all([chamar("/api/me"), chamar("/api/guilds")]);
  } catch (e) {
    if (logado()) app.replaceChildren(el("div", { class: "aviso erro" }, "Não consegui falar com o bot: " + e.message));
    return;
  }

  const avatar = eu.avatar
    ? `https://cdn.discordapp.com/avatars/${eu.id}/${eu.avatar}.png?size=64`
    : null;

  const sair = el("button", { class: "link", type: "button", onclick: () => { guardar(null); atualizarCabecalho(); tela(); } }, "Sair");

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
    if (logado()) {
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
  if (!logado()) return telaLogin(app, "Autorize o aplicativo para configurar o bot nos servidores onde você é administrador.");

  return telaServidores();
}

window.aoSessaoExpirar = tela;

tela();
