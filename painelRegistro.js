// =====================================================
// 📝 REGISTRO NO PAINEL
// =====================================================
// Usa as mesmas tabelas do antigo /registrar (registro_config, registro_paginas, registro_botoes).

const { ChannelType, PermissionFlagsBits } = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const reg = require("./comandos/registrar.js")._painel;

const ESTILOS = Object.keys(reg.ESTILOS_BOTOES); // PRIMARY, SECONDARY, SUCCESS, DANGER

const EMOJI_PERSONALIZADO = /^<a?:\w{2,32}:\d{15,25}>$/;
const EMOJI_NORMAL = /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u;

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

function emojiOk(e) {
    return EMOJI_PERSONALIZADO.test(e) || EMOJI_NORMAL.test(e);
}

function cargoPodeSerDado(guild, id) {
    const cargo = guild.roles.cache.get(id);
    const eu = guild.members.me;

    if (!cargo || cargo.id === guild.id) return { erro: "Esse cargo não existe no servidor." };
    if (cargo.managed) return { erro: `O cargo “${cargo.name}” é gerenciado por uma integração e não pode ser dado pelo bot.` };
    if (!eu?.permissions.has(PermissionFlagsBits.ManageRoles)) return { erro: "Eu não tenho a permissão Gerenciar Cargos no servidor." };
    if (cargo.position >= eu.roles.highest.position) return { erro: `Não consigo dar o cargo “${cargo.name}”: ele está acima (ou no mesmo nível) do meu maior cargo. Suba o meu cargo na lista.` };

    return { cargo };
}

// ---------- leitura ----------

async function lerTudo(guild) {
    await reg.garantirColunasExtrasRegistro();
    const config = await reg.garantirConfiguracao(guild.id);

    const [paginas] = await mysqlPool.query(
        "SELECT * FROM registro_paginas WHERE guild_id = ? ORDER BY pagina ASC",
        [guild.id]
    );

    const ids = paginas.map(p => p.id);
    let botoes = [];

    if (ids.length) {
        [botoes] = await mysqlPool.query(
            `SELECT * FROM registro_botoes WHERE pagina_id IN (${ids.map(() => "?").join(",")}) ORDER BY ordem ASC, id ASC`,
            ids
        );
    }

    return { config, paginas, botoes };
}

async function ler(guild) {
    const { config, paginas, botoes } = await lerTudo(guild);

    return {
        maxPaginas: reg.MAX_PAGINAS,
        maxBotoes: reg.MAX_BOTOES,
        estilos: ESTILOS,
        painel: {
            canal_id: config.canal_id || null,
            publicado: !!(config.canal_id && config.mensagem_id),
            titulo: config.painel_titulo || "📝 Registro",
            titulo_url: config.painel_titulo_url || "",
            descricao: config.painel_descricao || "",
            cor: /^#[0-9a-f]{6}$/i.test(config.painel_cor || "") ? config.painel_cor.toUpperCase() : "#5865F2",
            imagem: config.painel_imagem || "",
            thumbnail: config.painel_thumbnail || "",
            rodape: config.painel_rodape || "",
            rodape_icone: config.painel_rodape_icone || "",
            botao_texto: config.painel_botao_texto || "Registrar",
            cargo_id: config.cargo_registro_id || null,
            perguntas: Number(config.modo_sequencia) === 1
        },
        paginas: paginas.map(p => ({
            numero: Number(p.pagina),
            titulo: p.titulo || "",
            titulo_url: p.titulo_url || "",
            descricao: p.descricao || "",
            cor: /^#[0-9a-f]{6}$/i.test(p.cor || "") ? p.cor.toUpperCase() : "#5865F2",
            thumbnail: p.thumbnail || "",
            imagem: p.imagem || "",
            rodape: p.rodape || "",
            rodape_icone: p.rodape_icone || "",
            opcional: Number(p.opcional) === 1,
            botoes: botoes.filter(b => String(b.pagina_id) === String(p.id)).map(b => ({
                id: String(b.id),
                texto: b.texto,
                emoji: b.emoji || "",
                estilo: String(b.estilo || "PRIMARY").toUpperCase(),
                cargo_id: b.cargo_id || null
            }))
        })),
        canais: [...guild.channels.cache.values()]
            .filter(ehTexto)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name })),
        cargos: [...guild.roles.cache.values()]
            .filter(r => r.id !== guild.id && !r.managed)
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, nome: r.name, gerenciavel: !!r.editable }))
    };
}

