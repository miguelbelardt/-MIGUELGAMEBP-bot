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
  { chave: "mensagens", emoji: "👋", nome: "Boas-vindas e saída" },
  { chave: "tickets", emoji: "🎫", nome: "Tickets" },
  { chave: "reactrole", emoji: "🎭", nome: "Reaction Role" },
  { chave: "logs", emoji: "📜", nome: "Logs" },
  { chave: "sorteios", emoji: "🎉", nome: "Sorteios" },
  { chave: "criarcall", emoji: "📞", nome: "Criar Call" },
  { chave: "embeds", emoji: "🧩", nome: "Embeds" },
  { chave: "youtube", emoji: "🎬", nome: "YouTube" },
  { chave: "registro", emoji: "📝", nome: "Registro" }
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
      else if (chave === "mensagens") await secaoMensagens(id, servidor, conteudo);
      else if (chave === "tickets") await secaoTickets(id, servidor, conteudo);
      else if (chave === "reactrole") await secaoReactRole(id, servidor, conteudo);
      else if (chave === "logs") await secaoLogs(id, conteudo);
      else if (chave === "sorteios") await secaoSorteios(id, conteudo);
      else if (chave === "criarcall") await secaoCriarCall(id, conteudo);
      else if (chave === "embeds") await secaoEmbeds(id, conteudo);
      else if (chave === "youtube") await secaoYouTube(id, conteudo);
      else await secaoRegistro(id, conteudo);
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


// ---------- Tickets ----------

const ESTILOS_BOTAO = [["Primary", "Azul"], ["Secondary", "Cinza"], ["Success", "Verde"], ["Danger", "Vermelho"]];

// desliga o botão quando a condição é verdadeira
function semAtributo(botao, desligar) {
  botao.disabled = !!desligar;
  return botao;
}

async function secaoTickets(id, servidor, alvo) {
  let dados = await chamar(`/api/guilds/${id}/tickets`);
  let aba = "config";
  let editando = null; // null = lista, "novo" ou id do modelo

  const base = `/api/guilds/${id}/tickets`;

  // manda para o bot e redesenha com o estado novo
  async function enviar(metodo, caminho, corpo, ok = "Salvo ✓") {
    try {
      dados = await chamar(base + caminho, { method: metodo, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
      aviso(ok);
      return true;
    } catch (e) {
      aviso(e.message, true);
      return false;
    }
  }

  const abas = el("div", { class: "abas-msg", role: "tablist" });
  const corpo = el("div", {});

  function desenhar() {
    abas.replaceChildren(
      ...[["config", "⚙️ Configuração"], ["modelos", "🧩 Modelos"]].map(([k, nome]) =>
        el("button", {
          class: "aba", type: "button", role: "tab", "aria-selected": String(k === aba),
          onclick: () => { aba = k; editando = null; desenhar(); }
        }, nome))
    );

    if (aba === "config") abaConfig();
    else if (editando) abaEditor();
    else abaLista();
  }

  function seletor(opcoes, valor, vazio) {
    const sel = el("select", {}, el("option", { value: "" }, vazio), ...opcoes.map(o => el("option", { value: o.id }, o.nome)));
    sel.value = valor || "";
    return sel;
  }

  function linhaSelect(titulo, desc, sel, chave, valorDe = v => v || null) {
    let atual = sel.value;

    sel.addEventListener("change", async () => {
      const anterior = atual;
      atual = sel.value;
      const ok = await enviar("PUT", "", { [chave]: valorDe(sel.value) });

      if (!ok) { sel.value = anterior; atual = anterior; }
      else desenhar();
    });

    return el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, titulo), el("span", {}, desc)), sel);
  }

  function linhaInterruptor(titulo, desc, chave) {
    const caixa = el("input", { type: "checkbox", "aria-label": titulo });
    caixa.checked = !!dados.config[chave];

    caixa.addEventListener("change", async () => {
      const valor = caixa.checked;
      const ok = await enviar("PUT", "", { [chave]: valor });

      if (!ok) caixa.checked = !valor;
    });

    return el("div", { class: "opcao" },
      el("div", { class: "txt" }, el("b", {}, titulo), el("span", {}, desc)),
      el("label", { class: "interruptor" }, caixa, el("i")));
  }

  function abaConfig() {
    const c = dados.config;
    const pronto = c.modelo_id && c.canal_painel_id && c.categoria_id;

    const limite = el("select", { "aria-label": "Tickets por pessoa" },
      ...[1, 2, 3, 4, 5].map(n => el("option", { value: String(n) }, `${n} ticket${n > 1 ? "s" : ""}`)));
    limite.value = String(c.limite_tickets);

    const botaoPublicar = el("button", { class: "botao", type: "button" },
      c.publicado ? "📤 Atualizar painel no canal" : "📤 Publicar painel no canal");

    botaoPublicar.disabled = !pronto;

    botaoPublicar.addEventListener("click", async () => {
      botaoPublicar.disabled = true;
      await enviar("POST", "/publicar", null, "Painel enviado ✓");
      desenhar();
    });

    corpo.replaceChildren(
      el("div", { class: "aviso" + (c.publicado ? "" : " erro") },
        c.publicado ? "✅ O painel está publicado no canal escolhido."
          : pronto ? "O painel ainda não foi enviado. Clique em publicar."
            : "Escolha o modelo, o canal e a categoria para poder publicar o painel."),
      el("h2", {}, "Painel"),
      linhaSelect("🧩 Modelo do painel", "Qual modelo aparece no painel (crie na aba Modelos).", seletor(dados.modelos.map(m => ({ id: m.id, nome: m.nome })), c.modelo_id, "— escolha um modelo —"), "modelo_id"),
      linhaSelect("📢 Canal do painel", "Se trocar, o painel antigo é apagado.", seletor(dados.canais.map(x => ({ id: x.id, nome: "#" + x.nome })), c.canal_painel_id, "— escolha um canal —"), "canal_painel_id"),
      linhaSelect("📁 Categoria dos tickets", "Onde os canais dos tickets são criados.", seletor(dados.categorias, c.categoria_id, "— escolha uma categoria —"), "categoria_id"),
      linhaSelect("👥 Cargo mencionado", "Cargo avisado quando um ticket abre (opcional).", seletor(dados.cargos.map(x => ({ id: x.id, nome: "@" + x.nome })), c.cargo_mencao_id, "Nenhum"), "cargo_mencao_id"),
      linhaInterruptor("🔢 Número no nome do canal", "Ex.: ticket-0012.", "contador_nome"),
      el("div", { class: "acoes" }, botaoPublicar),
      el("h2", {}, "Extras"),
      linhaSelect("👤 Tickets por pessoa", "Quantos tickets abertos cada pessoa pode ter.", limite, "limite_tickets", v => Number(v)),
      linhaSelect("📁 Canal de transcrições", "Recebe aviso de abertura, fechamento e a transcrição.", seletor(dados.canais.map(x => ({ id: x.id, nome: "#" + x.nome })), c.canal_transcricao_id, "Nenhum"), "canal_transcricao_id"),
      linhaInterruptor("📩 Transcrição na DM do dono", "Envia a transcrição para quem abriu o ticket.", "dm_transcricao"),
      linhaInterruptor("⭐ Avaliação do atendimento", "Pede uma nota ao fechar.", "avaliacao"),
      linhaInterruptor("📝 Pedir motivo ao fechar", "Pergunta o motivo antes de fechar.", "pedir_motivo_fechar")
    );
  }

  function abaLista() {
    const ativo = dados.config.modelo_id;

    corpo.replaceChildren(
      el("p", { class: "legenda" }, `Modelos de painel (${dados.modelos.length}/${dados.maxModelos}).`),
      ...dados.modelos.map(m =>
        el("div", { class: "opcao" },
          el("div", { class: "txt" }, el("b", {}, (m.id === ativo ? "✅ " : "🧩 ") + m.nome), el("span", {}, m.id === ativo ? "Em uso no painel" : (m.titulo || "Sem título"))),
          el("div", { class: "botoes-linha" },
            el("button", { class: "botao botao-pequeno", type: "button", onclick: () => { editando = m.id; desenhar(); } }, "Editar"),
            semAtributo(el("button", {
              class: "botao botao-pequeno perigo", type: "button",
              onclick: async () => {
                if (!confirm(`Apagar o modelo "${m.nome}"?`)) return;
                if (await enviar("DELETE", `/modelos/${m.id}`, null, "Modelo apagado ✓")) desenhar();
              }
            }, "Apagar"), m.id === ativo)))),
      el("div", { class: "acoes" },
        semAtributo(el("button", {
          class: "botao", type: "button",
          onclick: () => { editando = "novo"; desenhar(); }
        }, "➕ Novo modelo"), dados.modelos.length >= dados.maxModelos))
    );
  }

  function abaEditor() {
    const novo = editando === "novo";
    const m = novo
      ? { nome: "", autor_nome: "", autor_icone: "", autor_url: "", titulo: "🎫 Abra um Ticket", titulo_url: "", descricao: "Clique no botão abaixo para abrir um ticket.", cor: "#5865F2", imagem: "", thumbnail: "", rodape: "", rodape_icone: "", botao_texto: "Fazer Ticket", botao_emoji: "", botao_estilo: "Primary", mostrar_horario: false, campos: [] }
      : dados.modelos.find(x => x.id === editando);

    if (!m) { editando = null; desenhar(); return; }

    const campos = {};

    function texto(chave, titulo, { multilinha = false, max = 256, dica = "" } = {}) {
      const campo = multilinha ? el("textarea", { rows: "4", maxlength: String(max) }) : el("input", { type: "text", maxlength: String(max) });
      campo.value = m[chave] ?? "";
      campo.addEventListener("input", previa);
      campos[chave] = () => campo.value;
      return el("label", { class: "campo" }, el("b", {}, titulo), campo, dica ? el("span", {}, dica) : "");
    }

    function interruptor(chave, titulo) {
      const caixa = el("input", { type: "checkbox", "aria-label": titulo });
      caixa.checked = !!m[chave];
      caixa.addEventListener("change", previa);
      campos[chave] = () => caixa.checked;
      return el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, titulo)), el("label", { class: "interruptor" }, caixa, el("i")));
    }

    const cor = el("input", { type: "color", "aria-label": "Cor do embed" });
    cor.value = m.cor.toLowerCase();
    cor.addEventListener("input", previa);
    campos.cor = () => cor.value.toUpperCase();

    const estilo = el("select", { "aria-label": "Cor do botão" }, ...ESTILOS_BOTAO.map(([v, n]) => el("option", { value: v }, n)));
    estilo.value = m.botao_estilo;
    campos.botao_estilo = () => estilo.value;

    // campos do embed (nome | valor | lado a lado)
    const listaCampos = el("div", { class: "lista-campos" });
    const linhasCampos = [];

    function novaLinha(c = { nome: "", valor: "", inline: false }) {
      const nome = el("input", { type: "text", maxlength: "256", placeholder: "Nome" });
      const valor = el("input", { type: "text", maxlength: "1024", placeholder: "Valor" });
      const lado = el("input", { type: "checkbox", "aria-label": "Lado a lado" });
      nome.value = c.nome; valor.value = c.valor; lado.checked = !!c.inline;
      nome.addEventListener("input", previa); valor.addEventListener("input", previa);

      const linha = el("div", { class: "linha-campo" }, nome, valor,
        el("label", { class: "lado" }, lado, " lado a lado"),
        el("button", { class: "botao botao-pequeno perigo", type: "button", "aria-label": "Remover campo", onclick: () => { linhasCampos.splice(linhasCampos.indexOf(item), 1); linha.remove(); previa(); } }, "✕"));
      const item = { ler: () => ({ nome: nome.value, valor: valor.value, inline: lado.checked }) };

      linhasCampos.push(item);
      listaCampos.append(linha);
    }

    m.campos.forEach(novaLinha);
    campos.campos = () => linhasCampos.map(i => i.ler());

    const botaoCampo = el("button", { class: "botao botao-pequeno", type: "button", onclick: () => {
      if (linhasCampos.length >= dados.maxCampos) { aviso(`No máximo ${dados.maxCampos} campos.`, true); return; }
      novaLinha(); previa();
    } }, "➕ Adicionar campo");

    const pre = el("div", { class: "previa" });

    function previa() {
      const v = k => campos[k]();
      const emb = el("div", { class: "previa-embed" });
      emb.style.borderLeftColor = v("cor");

      if (v("autor_nome").trim()) emb.append(el("div", { class: "previa-autor" }, v("autor_nome")));
      if (v("titulo").trim()) emb.append(el("b", {}, v("titulo")));
      if (v("descricao").trim()) emb.append(el("p", {}, v("descricao")));
      for (const c of v("campos")) if (c.nome.trim() && c.valor.trim()) emb.append(el("p", {}, el("b", {}, c.nome), "\n" + c.valor));
      if (v("rodape").trim() || v("mostrar_horario")) emb.append(el("small", {}, [v("rodape").trim(), v("mostrar_horario") ? "agora" : ""].filter(Boolean).join(" • ")));

      pre.replaceChildren(el("small", { class: "legenda" }, "Prévia"), emb,
        el("div", {}, el("span", { class: "previa-botao " + v("botao_estilo").toLowerCase() }, `${v("botao_emoji") ? v("botao_emoji") + " " : ""}${v("botao_texto") || "Fazer Ticket"}`)));
    }

    const salvar = el("button", { class: "botao", type: "button" }, novo ? "➕ Criar modelo" : "💾 Salvar");

    salvar.addEventListener("click", async () => {
      const dadosForm = {};
      for (const [k, f] of Object.entries(campos)) dadosForm[k] = f();

      salvar.disabled = true;

      const ok = novo
        ? await enviar("POST", "/modelos", dadosForm, "Modelo criado ✓")
        : await enviar("PUT", `/modelos/${editando}`, dadosForm, dadosForm && dados.config.modelo_id === editando ? "Salvo e painel atualizado ✓" : "Salvo ✓");

      salvar.disabled = false;

      if (ok) { editando = null; desenhar(); }
    });

    corpo.replaceChildren(
      el("button", { class: "link", type: "button", onclick: () => { editando = null; desenhar(); } }, "← Modelos"),
      el("h2", {}, novo ? "Novo modelo" : "Editar modelo"),
      texto("nome", "Nome do modelo (só para você)", { max: 100 }),
      texto("autor_nome", "Autor"),
      texto("autor_icone", "Ícone do autor (link)", { max: 1000 }),
      texto("autor_url", "Link do autor", { max: 1000 }),
      texto("titulo", "Título"),
      texto("titulo_url", "Link do título", { max: 1000 }),
      texto("descricao", "Descrição", { multilinha: true, max: 4000 }),
      el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "🎨 Cor do embed")), cor),
      texto("imagem", "Imagem grande (link)", { max: 1000 }),
      texto("thumbnail", "Miniatura (link)", { max: 1000 }),
      texto("rodape", "Rodapé", { max: 2048 }),
      texto("rodape_icone", "Ícone do rodapé (link)", { max: 1000 }),
      interruptor("mostrar_horario", "Mostrar data e hora"),
      el("h2", {}, "Campos"),
      listaCampos, botaoCampo,
      el("h2", {}, "Botão"),
      texto("botao_texto", "Texto do botão", { max: 80 }),
      texto("botao_emoji", "Emoji do botão", { max: 100, dica: "Um emoji normal ou um personalizado como <:nome:123456789012345678>." }),
      el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "Cor do botão")), estilo),
      pre,
      el("div", { class: "acoes" }, salvar)
    );

    estilo.addEventListener("change", previa);
    previa();
  }

  alvo.replaceChildren(
    el("p", { class: "legenda" }, "O mesmo sistema do /ticket, agora aqui no site."),
    abas, corpo
  );

  desenhar();
}


