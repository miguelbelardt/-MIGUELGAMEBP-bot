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
        el("button", { class: "servidor", type: "button", onclick: () => telaServidor(s.id) },
          icone(s.icone, s.nome), el("b", {}, s.nome)))
    )
  );
}

// ---------- tela do servidor: botão de 3 barras + menu de seções ----------

const SECOES = [
  { chave: "geral", emoji: "⚙️", nome: "Geral" },
  { chave: "mensagens", emoji: "👋", nome: "Boas-vindas e saída" }
];

async function telaServidor(id, secaoInicial = "geral") {
  app.replaceChildren(el("p", { class: "legenda" }, "Carregando…"));

  let info;

  try {
    info = await chamar(`/api/guilds/${id}/config`);
  } catch (e) {
    if (logado()) {
      app.replaceChildren(
        el("div", { class: "aviso erro" }, e.message),
        el("button", { class: "link", type: "button", onclick: telaServidores }, "← Voltar")
      );
    }
    return;
  }

  const servidor = info.servidor;
  const conteudo = el("div", { class: "secao" });
  let secaoAtual = secaoInicial;

  const nomeSecao = el("span", { class: "nome-secao" });
  const botaoMenu = el("button", {
    class: "hamburguer", type: "button", "aria-label": "Abrir menu de configurações",
    "aria-expanded": "false", "aria-haspopup": "true"
  }, el("i"), el("i"), el("i"));

  const menu = el("div", { class: "menu-painel", role: "menu", hidden: "" });

  function fecharMenu() {
    menu.hidden = true;
    botaoMenu.setAttribute("aria-expanded", "false");
  }

  function abrirMenu() {
    menu.hidden = false;
    botaoMenu.setAttribute("aria-expanded", "true");
  }

  botaoMenu.addEventListener("click", e => {
    e.stopPropagation();
    if (menu.hidden) abrirMenu(); else fecharMenu();
  });

  menu.addEventListener("click", e => e.stopPropagation());

  const aoClicarFora = () => { if (!document.body.contains(menu)) return; fecharMenu(); };
  const aoTeclar = e => { if (e.key === "Escape") fecharMenu(); };

  // evita acumular ouvintes ao trocar de servidor
  document.removeEventListener("click", telaServidor.fora);
  document.removeEventListener("keydown", telaServidor.tecla);
  telaServidor.fora = aoClicarFora;
  telaServidor.tecla = aoTeclar;
  document.addEventListener("click", aoClicarFora);
  document.addEventListener("keydown", aoTeclar);

  function desenharMenu() {
    menu.replaceChildren(
      ...SECOES.map(s =>
        el("button", {
          class: "item-menu", type: "button", role: "menuitem",
          "aria-current": s.chave === secaoAtual ? "page" : "false",
          onclick: () => { fecharMenu(); abrirSecao(s.chave); }
        }, `${s.emoji} ${s.nome}`))
    );
  }

  async function abrirSecao(chave) {
    secaoAtual = chave;
    const s = SECOES.find(x => x.chave === chave);

    nomeSecao.textContent = `${s.emoji} ${s.nome}`;
    desenharMenu();
    conteudo.replaceChildren(el("p", { class: "legenda" }, "Carregando…"));

    try {
      if (chave === "geral") await secaoGeral(id, info, conteudo);
      else await secaoMensagens(id, servidor, conteudo);
    } catch (e) {
      if (logado()) conteudo.replaceChildren(el("div", { class: "aviso erro" }, e.message));
    }
  }

  app.replaceChildren(
    el("button", { class: "link", type: "button", onclick: telaServidores }, "← Servidores"),
    el("div", { class: "cab-servidor" },
      el("div", { class: "menu-area" }, botaoMenu, menu),
      icone(servidor.icone, servidor.nome),
      el("div", { class: "titulos" }, el("h1", {}, servidor.nome), nomeSecao)
    ),
    conteudo
  );

  abrirSecao(secaoInicial);
}

// ---------- Geral (server-config) ----------