// ---------- validação ----------

function chavesOk(corpo, permitidas) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return "Dados inválidos.";

    for (const k of Object.keys(corpo)) {
        if (!permitidas.includes(k)) return `Opção desconhecida: ${String(k).slice(0, 40)}`;
    }

    return null;
}

function textoOpc(v, max, nome) {
    if (v === undefined || v === null) return { v: "" };
    if (typeof v !== "string") return { erro: `Texto inválido em "${nome}".` };

    const s = v.trim();

    if (s.length > max) return { erro: `"${nome}" passou do limite de ${max} caracteres.` };

    return { v: s };
}

function linkOpc(v, nome) {
    const r = textoOpc(v, 1000, nome);

    if (r.erro) return r;
    if (r.v && !reg.urlValida(r.v)) return { erro: `O link de "${nome}" precisa começar com http:// ou https://` };

    return r;
}

function corOk(v) {
    const cor = typeof v === "string" ? v.trim() : "#5865F2";

    return /^#[0-9a-f]{6}$/i.test(cor) ? { v: cor.toUpperCase() } : { erro: "Cor inválida. Use o formato #RRGGBB." };
}

async function mexeuNoPainel(guild) {
    const config = await reg.garantirConfiguracao(guild.id);

    if (config.canal_id && config.mensagem_id) await reg.atualizarMensagemRegistro(guild, config);
}

// ---------- painel inicial / configurações gerais ----------

async function salvarPainel(guild, corpo) {
    const e = chavesOk(corpo, ["canal_id", "titulo", "titulo_url", "descricao", "cor", "imagem", "thumbnail", "rodape", "rodape_icone", "botao_texto", "cargo_id", "perguntas"]);

    if (e) return { erro: e };

    await reg.garantirColunasExtrasRegistro();

    const config = await reg.garantirConfiguracao(guild.id);
    const set = {};

    const mapaTexto = [["titulo", "painel_titulo", 256, "Título"], ["descricao", "painel_descricao", 4096, "Descrição"], ["rodape", "painel_rodape", 2048, "Rodapé"], ["botao_texto", "painel_botao_texto", 80, "Texto do botão"]];

    for (const [k, col, max, nome] of mapaTexto) {
        if (!(k in corpo)) continue;

        const r = textoOpc(corpo[k], max, nome);

        if (r.erro) return r;
        if (k === "botao_texto" && !r.v) return { erro: "O texto do botão não pode ficar vazio." };

        set[col] = r.v || null;
    }

    for (const [k, col, nome] of [["titulo_url", "painel_titulo_url", "Link do título"], ["imagem", "painel_imagem", "Imagem"], ["thumbnail", "painel_thumbnail", "Miniatura"], ["rodape_icone", "painel_rodape_icone", "Ícone do rodapé"]]) {
        if (!(k in corpo)) continue;

        const r = linkOpc(corpo[k], nome);

        if (r.erro) return r;

        set[col] = r.v || null;
    }

    if ("cor" in corpo) {
        const r = corOk(corpo.cor);

        if (r.erro) return r;

        set.painel_cor = r.v;
    }

    if ("perguntas" in corpo) {
        if (typeof corpo.perguntas !== "boolean") return { erro: "Opção de perguntas inválida." };

        set.modo_sequencia = corpo.perguntas ? 1 : 0;
    }

    if ("cargo_id" in corpo) {
        if (corpo.cargo_id === null || corpo.cargo_id === "") set.cargo_registro_id = null;
        else if (typeof corpo.cargo_id === "string") {
            const r = cargoPodeSerDado(guild, corpo.cargo_id);

            if (r.erro) return r;

            set.cargo_registro_id = corpo.cargo_id;
        } else return { erro: "Cargo inválido." };
    }

    if ("canal_id" in corpo) {
        if (corpo.canal_id === null || corpo.canal_id === "") set.canal_id = null;
        else if (typeof corpo.canal_id === "string" && ehTexto(guild.channels.cache.get(corpo.canal_id))) set.canal_id = corpo.canal_id;
        else return { erro: "Escolha um canal de texto válido." };

        // canal novo: o painel antigo fica para trás (igual ao comando), a publicação recomeça
        if ((set.canal_id || null) !== (config.canal_id || null)) {
            set.mensagem_id = null;
            set.configurado = 0;
        }
    }

    const cols = Object.keys(set);

    if (!cols.length) return { erro: "Nada para salvar." };

    await mysqlPool.query(
        `UPDATE registro_config SET ${cols.map(c => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE guild_id = ?`,
        [...cols.map(c => set[c]), Date.now(), guild.id]
    );

    await mexeuNoPainel(guild);

    return { ok: true };
}

