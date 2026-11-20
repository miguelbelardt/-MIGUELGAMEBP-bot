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
  { chave: "logs", emoji: "📜", nome: "Logs" }
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
      else await secaoLogs(id, conteudo);
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

function tela() {
  if (!logado()) return telaLogin(app, "Autorize o aplicativo para configurar o bot nos servidores onde você é administrador.");

  return telaServidores();
}

window.aoSessaoExpirar = tela;

tela();