async function secaoGeral(id, cfg, alvo) {
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

  alvo.replaceChildren(
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

// ---------- Boas-vindas e saída ----------

const EXEMPLOS = {
  "{user}": "@Membro", "{username}": "membro", "{userid}": "123456789012345678",
  "{members}": "128", "{inviter}": "@Convidador", "{invites}": "5"
};

function textoExemplo(texto, nomeServidor) {
  return String(texto).replace(/\{[a-z]+\}/gi, v => {
    const k = v.toLowerCase();
    if (k === "{server}") return nomeServidor;
    return EXEMPLOS[k] ?? v;
  });
}

async function secaoMensagens(id, servidor, alvo) {
  let tipo = "entrada";

  const abas = el("div", { class: "abas-msg", role: "tablist" });
  const corpo = el("div", {});

  function desenharAbas() {
    abas.replaceChildren(
      ...[["entrada", "🎉 Entrada"], ["saida", "👋 Saída"]].map(([t, nome]) =>
        el("button", {
          class: "aba", type: "button", role: "tab", "aria-selected": String(t === tipo),
          onclick: () => { tipo = t; desenharAbas(); carregar(); }
        }, nome))
    );
  }

  async function carregar() {
    corpo.replaceChildren(el("p", { class: "legenda" }, "Carregando…"));

    try {
      const dados = await chamar(`/api/guilds/${id}/mensagens/${tipo}`);
      formularioMensagem(id, tipo, servidor, dados, corpo);
    } catch (e) {
      if (logado()) corpo.replaceChildren(el("div", { class: "aviso erro" }, e.message));
    }
  }

  alvo.replaceChildren(
    el("p", { class: "legenda" }, "A mesma configuração do /join e do /leave, agora aqui no site."),
    abas, corpo
  );

  desenharAbas();
  await carregar();
}

function formularioMensagem(id, tipo, servidor, d, alvo) {
  let ultimoCampo = null;
  const campos = {};

  function interruptor(chave, titulo, desc) {
    const caixa = el("input", { type: "checkbox", "aria-label": titulo });
    caixa.checked = !!d[chave];
    campos[chave] = { ler: () => caixa.checked };
    caixa.addEventListener("change", atualizarPreview);

    return el("div", { class: "opcao" },
      el("div", { class: "txt" }, el("b", {}, titulo), desc ? el("span", {}, desc) : ""),
      el("label", { class: "interruptor" }, caixa, el("i")));
  }

  function texto(chave, titulo, { multilinha = false, max = 256, dica = "" } = {}) {
    const campo = multilinha
      ? el("textarea", { rows: "4", maxlength: String(max) })
      : el("input", { type: "text", maxlength: String(max) });
    campo.value = d[chave] ?? "";
    campo.addEventListener("focus", () => { ultimoCampo = campo; });
    campo.addEventListener("input", atualizarPreview);
    campos[chave] = { ler: () => campo.value };

    return el("label", { class: "campo" }, el("b", {}, titulo), campo, dica ? el("span", {}, dica) : "");
  }

  const canal = el("select", { "aria-label": "Canal" },
    el("option", { value: "" }, "— escolha um canal —"),
    ...d.canais.map(c => el("option", { value: c.id }, "#" + c.nome)));
  canal.value = d.canal_id || "";
  campos.canal_id = { ler: () => canal.value || null };

  const cor = el("input", { type: "color", "aria-label": "Cor do embed" });
  cor.value = (d.embed_cor || "#5865F2").toLowerCase();
  cor.addEventListener("input", atualizarPreview);
  campos.embed_cor = { ler: () => cor.value.toUpperCase() };

  const previa = el("div", { class: "previa" });

  function atualizarPreview() {
    const v = k => campos[k].ler();
    const t = s => textoExemplo(s, servidor.nome);
    const partes = [];

    if (v("content").trim()) partes.push(el("p", { class: "previa-texto" }, t(v("content"))));

    if (v("embed_habilitado")) {
      const emb = el("div", { class: "previa-embed" });
      emb.style.borderLeftColor = v("embed_cor");

      if (v("autor_habilitado") && v("autor_nome").trim()) emb.append(el("div", { class: "previa-autor" }, t(v("autor_nome"))));
      if (v("embed_titulo").trim()) emb.append(el("b", {}, t(v("embed_titulo"))));
      if (v("embed_descricao").trim()) emb.append(el("p", {}, t(v("embed_descricao"))));
      if (v("footer_habilitado") && v("footer_texto").trim()) {
        emb.append(el("small", {}, t(v("footer_texto")) + (v("timestamp") ? " • agora" : "")));
      }

      partes.push(emb);
    }

    previa.replaceChildren(el("small", { class: "legenda" }, "Prévia (com dados de exemplo)"), ...partes);
  }

  const botaoSalvar = el("button", { class: "botao", type: "button" }, "💾 Salvar");

  botaoSalvar.addEventListener("click", async () => {
    const corpo = {};
    for (const [k, c] of Object.entries(campos)) corpo[k] = c.ler();

    botaoSalvar.disabled = true;

    try {
      await chamar(`/api/guilds/${id}/mensagens/${tipo}`, { method: "PUT", body: JSON.stringify(corpo) });
      aviso("Salvo ✓");
    } catch (e) {
      aviso(e.message, true);
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  const variaveis = el("div", { class: "variaveis" },
    el("b", {}, "Variáveis (clique para inserir no campo selecionado)"),
    el("div", { class: "chips" },
      ...d.variaveis.map(([nome, desc]) =>
        el("button", {
          class: "chip", type: "button", title: desc,
          onclick: () => {
            if (!ultimoCampo) { aviso("Clique antes em um campo de texto.", true); return; }
            const c = ultimoCampo;
            const ini = c.selectionStart ?? c.value.length;
            const fim = c.selectionEnd ?? c.value.length;
            if (c.value.length - (fim - ini) + nome.length > Number(c.getAttribute("maxlength") || 1e9)) return;
            c.value = c.value.slice(0, ini) + nome + c.value.slice(fim);
            c.focus();
            c.setSelectionRange(ini + nome.length, ini + nome.length);
            atualizarPreview();
          }
        }, nome))),
    el("ul", {}, ...d.variaveis.map(([nome, desc]) => el("li", {}, el("code", {}, nome), " — " + desc))));

  alvo.replaceChildren(
    interruptor("habilitado", tipo === "entrada" ? "Ativar mensagem de boas-vindas" : "Ativar mensagem de saída"),
    el("div", { class: "opcao" },
      el("div", { class: "txt" }, el("b", {}, "📣 Canal"), el("span", {}, "Onde a mensagem será enviada.")), canal),
    el("h2", {}, "Mensagem"),
    texto("content", "Texto fora do embed", { multilinha: true, max: 2000 }),
    interruptor("embed_habilitado", "Usar embed"),
    el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "🎨 Cor do embed")), cor),
    texto("embed_titulo", "Título", { max: 256 }),
    texto("embed_descricao", "Descrição", { multilinha: true, max: 4000 }),
    interruptor("autor_habilitado", "Mostrar autor"),
    texto("autor_nome", "Nome do autor", { max: 256 }),
    texto("autor_icone", "Ícone do autor", { max: 500, dica: "Vazio, uma variável como {avatar} ou um link." }),
    texto("thumbnail", "Miniatura", { max: 500, dica: "Vazio, uma variável como {avatar} ou um link." }),
    texto("imagem", "Imagem grande", { max: 500, dica: "Vazio, uma variável como {banner} ou um link." }),
    interruptor("footer_habilitado", "Mostrar rodapé"),
    texto("footer_texto", "Texto do rodapé", { max: 2048 }),
    texto("footer_icone", "Ícone do rodapé", { max: 500 }),
    interruptor("timestamp", "Mostrar data e hora"),
    variaveis,
    previa,
    el("div", { class: "acoes" }, botaoSalvar)
  );

  atualizarPreview();
}

function tela() {
  if (!logado()) return telaLogin(app, "Autorize o aplicativo para configurar o bot nos servidores onde você é administrador.");

  return telaServidores();
}

window.aoSessaoExpirar = tela;

tela();