async function publicar(guild) {
    const config = await reg.garantirConfiguracao(guild.id);

    if (!config.canal_id) return { erro: "Primeiro escolha o canal onde o painel de registro será publicado." };

    const canal = await guild.channels.fetch(config.canal_id).catch(() => null);

    if (!ehTexto(canal)) return { erro: "O canal escolhido não existe ou não é um canal de texto." };

    if (config.mensagem_id && await reg.atualizarMensagemRegistro(guild, config)) {
        await mysqlPool.query("UPDATE registro_config SET configurado = 1, atualizado_em = ? WHERE guild_id = ?", [Date.now(), guild.id]);

        return { ok: true, atualizado: true };
    }

    try {
        const mensagem = await canal.send({
            embeds: [reg.criarEmbedPainelInicial(config)],
            components: reg.criarComponentesPainelInicial(guild.id, config)
        });

        const [[{ n }]] = await mysqlPool.query("SELECT COUNT(*) AS n FROM registro_paginas WHERE guild_id = ?", [guild.id]);

        await mysqlPool.query(
            "UPDATE registro_config SET canal_id = ?, mensagem_id = ?, paginas = ?, configurado = 1, atualizado_em = ? WHERE guild_id = ?",
            [canal.id, mensagem.id, Math.max(1, Number(n)), Date.now(), guild.id]
        );
    } catch {
        return { erro: "Não consegui enviar o painel. Confira se o bot pode ver e enviar mensagens nesse canal." };
    }

    return { ok: true, atualizado: false };
}

// ---------- páginas ----------

async function pegarPagina(guild, numero) {
    const n = Number(numero);

    if (!Number.isInteger(n) || n < 1) return null;

    const [linhas] = await mysqlPool.query("SELECT * FROM registro_paginas WHERE guild_id = ? AND pagina = ?", [guild.id, n]);

    return linhas[0] || null;
}

async function adicionarPagina(guild) {
    await reg.garantirColunasExtrasRegistro();
    await reg.garantirConfiguracao(guild.id);

    const [[{ n }]] = await mysqlPool.query("SELECT COUNT(*) AS n FROM registro_paginas WHERE guild_id = ?", [guild.id]);

    if (Number(n) >= reg.MAX_PAGINAS) return { erro: `O limite é de ${reg.MAX_PAGINAS} páginas.` };

    const numero = Number(n) + 1;
    const agora = Date.now();

    await mysqlPool.query(
        "INSERT INTO registro_paginas (guild_id, pagina, titulo, descricao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)",
        [guild.id, numero, `Página ${numero}`, "Configure esta página.", agora, agora]
    );

    await mysqlPool.query("UPDATE registro_config SET paginas = ?, atualizado_em = ? WHERE guild_id = ?", [numero, agora, guild.id]);

    await mexeuNoPainel(guild);

    return { ok: true, numero };
}