// ---------- Reaction Role ----------

async function secaoReactRole(id, servidor, alvo) {
  const base = `/api/guilds/${id}/reactroles`;
  let dados = await chamar(base);
  let editando = null; // null = lista | "novo" | id da configuração

  async function enviar(metodo, caminho, corpo, ok) {
    try {
      dados = await chamar(base + caminho, { method: metodo, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });

      const avisos = dados.resultado?.avisos || [];

      if (avisos.length) aviso(avisos[0], true);
      else aviso(ok);

      return true;
    } catch (e) {
      aviso(e.message, true);
      return false;
    }
  }

  const nomeCargo = cid => dados.cargos.find(c => c.id === cid)?.nome || "cargo apagado";
  const nomeCanal = cid => dados.canais.find(c => c.id === cid)?.nome || "canal desconhecido";

  function lista() {
    alvo.replaceChildren(
      el("p", { class: "legenda" }, "Mensagens em que quem reage ganha um cargo. É o mesmo sistema do /reactrole."),
      ...(dados.lista.length ? [] : [el("div", { class: "aviso" }, "Nenhuma mensagem de Reaction Role ainda.")]),
      ...dados.lista.map(c => {
        const resumo = c.somente_reacoes ? "Mensagem já existente no servidor"
          : (c.embed_titulo || c.content || "Sem título").slice(0, 60);

        return el("div", { class: "opcao rr-item" },
          el("div", { class: "txt" },
            el("b", {}, `${c.habilitado ? "🎭" : "⏸️"} ${resumo}`),
            el("span", {}, `#${nomeCanal(c.canal_id)} • ` + c.cargos.map(x => `${x.emoji.includes(":") ? "⭐" : x.emoji} ${nomeCargo(x.cargo_id)}`).join(" • ")),
            el("a", { href: `https://discord.com/channels/${id}/${c.canal_id}/${c.mensagem_id}`, target: "_blank", rel: "noopener noreferrer" }, "Abrir mensagem no Discord")),
          el("div", { class: "botoes-linha" },
            el("button", { class: "botao botao-pequeno", type: "button", onclick: () => { editando = c.id; editor(); } }, "Editar"),
            el("button", {
              class: "botao botao-pequeno perigo", type: "button",
              onclick: async () => {
                if (!confirm(c.somente_reacoes
                  ? "Remover esta configuração? A mensagem NÃO será apagada, só as reações do bot."
                  : "Apagar a mensagem no Discord e esta configuração?")) return;
                if (await enviar("DELETE", `/${c.id}`, null, "Apagado ✓")) lista();
              }
            }, "Apagar")));
      }),
      el("div", { class: "acoes" }, el("button", { class: "botao", type: "button", onclick: () => { editando = "novo"; editor(); } }, "➕ Nova mensagem"))
    );
  }

  function editor() {
    const novo = editando === "novo";
    const c = novo
      ? { modo: "nova", canal_id: "", mensagem_id: "", somente_reacoes: false, habilitado: true, content: "", embed_habilitado: true, embed_titulo: "🎭 Escolha seus cargos", embed_url: "", embed_descricao: "Reaja para receber o cargo.", embed_cor: "#5865F2", embed_autor_nome: "", embed_autor_icone: "", imagem: "", thumbnail: "", footer_habilitado: false, footer_texto: "", footer_icone: "", embed_timestamp: false, embed_campos: [], cargos: [] }
      : { ...dados.lista.find(x => x.id === editando) };

    if (!c.id && !novo) { editando = null; lista(); return; }

    const campos = {};
    const modo = el("select", { "aria-label": "Tipo de mensagem" },
      el("option", { value: "nova" }, "Criar uma mensagem nova"),
      el("option", { value: "existente" }, "Usar uma mensagem que já existe"));
    modo.value = c.somente_reacoes ? "existente" : "nova";

    const canal = el("select", { "aria-label": "Canal" }, el("option", { value: "" }, "— escolha um canal —"),
      ...dados.canais.map(x => el("option", { value: x.id }, "#" + x.nome)));
    canal.value = c.canal_id || "";
    if (!novo) canal.disabled = true;

    const idMsg = el("input", { type: "text", inputmode: "numeric", placeholder: "ID da mensagem", maxlength: "20" });
    idMsg.value = c.mensagem_id || "";
    if (!novo) idMsg.disabled = true;

    const blocoMsg = el("div", {});
    const caixaExistente = el("div", {});

    function texto(chave, titulo, { multilinha = false, max = 256, dica = "" } = {}) {
      const campo = multilinha ? el("textarea", { rows: "4", maxlength: String(max) }) : el("input", { type: "text", maxlength: String(max) });
      campo.value = c[chave] ?? "";
      campo.addEventListener("input", previa);
      campos[chave] = () => campo.value;
      return el("label", { class: "campo" }, el("b", {}, titulo), campo, dica ? el("span", {}, dica) : "");
    }

    function interruptor(chave, titulo) {
      const caixa = el("input", { type: "checkbox", "aria-label": titulo });
      caixa.checked = !!c[chave];
      caixa.addEventListener("change", previa);
      campos[chave] = () => caixa.checked;
      return el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, titulo)), el("label", { class: "interruptor" }, caixa, el("i")));
    }

    const cor = el("input", { type: "color", "aria-label": "Cor do embed" });
    cor.value = c.embed_cor.toLowerCase();
    cor.addEventListener("input", previa);
    campos.embed_cor = () => cor.value.toUpperCase();

    // campos extras do embed
    const listaCampos = el("div", { class: "lista-campos" });
    const linhasCampos = [];

    function novaLinhaCampo(x = { nome: "", valor: "", inline: false }) {
      const nome = el("input", { type: "text", maxlength: "256", placeholder: "Nome" });
      const valor = el("input", { type: "text", maxlength: "1024", placeholder: "Valor" });
      const lado = el("input", { type: "checkbox", "aria-label": "Lado a lado" });
      nome.value = x.nome; valor.value = x.valor; lado.checked = !!x.inline;
      nome.addEventListener("input", previa); valor.addEventListener("input", previa);
      const item = { ler: () => ({ nome: nome.value, valor: valor.value, inline: lado.checked }) };
      const linha = el("div", { class: "linha-campo" }, nome, valor, el("label", { class: "lado" }, lado, " lado a lado"),
        el("button", { class: "botao botao-pequeno perigo", type: "button", "aria-label": "Remover campo", onclick: () => { linhasCampos.splice(linhasCampos.indexOf(item), 1); linha.remove(); previa(); } }, "✕"));
      linhasCampos.push(item);
      listaCampos.append(linha);
    }

    c.embed_campos.forEach(novaLinhaCampo);
    campos.embed_campos = () => linhasCampos.map(i => i.ler());

    // reações e cargos
    const listaPares = el("div", { class: "lista-campos" });
    const pares = [];

    function novoPar(x = { emoji: "", cargo_id: "" }) {
      const emoji = el("input", { type: "text", maxlength: "60", placeholder: "Emoji", "aria-label": "Emoji" });
      emoji.value = x.emoji && x.emoji.includes(":") && !x.emoji.startsWith("<") ? `<:${x.emoji}>` : x.emoji;
      const cargo = el("select", { "aria-label": "Cargo" }, el("option", { value: "" }, "— cargo —"),
        ...dados.cargos.map(r => { const o = el("option", { value: r.id }, "@" + r.nome + (r.gerenciavel ? "" : " (acima do bot)")); o.disabled = !r.gerenciavel; return o; }));
      cargo.value = x.cargo_id;
      const item = { ler: () => ({ emoji: emoji.value, cargo_id: cargo.value }) };
      const linha = el("div", { class: "linha-par" }, emoji, cargo,
        el("button", { class: "botao botao-pequeno perigo", type: "button", "aria-label": "Remover reação", onclick: () => { pares.splice(pares.indexOf(item), 1); linha.remove(); } }, "✕"));
      pares.push(item);
      listaPares.append(linha);
    }

    c.cargos.forEach(novoPar);
    if (!pares.length) novoPar();

    const pre = el("div", { class: "previa" });

    function previa() {
      if (c.somente_reacoes || modo.value === "existente") { pre.replaceChildren(); return; }

      const v = k => campos[k]();
      const parts = [];

      if (v("content").trim()) parts.push(el("p", { class: "previa-texto" }, v("content")));

      if (v("embed_habilitado")) {
        const emb = el("div", { class: "previa-embed" });
        emb.style.borderLeftColor = v("embed_cor");
        if (v("embed_autor_nome").trim()) emb.append(el("div", { class: "previa-autor" }, v("embed_autor_nome")));
        if (v("embed_titulo").trim()) emb.append(el("b", {}, v("embed_titulo")));
        if (v("embed_descricao").trim()) emb.append(el("p", {}, v("embed_descricao")));
        for (const x of v("embed_campos")) if (x.nome.trim() && x.valor.trim()) emb.append(el("p", {}, el("b", {}, x.nome), "\n" + x.valor));
        if (v("footer_habilitado") && v("footer_texto").trim()) emb.append(el("small", {}, v("footer_texto")));
        parts.push(emb);
      }

      pre.replaceChildren(el("small", { class: "legenda" }, "Prévia"), ...parts);
    }

    blocoMsg.append(
      texto("content", "Texto fora do embed", { multilinha: true, max: 2000 }),
      interruptor("embed_habilitado", "Usar embed"),
      el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "🎨 Cor do embed")), cor),
      texto("embed_titulo", "Título"),
      texto("embed_url", "Link do título", { max: 1000 }),
      texto("embed_descricao", "Descrição", { multilinha: true, max: 4000 }),
      texto("embed_autor_nome", "Autor"),
      texto("embed_autor_icone", "Ícone do autor (link)", { max: 1000 }),
      texto("imagem", "Imagem grande (link)", { max: 1000 }),
      texto("thumbnail", "Miniatura (link)", { max: 1000 }),
      interruptor("footer_habilitado", "Mostrar rodapé"),
      texto("footer_texto", "Texto do rodapé", { max: 2048 }),
      texto("footer_icone", "Ícone do rodapé (link)", { max: 1000 }),
      interruptor("embed_timestamp", "Mostrar data e hora"),
      el("h2", {}, "Campos"),
      listaCampos,
      el("button", { class: "botao botao-pequeno", type: "button", onclick: () => {
        if (linhasCampos.length >= dados.maxCampos) { aviso(`No máximo ${dados.maxCampos} campos.`, true); return; }
        novaLinhaCampo(); previa();
      } }, "➕ Adicionar campo"),
      pre
    );

    caixaExistente.append(el("label", { class: "campo" }, el("b", {}, "ID da mensagem"), idMsg,
      el("span", {}, "No Discord: clique com o botão direito na mensagem → Copiar ID da mensagem. O bot só põe as reações; o texto fica como está.")));

    function alternar() {
      const existente = modo.value === "existente";
      blocoMsg.hidden = existente || c.somente_reacoes;
      caixaExistente.hidden = !(existente && novo);
      previa();
    }

    modo.addEventListener("change", alternar);
    if (!novo) modo.disabled = true;

    const habilitado = el("input", { type: "checkbox", "aria-label": "Ativo" });
    habilitado.checked = !!c.habilitado;

    const salvar = el("button", { class: "botao", type: "button" }, novo ? "➕ Criar e enviar" : "💾 Salvar");

    salvar.addEventListener("click", async () => {
      const existente = modo.value === "existente" || c.somente_reacoes;
      const corpo = { cargos: pares.map(p => p.ler()).filter(p => p.emoji.trim() || p.cargo_id) };

      if (!existente) for (const [k, f] of Object.entries(campos)) corpo[k] = f();

      if (novo) {
        corpo.modo = modo.value;
        corpo.canal_id = canal.value;
        if (existente) corpo.mensagem_id = idMsg.value.trim();
      } else {
        corpo.habilitado = habilitado.checked;
      }

      salvar.disabled = true;

      const ok = novo
        ? await enviar("POST", "", corpo, "Criado ✓")
        : await enviar("PUT", `/${editando}`, corpo, "Salvo ✓");

      salvar.disabled = false;

      if (ok) { editando = null; lista(); }
    });

    alvo.replaceChildren(
      el("button", { class: "link", type: "button", onclick: () => { editando = null; lista(); } }, "← Mensagens"),
      el("h2", {}, novo ? "Nova mensagem de Reaction Role" : "Editar Reaction Role"),
      ...(novo ? [el("label", { class: "campo" }, el("b", {}, "Tipo"), modo), el("label", { class: "campo" }, el("b", {}, "Canal"), canal)] : [el("p", { class: "legenda" }, `Canal: #${nomeCanal(c.canal_id)}`)]),
      ...(novo ? [] : [el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "Ativo"), el("span", {}, "Desligado, as reações não dão cargo.")), el("label", { class: "interruptor" }, habilitado, el("i")))]),
      caixaExistente,
      blocoMsg,
      el("h2", {}, "Reações e cargos"),
      el("p", { class: "legenda" }, "Um emoji normal (🎮) ou personalizado no formato <:nome:123456789012345678>. Até " + dados.maxPares + " reações."),
      listaPares,
      el("button", { class: "botao botao-pequeno", type: "button", onclick: () => {
        if (pares.length >= dados.maxPares) { aviso(`No máximo ${dados.maxPares} reações.`, true); return; }
        novoPar();
      } }, "➕ Adicionar reação"),
      el("div", { class: "acoes" }, salvar)
    );

    alternar();
  }

  lista();
}