async function salvarPagina(guild, numero, corpo) {
    const e = chavesOk(corpo, ["titulo", "titulo_url", "descricao", "cor", "thumbnail", "imagem", "rodape", "rodape_icone", "opcional"]);

    if (e) return { erro: e };

    await reg.garantirColunasExtrasRegistro();

    const pagina = await pegarPagina(guild, numero);

    if (!pagina) return { erro: "Página não encontrada." };

    const set = {};

    for (const [k, max, nome] of [["titulo", 256, "Título"], ["descricao", 4096, "Descrição"], ["rodape", 2048, "Rodapé"]]) {
        if (!(k in corpo)) continue;

        const r = textoOpc(corpo[k], max, nome);

        if (r.erro) return r;

        set[k] = r.v || null;
    }

    for (const [k, nome] of [["titulo_url", "Link do título"], ["thumbnail", "Miniatura"], ["imagem", "Imagem"], ["rodape_icone", "Ícone do rodapé"]]) {
        if (!(k in corpo)) continue;

        const r = linkOpc(corpo[k], nome);

        if (r.erro) return r;

        set[k] = r.v || null;
    }

    if ("cor" in corpo) {
        const r = corOk(corpo.cor);

        if (r.erro) return r;

        set.cor = r.v;
    }

    if ("opcional" in corpo) {
        if (typeof corpo.opcional !== "boolean") return { erro: "Opção inválida." };

        set.opcional = corpo.opcional ? 1 : 0;
    }

    const cols = Object.keys(set);

    if (!cols.length) return { erro: "Nada para salvar." };

    await mysqlPool.query(
        `UPDATE registro_paginas SET ${cols.map(c => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE id = ? AND guild_id = ?`,
        [...cols.map(c => set[c]), Date.now(), pagina.id, guild.id]
    );

    await mexeuNoPainel(guild);

    return { ok: true };
}

// Só a última página (e nunca a 1ª) pode ser removida, para os números continuarem em sequência.
async function removerPagina(guild, numero) {
    const pagina = await pegarPagina(guild, numero);

    if (!pagina) return { erro: "Página não encontrada." };

    const [[{ ultima }]] = await mysqlPool.query("SELECT MAX(pagina) AS ultima FROM registro_paginas WHERE guild_id = ?", [guild.id]);

    if (Number(pagina.pagina) === 1) return { erro: "A página 1 não pode ser removida." };
    if (Number(pagina.pagina) !== Number(ultima)) return { erro: "Só dá para remover a última página." };

    await mysqlPool.query("DELETE FROM registro_botoes WHERE pagina_id = ?", [pagina.id]);
    await mysqlPool.query("DELETE FROM registro_paginas WHERE id = ? AND guild_id = ?", [pagina.id, guild.id]);
    await mysqlPool.query("UPDATE registro_config SET paginas = ?, atualizado_em = ? WHERE guild_id = ?", [Number(ultima) - 1, Date.now(), guild.id]);

    await mexeuNoPainel(guild);

    return { ok: true };
}

// ---------- botões ----------

function validarBotao(guild, corpo, parcial) {
    const e = chavesOk(corpo, ["texto", "emoji", "estilo", "cargo_id"]);

    if (e) return { erro: e };

    const set = {};

    if (!parcial || "texto" in corpo) {
        const r = textoOpc(corpo.texto, 80, "Texto do botão");

        if (r.erro) return r;
        if (!r.v) return { erro: "O texto do botão não pode ficar vazio." };

        set.texto = r.v;
    }

    if ("emoji" in corpo) {
        const r = textoOpc(corpo.emoji, 100, "Emoji");

        if (r.erro) return r;
        if (r.v && !emojiOk(r.v)) return { erro: "Emoji inválido. Use um emoji normal ou um personalizado como <:nome:123456789012345678>." };

        set.emoji = r.v || null;
    }

    if ("estilo" in corpo) {
        const estilo = typeof corpo.estilo === "string" ? corpo.estilo.toUpperCase().trim() : "";

        if (!ESTILOS.includes(estilo)) return { erro: "Estilo de botão inválido." };

        set.estilo = estilo;
    } else if (!parcial) set.estilo = "PRIMARY";

    if ("cargo_id" in corpo) {
        if (corpo.cargo_id === null || corpo.cargo_id === "") set.cargo_id = null;
        else if (typeof corpo.cargo_id === "string") {
            const r = cargoPodeSerDado(guild, corpo.cargo_id);

            if (r.erro) return r;

            set.cargo_id = corpo.cargo_id;
        } else return { erro: "Cargo inválido." };
    } else if (!parcial) set.cargo_id = null;

    return { set };
}