// ---------- Logs ----------

async function secaoLogs(id, alvo) {
  const base = `/api/guilds/${id}/logs`;
  let dados = await chamar(base);

  async function salvar(tipos) {
    try {
      dados = await chamar(base, { method: "PUT", body: JSON.stringify({ tipos }) });
      aviso("Salvo ✓");
      return true;
    } catch (e) {
      aviso(e.message, true);
      return false;
    }
  }

  function seletor(valor, vazio) {
    const sel = el("select", {}, el("option", { value: "" }, vazio),
      ...dados.canais.map(c => el("option", { value: c.id }, "#" + c.nome)));
    sel.value = valor || "";
    return sel;
  }

  function desenhar() {
    alvo.replaceChildren(
      el("p", { class: "legenda" }, "Escolha o canal de cada log. Sem canal, aquele log fica desligado. As mudanças são salvas na hora."),
      ...dados.grupos.map(g => {
        const todos = seletor("", "Mesmo canal para todos…");

        todos.addEventListener("change", async () => {
          if (!todos.value) return;

          const tipos = {};
          for (const i of g.itens) tipos[i.tipo] = todos.value;

          await salvar(tipos);
          desenhar();
        });

        return el("div", { class: "grupo-log" },
          el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, g.nome)), todos),
          ...g.itens.map(i => {
            const sel = seletor(i.canal_id, "Desligado");
            let atual = sel.value;

            sel.addEventListener("change", async () => {
              const anterior = atual;
              atual = sel.value;

              if (!(await salvar({ [i.tipo]: sel.value || null }))) { sel.value = anterior; atual = anterior; }
            });

            return el("div", { class: "opcao sub" }, el("div", { class: "txt" }, el("b", {}, i.nome), el("span", {}, i.descricao)), sel);
          }));
      })
    );
  }

  desenhar();
}


// ---------- Sorteios ----------

async function secaoSorteios(id, alvo) {
  const base = `/api/guilds/${id}/sorteios`;
  let dados = await chamar(base);
  let editando = null; // null = lista | "novo" | id

  async function enviar(metodo, caminho, corpo, ok) {
    try {
      dados = await chamar(base + caminho, { method: metodo, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
      aviso(dados.resultado?.aviso || ok, !!dados.resultado?.aviso);
      return true;
    } catch (e) {
      aviso(e.message, true);
      return false;
    }
  }

  const nomeCanal = cid => dados.canais.find(c => c.id === cid)?.nome || "canal desconhecido";
  const paraInput = d => d.split("/").reverse().join("-"); // dd/mm/aaaa -> aaaa-mm-dd
  const deInput = v => v.split("-").reverse().join("/");

  function lista() {
    alvo.replaceChildren(
      el("p", { class: "legenda" }, "Sorteios do servidor. O horário de encerramento é o de Brasília."),
      ...(dados.lista.length ? [] : [el("div", { class: "aviso" }, "Nenhum sorteio ainda.")]),
      ...dados.lista.map(s => {
        const detalhe = s.encerrado
          ? `Encerrado • ${s.inscritos} inscrito(s) • ${s.vencedores_ids.length} vencedor(es)`
          : `Termina em ${s.data} às ${s.horario} • ${s.inscritos} inscrito(s) • ${s.vencedores} vencedor(es)`;

        const botoes = [];

        if (!s.encerrado) {
          botoes.push(
            el("button", { class: "botao botao-pequeno", type: "button", onclick: () => { editando = s.id; editor(); } }, "Editar"),
            el("button", {
              class: "botao botao-pequeno perigo", type: "button",
              onclick: async () => {
                if (!confirm("Encerrar este sorteio agora e sortear os vencedores?")) return;
                if (await enviar("POST", `/${s.id}/encerrar`, null, "Sorteio encerrado ✓")) lista();
              }
            }, "Encerrar agora"));
        } else {
          botoes.push(el("button", {
            class: "botao botao-pequeno", type: "button",
            onclick: async () => {
              if (!confirm("Sortear de novo? Só entram quem ainda não foi sorteado nesta rodada.")) return;
              if (await enviar("POST", `/${s.id}/sortear`, null, "Novo sorteio feito ✓")) lista();
            }
          }, "Sortear de novo"));
        }

        return el("div", { class: "opcao rr-item" },
          el("div", { class: "txt" },
            el("b", {}, `${s.encerrado ? "🏁" : "🎉"} ${s.titulo}`),
            el("span", {}, `#${nomeCanal(s.canal_id)} • ${detalhe}`),
            el("a", { href: `https://discord.com/channels/${id}/${s.canal_id}/${s.mensagem_id}`, target: "_blank", rel: "noopener noreferrer" }, "Abrir no Discord")),
          el("div", { class: "botoes-linha" }, ...botoes));
      }),
      el("div", { class: "acoes" }, el("button", { class: "botao", type: "button", onclick: () => { editando = "novo"; editor(); } }, "➕ Novo sorteio"))
    );
  }

  function editor() {
    const novo = editando === "novo";
    const s = novo
      ? { canal_id: "", titulo: "", descricao: "", premio: "", cor: "#5865F2", vencedores: 1, data: "", horario: "", mostrar_participantes: false, autor_nome: "", autor_icone: "", imagem: "", thumbnail: "", rodape: "", rodape_icone: "" }
      : dados.lista.find(x => x.id === editando);

    if (!s) { editando = null; lista(); return; }

    const campos = {};

    function texto(chave, titulo, { multilinha = false, max = 256, dica = "" } = {}) {
      const campo = multilinha ? el("textarea", { rows: "4", maxlength: String(max) }) : el("input", { type: "text", maxlength: String(max) });
      campo.value = s[chave] ?? "";
      campo.addEventListener("input", previa);
      campos[chave] = () => campo.value;
      return el("label", { class: "campo" }, el("b", {}, titulo), campo, dica ? el("span", {}, dica) : "");
    }

    function interruptor(chave, titulo, desc) {
      const caixa = el("input", { type: "checkbox", "aria-label": titulo });
      caixa.checked = !!s[chave];
      campos[chave] = () => caixa.checked;
      return el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, titulo), desc ? el("span", {}, desc) : ""), el("label", { class: "interruptor" }, caixa, el("i")));
    }

    const canal = el("select", { "aria-label": "Canal" }, el("option", { value: "" }, "— escolha um canal —"),
      ...dados.canais.map(x => el("option", { value: x.id }, "#" + x.nome)));
    canal.value = s.canal_id || "";
    if (!novo) canal.disabled = true;

    const cor = el("input", { type: "color", "aria-label": "Cor do embed" });
    cor.value = s.cor.toLowerCase();
    cor.addEventListener("input", previa);
    campos.cor = () => cor.value.toUpperCase();

    const venc = el("input", { type: "number", min: "1", max: "20", step: "1", "aria-label": "Vencedores" });
    venc.value = String(s.vencedores);
    campos.vencedores = () => Number(venc.value);

    const data = el("input", { type: "date", "aria-label": "Data de encerramento" });
    data.value = s.data ? paraInput(s.data) : "";
    const hora = el("input", { type: "time", "aria-label": "Horário de encerramento" });
    hora.value = s.horario || "";

    const pre = el("div", { class: "previa" });

    function previa() {
      const v = k => campos[k]();
      const emb = el("div", { class: "previa-embed" });
      emb.style.borderLeftColor = v("cor");

      if (v("autor_nome").trim()) emb.append(el("div", { class: "previa-autor" }, v("autor_nome")));
      emb.append(el("b", {}, v("titulo") || "Título do sorteio"));
      emb.append(el("p", {}, v("descricao") || "Descrição do sorteio"));
      if (v("premio").trim()) emb.append(el("p", {}, el("b", {}, "Prêmio"), "\n" + v("premio")));
      if (v("rodape").trim()) emb.append(el("small", {}, v("rodape")));

      pre.replaceChildren(el("small", { class: "legenda" }, "Prévia (a mensagem real tem o botão de participar)"), emb);
    }

    const salvar = el("button", { class: "botao", type: "button" }, novo ? "🎉 Criar e enviar" : "💾 Salvar");

    salvar.addEventListener("click", async () => {
      if (!data.value || !hora.value) { aviso("Escolha a data e o horário de encerramento.", true); return; }

      const corpo = {};
      for (const [k, f] of Object.entries(campos)) corpo[k] = f();

      corpo.data = deInput(data.value);
      corpo.horario = hora.value;

      if (novo) corpo.canal_id = canal.value;

      salvar.disabled = true;

      const ok = novo ? await enviar("POST", "", corpo, "Sorteio enviado ✓") : await enviar("PUT", `/${editando}`, corpo, "Salvo ✓");

      salvar.disabled = false;

      if (ok) { editando = null; lista(); }
    });

    alvo.replaceChildren(
      el("button", { class: "link", type: "button", onclick: () => { editando = null; lista(); } }, "← Sorteios"),
      el("h2", {}, novo ? "Novo sorteio" : "Editar sorteio"),
      ...(novo ? [el("label", { class: "campo" }, el("b", {}, "Canal"), canal)] : [el("p", { class: "legenda" }, `Canal: #${nomeCanal(s.canal_id)}`)]),
      texto("titulo", "Título"),
      texto("descricao", "Descrição", { multilinha: true, max: 4000 }),
      texto("premio", "Prêmio", { max: 1024 }),
      el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "🏆 Vencedores"), el("span", {}, "De 1 a 20.")), venc),
      el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "📅 Data de encerramento")), data),
      el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "⏰ Horário (Brasília)")), hora),
      interruptor("mostrar_participantes", "Botão para ver os participantes"),
      ...(novo ? [interruptor("marcar_everyone", "Marcar @everyone", "O bot precisa da permissão de mencionar @everyone no canal.")] : []),
      el("div", { class: "opcao" }, el("div", { class: "txt" }, el("b", {}, "🎨 Cor do embed")), cor),
      texto("autor_nome", "Autor"),
      texto("autor_icone", "Ícone do autor (link)", { max: 1000 }),
      texto("imagem", "Imagem grande (link)", { max: 1000 }),
      texto("thumbnail", "Miniatura (link)", { max: 1000 }),
      texto("rodape", "Rodapé", { max: 2048 }),
      texto("rodape_icone", "Ícone do rodapé (link)", { max: 1000 }),
      pre,
      el("div", { class: "acoes" }, salvar)
    );

    previa();
  }

  lista();
}