async function adicionarBotao(guild, numeroPagina, corpo) {
    const pagina = await pegarPagina(guild, numeroPagina);

    if (!pagina) return { erro: "Página não encontrada." };

    const v = validarBotao(guild, corpo, false);

    if (v.erro) return v;

    const [[{ n }]] = await mysqlPool.query("SELECT COUNT(*) AS n FROM registro_botoes WHERE pagina_id = ?", [pagina.id]);

    if (Number(n) >= reg.MAX_BOTOES) return { erro: `Cada página pode ter no máximo ${reg.MAX_BOTOES} botões.` };

    const agora = Date.now();
    const customId = `registro_botao_${guild.id}_${agora}_${Math.random().toString(16).slice(2, 12)}`;

    await mysqlPool.query(
        "INSERT INTO registro_botoes (pagina_id, texto, emoji, estilo, cargo_id, custom_id, ordem, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [pagina.id, v.set.texto, v.set.emoji || null, v.set.estilo, v.set.cargo_id, customId, Number(n) + 1, agora, agora]
    );

    await mexeuNoPainel(guild);

    return { ok: true };
}

async function pegarBotao(guild, id) {
    if (!/^\d{1,20}$/.test(String(id))) return null;

    const [linhas] = await mysqlPool.query(
        "SELECT b.* FROM registro_botoes b INNER JOIN registro_paginas p ON p.id = b.pagina_id WHERE b.id = ? AND p.guild_id = ?",
        [id, guild.id]
    );

    return linhas[0] || null;
}

async function editarBotao(guild, id, corpo) {
    const botao = await pegarBotao(guild, id);

    if (!botao) return { erro: "Botão não encontrado." };

    const v = validarBotao(guild, corpo, true);

    if (v.erro) return v;

    const cols = Object.keys(v.set);

    if (!cols.length) return { erro: "Nada para salvar." };

    await mysqlPool.query(
        `UPDATE registro_botoes SET ${cols.map(c => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE id = ?`,
        [...cols.map(c => v.set[c]), Date.now(), botao.id]
    );

    await mexeuNoPainel(guild);

    return { ok: true };
}

async function removerBotao(guild, id) {
    const botao = await pegarBotao(guild, id);

    if (!botao) return { erro: "Botão não encontrado." };

    await mysqlPool.query("DELETE FROM registro_botoes WHERE id = ?", [botao.id]);

    await mexeuNoPainel(guild);

    return { ok: true };
}

// ---------- excluir tudo ----------

async function excluirTudo(guild) {
    const [linhas] = await mysqlPool.query("SELECT * FROM registro_config WHERE guild_id = ?", [guild.id]);
    const config = linhas[0];

    if (!config) return { erro: "Nenhum sistema de registro encontrado." };

    if (config.canal_id && config.mensagem_id) {
        const canal = await guild.channels.fetch(config.canal_id).catch(() => null);

        if (canal?.isTextBased?.()) {
            const m = await canal.messages.fetch(config.mensagem_id).catch(() => null);

            if (m) await m.delete().catch(() => {});
        }
    }

    await mysqlPool.query("DELETE FROM registro_usuarios WHERE guild_id = ?", [guild.id]);
    await mysqlPool.query("DELETE b FROM registro_botoes b INNER JOIN registro_paginas p ON p.id = b.pagina_id WHERE p.guild_id = ?", [guild.id]);
    await mysqlPool.query("DELETE FROM registro_paginas WHERE guild_id = ?", [guild.id]);
    await mysqlPool.query("DELETE FROM registro_config WHERE guild_id = ?", [guild.id]);

    return { ok: true };
}

module.exports = {
    ler, salvarPainel, publicar,
    adicionarPagina, salvarPagina, removerPagina,
    adicionarBotao, editarBotao, removerBotao,
    excluirTudo
};