// ---------- Criar Call ----------

async function secaoCriarCall(id, alvo) {
  const base = `/api/guilds/${id}/criarcall`;
  let d = await chamar(base);

  const campos = {};

  function texto(chave, titulo, { multilinha = false, max = 256, dica = "", ph = "" } = {}) {
    const campo = multilinha
      ? el("textarea", { rows: "3", maxlength: String(max) })
      : el("input", { type: "text", maxlength: String(max) });
    campo.value = d[chave] ?? "";
    if (ph) campo.placeholder = ph;
    campo.addEventListener("input", previa);
    campos[chave] = () => campo.value;
    return el("label", { class: "campo" }, el("b", {}, titulo), campo, dica ? el("span", {}, dica) : "");
  }

  function seletor(chave, titulo, lista, vazio, dica) {
    const sel = el("select", { "aria-label": titulo }, el("option", { value: "" }, vazio),
      ...lista.map(c => el("option", { value: c.id }, (chave === "canal_id" ? "#" : "") + c.nome)));
    sel.value = d[chave] || "";
    campos[chave] = () => sel.value || null;
    return el("label", { class: "campo" }, el("b", {}, titulo), sel, dica ? el("span", {}, dica) : "");
  }

  const categoria = seletor("categoria_id", "Categoria das calls", d.categorias, "— sem categoria —", "Onde as calls temporárias serão criadas.");
  const canal = seletor("canal_id", "Canal do painel", d.canais, "— escolha um canal —", "Onde a mensagem com os botões fica.");

  const cor = el("input", { type: "color", "aria-label": "Cor do embed" });
  cor.value = d.embed_cor.toLowerCase();
  cor.addEventListener("input", previa);
  campos.embed_cor = () => cor.value.toUpperCase();

  const emojis = {};
  const gradeEmojis = el("div", { class: "grade-emoji" },
    ...Object.entries(d.emojis).map(([k, e]) => {
      const campo = el("input", { type: "text", maxlength: "64", placeholder: e.padrao });
      campo.value = e.valor === e.padrao ? "" : e.valor;
      campo.addEventListener("input", previa);
      emojis[k] = () => campo.value.trim() || e.padrao;
      return el("label", { class: "campo" }, el("b", {}, e.nome), campo);
    }));

  const caixaPrevia = el("div", { class: "previa" });

  function previa() {
    const emb = el("div", { class: "previa-embed" });
    emb.style.borderLeftColor = campos.embed_cor();

    if (campos.embed_titulo().trim()) emb.append(el("b", {}, campos.embed_titulo()));
    if (campos.embed_descricao().trim()) emb.append(el("p", {}, campos.embed_descricao()));
    if (campos.embed_rodape().trim()) emb.append(el("small", {}, campos.embed_rodape()));

    const botoes = el("div", { class: "previa-botoes" },
      ...Object.entries(d.emojis).map(([k, e]) => el("span", { class: "previa-botao" }, `${emojis[k]()} ${e.nome}`)));

    caixaPrevia.replaceChildren(emb, botoes);
  }

  const titulo = texto("embed_titulo", "Título", { max: 256 });
  const descricao = texto("embed_descricao", "Descrição", { multilinha: true, max: 4096 });
  const rodape = texto("embed_rodape", "Rodapé", { max: 2048 });
  const rodapeIcone = texto("embed_rodape_icone", "Ícone do rodapé (link)", { max: 500, ph: "https://…" });
  const thumb = texto("embed_thumbnail", "Miniatura (link)", { max: 500, ph: "https://…" });
  const imagem = texto("embed_imagem", "Imagem grande (link)", { max: 500, ph: "https://…" });

  const status = el("p", { class: "legenda" });

  function atualizarStatus() {
    status.textContent = d.publicado ? "✅ O painel já está publicado no canal escolhido." : "⚠️ O painel ainda não foi publicado.";
  }

  function montar() {
    const emojisPayload = {};
    for (const k of Object.keys(emojis)) emojisPayload[k] = emojis[k]();

    return {
      categoria_id: campos.categoria_id(),
      canal_id: campos.canal_id(),
      embed_titulo: campos.embed_titulo(),
      embed_descricao: campos.embed_descricao(),
      embed_cor: campos.embed_cor(),
      embed_rodape: campos.embed_rodape(),
      embed_rodape_icone: campos.embed_rodape_icone(),
      embed_thumbnail: campos.embed_thumbnail(),
      embed_imagem: campos.embed_imagem(),
      emojis: emojisPayload
    };
  }

  const salvar = el("button", { class: "botao", type: "button" }, "💾 Salvar");
  const publicar = el("button", { class: "botao botao-claro", type: "button" }, "📤 Publicar / atualizar painel");

  async function enviar(botao, caminho, metodo, ok) {
    botao.disabled = true;

    try {
      d = await chamar(caminho, { method: metodo, body: metodo === "PUT" ? JSON.stringify(montar()) : undefined });
      atualizarStatus();
      aviso(ok);
    } catch (e) {
      aviso(e.message, true);
    } finally {
      botao.disabled = false;
    }
  }

  salvar.addEventListener("click", () => {
    if (!campos.canal_id()) { aviso("Escolha o canal do painel antes de salvar.", true); return; }
    enviar(salvar, base, "PUT", "Salvo ✓ (o painel publicado também foi atualizado)");
  });

  publicar.addEventListener("click", async () => {
    if (!campos.canal_id()) { aviso("Escolha o canal do painel primeiro.", true); return; }

    publicar.disabled = true;

    try {
      d = await chamar(base, { method: "PUT", body: JSON.stringify(montar()) });
      d = await chamar(`${base}/publicar`, { method: "POST" });
      atualizarStatus();
      aviso("Painel publicado ✓");
    } catch (e) {
      aviso(e.message, true);
    } finally {
      publicar.disabled = false;
    }
  });

  alvo.replaceChildren(
    el("p", { class: "legenda" }, "A mesma configuração do antigo /criarcall, agora aqui no site. Os membros criam a call pelos botões do painel."),
    status,
    el("div", { class: "grade-campos" }, categoria, canal),
    titulo, descricao,
    el("label", { class: "campo" }, el("b", {}, "Cor"), cor),
    rodape, rodapeIcone, thumb, imagem,
    el("h2", {}, "Emojis dos botões"),
    el("p", { class: "legenda" }, "Deixe em branco para usar o padrão. Aceita emoji comum ou personalizado (<:nome:id>)."),
    gradeEmojis,
    el("h2", {}, "Prévia"),
    caixaPrevia,
    el("div", { class: "acoes" }, salvar, publicar)
  );

  atualizarStatus();
  previa();
}


// ---------- Embeds ----------

async function secaoEmbeds(id, alvo) {
  const base = `/api/guilds/${id}/embeds`;
  let d = await chamar(base);

  function lista() {
    alvo.replaceChildren(
      el("p", { class: "legenda" }, "Crie mensagens com embed e envie para qualquer canal. É o antigo /embed, agora aqui no site."),
      el("div", { class: "acoes-topo" },
        el("button", { class: "botao botao-pequeno", type: "button", onclick: () => editor(null) }, "➕ Novo embed")),
      ...(d.embeds.length ? d.embeds.map(cartao) : [el("div", { class: "aviso" }, "Nenhum embed ainda. Clique em “Novo embed”.")])
    );
  }

  function cartao(e) {
    const canal = d.canais.find(c => c.id === e.canal_id);

    const apagar = el("button", { class: "botao botao-pequeno botao-claro", type: "button" }, "🗑️ Apagar");
    apagar.addEventListener("click", async () => {
      if (!confirm(`Apagar o embed “${e.nome}”? A mensagem no Discord também será apagada.`)) return;

      apagar.disabled = true;

      try {
        d = await chamar(`${base}/${e.id}`, { method: "DELETE" });
        aviso("Embed apagado ✓");
        lista();
      } catch (er) {
        apagar.disabled = false;
        aviso(er.message, true);
      }
    });

    return el("div", { class: "cartao-embed" },
      el("div", { class: "txt" },
        el("b", {}, e.nome),
        el("span", {}, [e.titulo || e.descricao.slice(0, 60) || "(sem título)", canal ? ` • #${canal.nome}` : " • canal removido"].join(""))),
      el("div", { class: "acoes-cartao" },
        e.link ? el("a", { class: "botao botao-pequeno botao-claro", href: e.link, target: "_blank", rel: "noopener noreferrer" }, "Abrir") : "",
        el("button", { class: "botao botao-pequeno", type: "button", onclick: () => editor(e) }, "✏️ Editar"),
        apagar));
  }

  function editor(e) {
    const novo = !e;
    const v = e || {
      nome: "Embed", mensagem: "", titulo: "", titulo_url: "", descricao: "", cor: "#5865F2", imagem: "", thumbnail: "",
      autor: "", autor_icone: "", autor_url: "", rodape: "", rodape_icone: "", timestamp: false, campos: [], botoes: [], canal_id: null
    };

    const ler = {};

    function txt(chave, titulo, { multi = false, max = 256, ph = "" } = {}) {
      const c = multi ? el("textarea", { rows: "4", maxlength: String(max) }) : el("input", { type: "text", maxlength: String(max) });
      c.value = v[chave] ?? "";
      if (ph) c.placeholder = ph;
      c.addEventListener("input", previa);
      ler[chave] = () => c.value;
      return el("label", { class: "campo" }, el("b", {}, titulo), c);
    }

    const canal = el("select", { "aria-label": "Canal" }, el("option", { value: "" }, "— escolha um canal —"),
      ...d.canais.map(c => el("option", { value: c.id }, "#" + c.nome)));
    canal.value = v.canal_id || "";
    ler.canal_id = () => canal.value || null;

    const cor = el("input", { type: "color", "aria-label": "Cor" });
    cor.value = v.cor.toLowerCase();
    cor.addEventListener("input", previa);
    ler.cor = () => cor.value.toUpperCase();

    const hora = el("input", { type: "checkbox", "aria-label": "Mostrar horário" });
    hora.checked = !!v.timestamp;
    hora.addEventListener("change", previa);
    ler.timestamp = () => hora.checked;

    // ----- campos -----
    let campos = v.campos.map(c => ({ ...c }));
    const caixaCampos = el("div", {});

    function desenharCampos() {
      caixaCampos.replaceChildren(...campos.map((c, i) => {
        const n = el("input", { type: "text", maxlength: "256", placeholder: "Nome" });
        const val = el("textarea", { rows: "2", maxlength: "1024", placeholder: "Valor" });
        const inl = el("input", { type: "checkbox", "aria-label": "Lado a lado" });
        n.value = c.nome; val.value = c.valor; inl.checked = !!c.inline;
        n.addEventListener("input", () => { c.nome = n.value; previa(); });
        val.addEventListener("input", () => { c.valor = val.value; previa(); });
        inl.addEventListener("change", () => { c.inline = inl.checked; previa(); });

        return el("div", { class: "linha-item" }, n, val,
          el("label", { class: "mini" }, inl, " lado a lado"),
          el("button", { class: "botao botao-pequeno botao-claro", type: "button", "aria-label": "Remover campo",
            onclick: () => { campos.splice(i, 1); desenharCampos(); previa(); } }, "✕"));
      }));
    }

    const addCampo = el("button", { class: "botao botao-pequeno botao-claro", type: "button", onclick: () => {
      if (campos.length >= d.maxCampos) return aviso(`O máximo é ${d.maxCampos} campos.`, true);
      campos.push({ nome: "", valor: "", inline: false }); desenharCampos(); previa();
    } }, "➕ Adicionar campo");

    // ----- botões de link -----
    let botoes = v.botoes.map(b => ({ ...b }));
    const caixaBotoes = el("div", {});

    function desenharBotoes() {
      caixaBotoes.replaceChildren(...botoes.map((b, i) => {
        const t = el("input", { type: "text", maxlength: "80", placeholder: "Texto do botão" });
        const u = el("input", { type: "text", maxlength: "512", placeholder: "https://…" });
        const em = el("input", { type: "text", maxlength: "64", placeholder: "Emoji (opcional)" });
        t.value = b.texto; u.value = b.url; em.value = b.emoji || "";
        t.addEventListener("input", () => { b.texto = t.value; previa(); });
        u.addEventListener("input", () => { b.url = u.value; });
        em.addEventListener("input", () => { b.emoji = em.value; previa(); });

        return el("div", { class: "linha-item" }, t, u, em,
          el("button", { class: "botao botao-pequeno botao-claro", type: "button", "aria-label": "Remover botão",
            onclick: () => { botoes.splice(i, 1); desenharBotoes(); previa(); } }, "✕"));
      }));
    }

    const addBotao = el("button", { class: "botao botao-pequeno botao-claro", type: "button", onclick: () => {
      if (botoes.length >= d.maxBotoes) return aviso(`O máximo é ${d.maxBotoes} botões.`, true);
      botoes.push({ texto: "", url: "", emoji: "" }); desenharBotoes(); previa();
    } }, "➕ Adicionar botão de link");

    // ----- prévia -----
    const caixaPrevia = el("div", { class: "previa" });

    function previa() {
      const partes = [];

      if (ler.mensagem().trim()) partes.push(el("p", { class: "previa-texto" }, ler.mensagem()));

      const emb = el("div", { class: "previa-embed" });
      emb.style.borderLeftColor = ler.cor();

      if (ler.autor().trim()) emb.append(el("div", { class: "previa-autor" }, ler.autor()));
      if (ler.titulo().trim()) emb.append(el("b", {}, ler.titulo()));
      if (ler.descricao().trim()) emb.append(el("p", {}, ler.descricao()));

      for (const c of campos) {
        if (c.nome.trim() || c.valor.trim()) emb.append(el("div", { class: "previa-campo" }, el("b", {}, c.nome), el("span", {}, c.valor)));
      }

      if (ler.rodape().trim() || ler.timestamp()) emb.append(el("small", {}, [ler.rodape(), ler.timestamp() ? "agora" : ""].filter(Boolean).join(" • ")));

      partes.push(emb);

      if (botoes.length) {
        partes.push(el("div", { class: "previa-botoes" },
          ...botoes.map(b => el("span", { class: "previa-botao" }, `${b.emoji ? b.emoji + " " : ""}${b.texto || "Botão"}`))));
      }

      caixaPrevia.replaceChildren(...partes);
    }

    const nome = txt("nome", "Nome (só para você se organizar)", { max: 100 });
    const msg = txt("mensagem", "Texto acima do embed (opcional)", { multi: true, max: 2000 });
    const autor = txt("autor", "Autor", { max: 256 });
    const autorIcone = txt("autor_icone", "Ícone do autor (link)", { max: 1000, ph: "https://…" });
    const autorUrl = txt("autor_url", "Link do autor", { max: 1000, ph: "https://…" });
    const titulo = txt("titulo", "Título", { max: 256 });
    const tituloUrl = txt("titulo_url", "Link do título", { max: 1000, ph: "https://…" });
    const descricao = txt("descricao", "Descrição", { multi: true, max: 4096 });
    const thumb = txt("thumbnail", "Miniatura (link)", { max: 1000, ph: "https://…" });
    const imagem = txt("imagem", "Imagem grande (link)", { max: 1000, ph: "https://…" });
    const rodape = txt("rodape", "Rodapé", { max: 2048 });
    const rodapeIcone = txt("rodape_icone", "Ícone do rodapé (link)", { max: 1000, ph: "https://…" });

    function montar() {
      const o = {};
      for (const k of Object.keys(ler)) o[k] = ler[k]();
      o.campos = campos.map(c => ({ nome: c.nome, valor: c.valor, inline: !!c.inline }));
      o.botoes = botoes.map(b => ({ texto: b.texto, url: b.url, emoji: (b.emoji || "").trim() }));
      return o;
    }

    const enviar = el("button", { class: "botao", type: "button" }, novo ? "📤 Enviar embed" : "💾 Salvar e atualizar mensagem");
    const cancelar = el("button", { class: "botao botao-claro", type: "button", onclick: lista }, "← Voltar");

    enviar.addEventListener("click", async () => {
      if (!ler.canal_id()) return aviso("Escolha o canal onde o embed será enviado.", true);

      enviar.disabled = true;

      try {
        d = await chamar(novo ? base : `${base}/${e.id}`, { method: novo ? "POST" : "PUT", body: JSON.stringify(montar()) });
        aviso(novo ? "Embed enviado ✓" : "Embed atualizado ✓");
        lista();
      } catch (er) {
        enviar.disabled = false;
        aviso(er.message, true);
      }
    });

    alvo.replaceChildren(
      el("h2", {}, novo ? "Novo embed" : "Editar embed"),
      el("div", { class: "grade-campos" }, nome, el("label", { class: "campo" }, el("b", {}, "Canal"), canal)),
      msg,
      el("div", { class: "grade-campos" }, autor, autorIcone, autorUrl),
      el("div", { class: "grade-campos" }, titulo, tituloUrl),
      descricao,
      el("div", { class: "grade-campos" }, thumb, imagem),
      el("div", { class: "grade-campos" }, rodape, rodapeIcone),
      el("div", { class: "opcao" },
        el("div", { class: "txt" }, el("b", {}, "Cor")), cor),
      el("div", { class: "opcao" },
        el("div", { class: "txt" }, el("b", {}, "Mostrar horário"), el("span", {}, "Aparece no rodapé do embed.")),
        el("label", { class: "interruptor" }, hora, el("i"))),
      el("h2", {}, "Campos"), caixaCampos, addCampo,
      el("h2", {}, "Botões de link"), caixaBotoes, addBotao,
      el("h2", {}, "Prévia"), caixaPrevia,
      el("div", { class: "acoes" }, cancelar, enviar)
    );

    desenharCampos();
    desenharBotoes();
    previa();
  }

  lista();
}


// ---------- YouTube ----------

async function secaoYouTube(id, alvo) {
  const base = `/api/guilds/${id}/youtube`;
  let d = await chamar(base);

  function seletor(valor) {
    const s = el("select", {}, el("option", { value: "" }, "— escolha um canal —"),
      ...d.canais.map(c => el("option", { value: c.id }, "#" + c.nome)));
    s.value = valor || "";
    return s;
  }

  // roda uma ação com o botão travado e já redesenha a tela com a resposta
  async function agir(botao, caminho, metodo, corpo, ok, redesenhar = true) {
    botao.disabled = true;

    try {
      const r = await chamar(caminho, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined });
      d = r;
      aviso(typeof ok === "function" ? ok(r.resultado) : ok);
      if (redesenhar) desenhar();
      return true;
    } catch (e) {
      aviso(e.message, true);
      return false;
    } finally {
      botao.disabled = false;
    }
  }

  function formularioAdicionar() {
    const canal = el("input", { type: "text", maxlength: "300", placeholder: "https://youtube.com/@nome, @nome ou UC…" });
    const destino = seletor("");
    const msg = el("textarea", { rows: "3", maxlength: "2000" });
    msg.value = d.mensagemPadrao;
    const botao = el("button", { class: "botao", type: "button" }, "➕ Adicionar canal");

    botao.addEventListener("click", async () => {
      if (!canal.value.trim()) return aviso("Informe o canal do YouTube.", true);
      if (!destino.value) return aviso("Escolha o canal do Discord onde os avisos serão enviados.", true);

      botao.textContent = "Procurando o canal…";

      const feito = await agir(botao, base, "POST", { canal: canal.value, destino_id: destino.value, mensagem: msg.value },
        r => `Canal “${r?.nome}” adicionado ✓`);

      if (!feito) botao.textContent = "➕ Adicionar canal";
    });

    return el("div", { class: "cartao-embed bloco" },
      el("b", {}, "Adicionar canal do YouTube"),
      el("label", { class: "campo" }, el("b", {}, "Canal do YouTube"), canal),
      el("label", { class: "campo" }, el("b", {}, "Enviar os avisos em"), destino),
      el("label", { class: "campo" }, el("b", {}, "Mensagem"), msg,
        el("span", {}, "Variáveis: {link} (obrigatória), {titulo} e {canal}.")),
      el("div", { class: "acoes-cartao" }, botao));
  }

  function cartao(i) {
    const destino = seletor(i.destino_id);
    const msg = el("textarea", { rows: "3", maxlength: "2000" });
    msg.value = i.mensagem;

    const salvar = el("button", { class: "botao botao-pequeno", type: "button" }, "💾 Salvar");
    const testar = el("button", { class: "botao botao-pequeno botao-claro", type: "button" }, "🧪 Testar");
    const remover = el("button", { class: "botao botao-pequeno botao-claro", type: "button" }, "🗑️ Remover");

    salvar.addEventListener("click", () => {
      if (!destino.value) return aviso("Escolha o canal do Discord.", true);
      agir(salvar, `${base}/${i.id}`, "PUT", { destino_id: destino.value, mensagem: msg.value }, "Salvo ✓", false);
    });

    testar.addEventListener("click", () =>
      agir(testar, `${base}/${i.id}/testar`, "POST", null, r => `Teste enviado em #${r?.destino} ✓ (usa a mensagem salva)`, false));

    remover.addEventListener("click", () => {
      if (!confirm(`Remover “${i.canal_nome}”? O bot para de avisar os vídeos desse canal.`)) return;
      agir(remover, `${base}/${i.id}`, "DELETE", null, "Canal removido ✓");
    });

    return el("div", { class: "cartao-embed bloco" },
      el("a", { href: i.canal_url, target: "_blank", rel: "noopener noreferrer" }, el("b", {}, "📺 " + i.canal_nome)),
      el("label", { class: "campo" }, el("b", {}, "Enviar os avisos em"), destino),
      el("label", { class: "campo" }, el("b", {}, "Mensagem"), msg,
        el("span", {}, "Variáveis: {link} (obrigatória), {titulo} e {canal}.")),
      el("div", { class: "acoes-cartao" }, salvar, testar, remover));
  }

  function desenhar() {
    alvo.replaceChildren(
      el("p", { class: "legenda" }, `Avisa no Discord quando um canal do YouTube posta vídeo novo. O bot confere a cada ${d.intervaloMin} minutos e só avisa vídeos publicados daqui pra frente. Até ${d.max} canais por servidor (${d.inscricoes.length}/${d.max}).`),
      ...d.inscricoes.map(cartao),
      d.inscricoes.length < d.max ? formularioAdicionar() : el("div", { class: "aviso" }, "Limite de canais atingido. Remova um para adicionar outro.")
    );
  }

  desenhar();
}


// ---------- Registro ----------

async function secaoRegistro(id, alvo) {
  const base = `/api/guilds/${id}/registro`;
  let d = await chamar(base);

  const ESTILOS = { PRIMARY: "Azul", SECONDARY: "Cinza", SUCCESS: "Verde", DANGER: "Vermelho" };

  function seletorCanal(valor) {
    const s = el("select", {}, el("option", { value: "" }, "— escolha um canal —"),
      ...d.canais.map(c => el("option", { value: c.id }, "#" + c.nome)));
    s.value = valor || "";
    return s;
  }

  function seletorCargo(valor, vazio) {
    const s = el("select", {}, el("option", { value: "" }, vazio),
      ...d.cargos.map(c => {
        const o = el("option", { value: c.id }, c.nome + (c.gerenciavel ? "" : " (acima do meu cargo)"));
        if (!c.gerenciavel) o.disabled = true;
        return o;
      }));
    s.value = valor || "";
    return s;
  }

  function campo(titulo, controle, dica) {
    return el("label", { class: "campo" }, el("b", {}, titulo), controle, dica ? el("span", {}, dica) : "");
  }

  function texto(valor, max, ph = "") {
    const c = el("input", { type: "text", maxlength: String(max) });
    c.value = valor || "";
    if (ph) c.placeholder = ph;
    return c;
  }

  function area(valor, max) {
    const c = el("textarea", { rows: "3", maxlength: String(max) });
    c.value = valor || "";
    return c;
  }

  function corInput(valor) {
    const c = el("input", { type: "color" });
    c.value = (valor || "#5865F2").toLowerCase();
    return c;
  }

  // chama a API, atualiza os dados e redesenha tudo
  async function agir(botao, caminho, metodo, corpo, ok, redesenhar = true) {
    if (botao) botao.disabled = true;

    try {
      d = await chamar(`${base}${caminho}`, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined });
      if (ok) aviso(typeof ok === "function" ? ok(d.resultado) : ok);
      if (redesenhar) desenhar();
      return true;
    } catch (e) {
      aviso(e.message, true);
      return false;
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  function botaoAcao(rotulo, classe, onclick) {
    const b = el("button", { class: `botao botao-pequeno ${classe}`.trim(), type: "button" }, rotulo);
    b.addEventListener("click", () => onclick(b));
    return b;
  }

  // ----- configurações gerais -----
  function blocoGeral() {
    const canal = seletorCanal(d.painel.canal_id);
    const cargo = seletorCargo(d.painel.cargo_id, "— nenhum —");
    const perguntas = el("input", { type: "checkbox", "aria-label": "Perguntas em sequência" });
    perguntas.checked = d.painel.perguntas;

    const salvar = botaoAcao("💾 Salvar", "", b => agir(b, "/painel", "PUT", {
      canal_id: canal.value || null, cargo_id: cargo.value || null, perguntas: perguntas.checked
    }, "Salvo ✓"));

    const publicar = botaoAcao(d.painel.publicado ? "📢 Atualizar painel" : "📢 Publicar painel", "botao-claro", async b => {
      if (!canal.value) return aviso("Escolha o canal do painel primeiro.", true);

      b.disabled = true;

      // salva as escolhas antes de publicar
      const ok = await agir(null, "/painel", "PUT", { canal_id: canal.value, cargo_id: cargo.value || null, perguntas: perguntas.checked }, "", false);

      if (ok) await agir(null, "/publicar", "POST", null, r => (r?.atualizado ? "Painel atualizado ✓" : "Painel publicado ✓"));

      b.disabled = false;
    });

    return el("div", { class: "cartao-embed bloco" },
      el("b", {}, "⚙️ Geral"),
      el("p", { class: "legenda" }, d.painel.publicado ? "✅ O painel já está publicado." : "⚠️ O painel ainda não foi publicado."),
      campo("Canal do painel", canal, "Onde a mensagem com o botão de registro fica."),
      campo("Cargo depois do registro", cargo, "Dado a quem concluir o registro (o cargo do bot precisa estar acima dele)."),
      el("div", { class: "opcao" },
        el("div", { class: "txt" }, el("b", {}, "Perguntas em sequência"),
          el("span", {}, "Ligado: cada página vira uma pergunta, uma por vez. Desligado: o 1º botão conclui o registro.")),
        el("label", { class: "interruptor" }, perguntas, el("i"))),
      el("div", { class: "acoes-cartao" }, salvar, publicar));
  }

  // ----- painel inicial -----
  function blocoPainel() {
    const p = d.painel;
    const titulo = texto(p.titulo, 256), url = texto(p.titulo_url, 1000, "https://…"), desc = area(p.descricao, 4096);
    const cor = corInput(p.cor), img = texto(p.imagem, 1000, "https://…"), thumb = texto(p.thumbnail, 1000, "https://…");
    const rod = texto(p.rodape, 2048), rodIc = texto(p.rodape_icone, 1000, "https://…"), btn = texto(p.botao_texto, 80);

    const salvar = botaoAcao("💾 Salvar painel inicial", "", b => agir(b, "/painel", "PUT", {
      titulo: titulo.value, titulo_url: url.value, descricao: desc.value, cor: cor.value.toUpperCase(),
      imagem: img.value, thumbnail: thumb.value, rodape: rod.value, rodape_icone: rodIc.value, botao_texto: btn.value
    }, "Painel inicial salvo ✓ (a mensagem publicada também foi atualizada)"));

    return el("details", { class: "cartao-embed bloco" },
      el("summary", {}, el("b", {}, "🎨 Painel inicial (mensagem com o botão)")),
      campo("Título", titulo), campo("Link do título", url),
      campo("Descrição", desc, "Se ficar vazia, aparece o texto padrão."),
      campo("Cor", cor), campo("Imagem grande (link)", img), campo("Miniatura (link)", thumb),
      campo("Rodapé", rod), campo("Ícone do rodapé (link)", rodIc),
      campo("Texto do botão", btn),
      el("div", { class: "acoes-cartao" }, salvar));
  }

  // ----- páginas -----
  function blocoPagina(pg) {
    const titulo = texto(pg.titulo, 256), url = texto(pg.titulo_url, 1000, "https://…"), desc = area(pg.descricao, 4096);
    const cor = corInput(pg.cor), img = texto(pg.imagem, 1000, "https://…"), thumb = texto(pg.thumbnail, 1000, "https://…");
    const rod = texto(pg.rodape, 2048), rodIc = texto(pg.rodape_icone, 1000, "https://…");
    const opc = el("input", { type: "checkbox", "aria-label": "Pergunta opcional" });
    opc.checked = pg.opcional;

    const salvar = botaoAcao("💾 Salvar página", "", b => agir(b, `/paginas/${pg.numero}`, "PUT", {
      titulo: titulo.value, titulo_url: url.value, descricao: desc.value, cor: cor.value.toUpperCase(),
      imagem: img.value, thumbnail: thumb.value, rodape: rod.value, rodape_icone: rodIc.value, opcional: opc.checked
    }, `Página ${pg.numero} salva ✓`));

    const ultima = d.paginas[d.paginas.length - 1].numero === pg.numero && pg.numero > 1;
    const remover = ultima ? botaoAcao("🗑️ Remover página", "botao-claro", b => {
      if (!confirm(`Remover a página ${pg.numero} e os botões dela?`)) return;
      agir(b, `/paginas/${pg.numero}`, "DELETE", null, "Página removida ✓");
    }) : "";

    return el("details", { class: "cartao-embed bloco" },
      el("summary", {}, el("b", {}, `📄 Página ${pg.numero}`), el("span", { class: "resumo" }, ` — ${pg.titulo || "sem título"} • ${pg.botoes.length} botão(ões)`)),
      campo("Título", titulo), campo("Link do título", url), campo("Descrição", desc),
      campo("Cor", cor), campo("Imagem grande (link)", img), campo("Miniatura (link)", thumb),
      campo("Rodapé", rod), campo("Ícone do rodapé (link)", rodIc),
      el("div", { class: "opcao" },
        el("div", { class: "txt" }, el("b", {}, "Pergunta opcional"), el("span", {}, "No modo perguntas, aparece o botão “Pular”.")),
        el("label", { class: "interruptor" }, opc, el("i"))),
      el("div", { class: "acoes-cartao" }, salvar, remover),
      el("h2", {}, "Botões desta página"),
      ...pg.botoes.map(b => linhaBotao(pg, b)),
      pg.botoes.length < d.maxBotoes ? novoBotao(pg) : el("p", { class: "legenda" }, `Limite de ${d.maxBotoes} botões nesta página.`));
  }

  function controlesBotao(b) {
    const t = texto(b?.texto, 80), e = texto(b?.emoji, 100, "Emoji");
    const est = el("select", {}, ...d.estilos.map(s => el("option", { value: s }, ESTILOS[s] || s)));
    est.value = b?.estilo || "PRIMARY";
    const car = seletorCargo(b?.cargo_id, "Sem cargo");
    return { t, e, est, car, corpo: () => ({ texto: t.value, emoji: e.value, estilo: est.value, cargo_id: car.value || null }) };
  }

  function linhaBotao(pg, b) {
    const c = controlesBotao(b);

    return el("div", { class: "linha-botao" },
      c.t, c.e, c.est, c.car,
      botaoAcao("💾", "", x => agir(x, `/botoes/${b.id}`, "PUT", c.corpo(), "Botão salvo ✓", false)),
      botaoAcao("🗑️", "botao-claro", x => {
        if (!confirm(`Remover o botão “${b.texto}”?`)) return;
        agir(x, `/botoes/${b.id}`, "DELETE", null, "Botão removido ✓");
      }));
  }

  function novoBotao(pg) {
    const c = controlesBotao(null);
    c.t.placeholder = "Texto do botão";

    return el("div", { class: "linha-botao novo" },
      c.t, c.e, c.est, c.car,
      botaoAcao("➕ Adicionar", "", x => {
        if (!c.t.value.trim()) return aviso("Escreva o texto do botão.", true);
        agir(x, `/paginas/${pg.numero}/botoes`, "POST", c.corpo(), "Botão criado ✓");
      }));
  }

  function desenhar() {
    // lembra quais blocos estavam abertos
    const abertos = new Set([...alvo.querySelectorAll("details[open]")].map(x => x.dataset.chave));

    const paginas = d.paginas.map(blocoPagina);
    const painel = blocoPainel();

    painel.dataset.chave = "painel";
    paginas.forEach((p, i) => { p.dataset.chave = `p${d.paginas[i].numero}`; });
    [painel, ...paginas].forEach(x => { if (abertos.has(x.dataset.chave)) x.open = true; });

    const adicionar = botaoAcao("➕ Adicionar página", "", b => agir(b, "/paginas", "POST", null, r => `Página ${r?.numero} criada ✓`));
    if (d.paginas.length >= d.maxPaginas) adicionar.disabled = true;

    const excluir = botaoAcao("🗑️ Excluir todo o sistema de registro", "botao-claro", b => {
      if (!confirm("Excluir TODAS as páginas, botões e o registro dos membros, e apagar o painel publicado? Isso não pode ser desfeito.")) return;
      agir(b, "", "DELETE", null, "Sistema de registro excluído ✓");
    });

    alvo.replaceChildren(
      el("p", { class: "legenda" }, "Configure o registro de membros: o painel inicial, as páginas (ou perguntas) e os botões que dão cargos. É o antigo /registrar, agora aqui no site."),
      blocoGeral(),
      painel,
      el("h2", {}, `Páginas (${d.paginas.length}/${d.maxPaginas})`),
      ...paginas,
      el("div", { class: "acoes-cartao" }, adicionar),
      el("h2", {}, "Zona de perigo"),
      el("div", { class: "acoes-cartao" }, excluir)
    );
  }

  desenhar();
}


function tela() {
  if (!logado()) return telaLogin(app, "Autorize o aplicativo para configurar o bot nos servidores onde você é administrador.");

  return telaServidores();
}

window.aoSessaoExpirar = tela;

tela();
