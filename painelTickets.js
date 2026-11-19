// =====================================================
// 🎫 TICKETS NO PAINEL
// =====================================================
// Lê e salva as mesmas tabelas do /ticket (ticket_modelos e ticket_config),
// com validação, e publica/atualiza o painel usando o próprio código do /ticket.

const { ChannelType } = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const ticket = require("./comandos/ticket.js");

const MAX_MODELOS = 25;
const MAX_CAMPOS = 10;
const ESTILOS = ["Primary", "Secondary", "Success", "Danger"];

const TEXTOS = {
    nome: { max: 100, obrigatorio: true },
    autor_nome: { max: 256 },
    titulo: { max: 256 },
    descricao: { max: 4000 },
    rodape: { max: 2048 },
    botao_texto: { max: 80, obrigatorio: true }
};

const LINKS = ["autor_icone", "autor_url", "titulo_url", "imagem", "thumbnail", "rodape_icone"];

const CONFIG_BOOLEANOS = ["contador_nome", "dm_transcricao", "avaliacao", "pedir_motivo_fechar"];

let pronto = null;

function preparar() {
    // cria/atualiza as tabelas (a mesma rotina do /ticket), uma vez só
    if (!pronto) {
        pronto = ticket._painel.inicializarTickets().catch(e => {
            pronto = null;
            throw e;
        });
    }

    return pronto;
}

// ---------- validações ----------

function linkValido(valor) {
    if (valor === "") return true;

    if (valor.length > 1000) return false;

    try {
        const u = new URL(valor);

        return u.protocol === "https:" || u.protocol === "http:";
    } catch {
        return false;
    }
}

const EMOJI_PERSONALIZADO = /^<a?:\w{2,32}:\d{17,20}>$/;
const EMOJI_NORMAL = /^\p{Extended_Pictographic}[\p{Extended_Pictographic}️‍\u{1F3FB}-\u{1F3FF}]*$/u;

function emojiValido(valor) {
    return valor === "" || EMOJI_PERSONALIZADO.test(valor) || EMOJI_NORMAL.test(valor);
}

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

// "nome | valor | sim" por linha, igual ao que o /ticket guarda
function camposParaTexto(campos) {
    if (!Array.isArray(campos)) return { erro: "Campos inválidos." };

    if (campos.length > MAX_CAMPOS) return { erro: `No máximo ${MAX_CAMPOS} campos.` };

    const linhas = [];

    for (const c of campos) {
        if (!c || typeof c !== "object" || typeof c.nome !== "string" || typeof c.valor !== "string") {
            return { erro: "Campo inválido." };
        }

        const nome = c.nome.trim();
        const valor = c.valor.trim();

        if (!nome && !valor) continue;

        if (!nome || !valor) return { erro: "Todo campo precisa de nome e valor." };

        if (nome.length > 256 || valor.length > 1024) {
            return { erro: "Campo grande demais (nome até 256, valor até 1024)." };
        }

        if (nome.includes("|") || valor.includes("|") || nome.includes("\n")) {
            return { erro: 'Não use o caractere "|" nos campos (nem quebra de linha no nome).' };
        }

        linhas.push(`${nome} | ${valor.replace(/\r?\n/g, "\\n")} | ${c.inline === true ? "sim" : "nao"}`);
    }

    return { texto: linhas.join("\n") || null };
}

function textoParaCampos(texto) {
    if (!texto || typeof texto !== "string") return [];

    const campos = [];

    for (const linha of texto.split("\n")) {
        if (campos.length >= MAX_CAMPOS) break;

        const partes = linha.split("|").map(p => p.trim());

        if (partes.length < 2 || !partes[0] || !partes[1]) continue;

        campos.push({
            nome: partes[0],
            valor: partes[1].replace(/\\n/g, "\n"),
            inline: /^(sim|s|true|1|yes)$/i.test(partes[2] || "")
        });
    }

    return campos;
}

function normalizarModelo(l) {
    return {
        id: String(l.id),
        nome: l.nome || "",
        autor_nome: l.autor_nome || "",
        autor_icone: l.autor_icone || "",
        autor_url: l.autor_url || "",
        titulo: l.titulo || "",
        titulo_url: l.titulo_url || "",
        descricao: l.descricao || "",
        cor: /^#[0-9a-f]{6}$/i.test(l.cor || "") ? l.cor.toUpperCase() : "#5865F2",
        imagem: l.imagem || "",
        thumbnail: l.thumbnail || "",
        rodape: l.rodape || "",
        rodape_icone: l.rodape_icone || "",
        botao_texto: l.botao_texto || "Fazer Ticket",
        botao_emoji: l.botao_emoji || "",
        botao_estilo: ESTILOS.includes(l.botao_estilo) ? l.botao_estilo : "Primary",
        mostrar_horario: !!Number(l.mostrar_horario),
        campos: textoParaCampos(l.campos)
    };
}

function normalizarConfig(c) {
    const r = c || {};
    const limite = Math.min(5, Math.max(1, Number(r.limite_tickets) || 1));

    return {
        modelo_id: r.modelo_id ? String(r.modelo_id) : null,
        canal_painel_id: r.canal_painel_id || null,
        categoria_id: r.categoria_id || null,
        cargo_mencao_id: r.cargo_mencao_id || null,
        contador_nome: !!Number(r.contador_nome),
        limite_tickets: limite,
        dm_transcricao: !!Number(r.dm_transcricao),
        avaliacao: !!Number(r.avaliacao),
        pedir_motivo_fechar: r.pedir_motivo_fechar === undefined || r.pedir_motivo_fechar === null ? true : !!Number(r.pedir_motivo_fechar),
        canal_transcricao_id: r.canal_transcricao_id || null,
        publicado: !!r.mensagem_painel_id,
        configurado: !!Number(r.configurado)
    };
}

// ---------- leitura ----------

async function lerConfigBanco(guildId) {
    const [linhas] = await mysqlPool.query("SELECT * FROM ticket_config WHERE guild_id = ?", [String(guildId)]);

    return linhas[0] || null;
}

async function ler(guild) {
    await preparar();

    const [modelos] = await mysqlPool.query(
        "SELECT * FROM ticket_modelos WHERE guild_id = ? ORDER BY id",
        [String(guild.id)]
    );

    const canais = [...guild.channels.cache.values()];

    return {
        modelos: modelos.map(normalizarModelo),
        config: normalizarConfig(await lerConfigBanco(guild.id)),
        canais: canais.filter(ehTexto).sort((a, b) => a.rawPosition - b.rawPosition).map(c => ({ id: c.id, nome: c.name })),
        categorias: canais.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition).map(c => ({ id: c.id, nome: c.name })),
        cargos: [...guild.roles.cache.values()]
            .filter(r => r.id !== guild.id && !r.managed)
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, nome: r.name })),
        maxModelos: MAX_MODELOS,
        maxCampos: MAX_CAMPOS
    };
}

// ---------- configuração ----------

// Devolve { erro } ou { ok, aviso? }
async function salvarConfig(guild, corpo) {
    await preparar();

    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    const novo = {};

    for (const [chave, valor] of Object.entries(corpo)) {
        if (CONFIG_BOOLEANOS.includes(chave)) {
            if (typeof valor !== "boolean") return { erro: `Valor inválido em "${chave}".` };

            novo[chave] = valor ? 1 : 0;
        } else if (chave === "limite_tickets") {
            if (!Number.isInteger(valor) || valor < 1 || valor > 5) return { erro: "O limite precisa ser de 1 a 5." };

            novo[chave] = valor;
        } else if (chave === "modelo_id") {
            if (valor === null || valor === "") {
                novo.modelo_id = null;
            } else {
                if (typeof valor !== "string" || !/^\d+$/.test(valor)) return { erro: "Modelo inválido." };

                const [m] = await mysqlPool.query("SELECT id FROM ticket_modelos WHERE id = ? AND guild_id = ?", [valor, String(guild.id)]);

                if (!m.length) return { erro: "Esse modelo não existe." };

                novo.modelo_id = valor;
            }
        } else if (chave === "canal_painel_id" || chave === "canal_transcricao_id") {
            if (valor === null || valor === "") {
                novo[chave] = null;
            } else if (typeof valor === "string" && ehTexto(guild.channels.cache.get(valor))) {
                novo[chave] = valor;
            } else {
                return { erro: "Canal inválido." };
            }
        } else if (chave === "categoria_id") {
            if (valor === null || valor === "") {
                novo.categoria_id = null;
            } else if (typeof valor === "string" && guild.channels.cache.get(valor)?.type === ChannelType.GuildCategory) {
                novo.categoria_id = valor;
            } else {
                return { erro: "Categoria inválida." };
            }
        } else if (chave === "cargo_mencao_id") {
            if (valor === null || valor === "") {
                novo.cargo_mencao_id = null;
            } else if (typeof valor === "string" && valor !== guild.id && guild.roles.cache.has(valor)) {
                novo.cargo_mencao_id = valor;
            } else {
                return { erro: "Cargo inválido." };
            }
        } else {
            return { erro: `Opção desconhecida: ${String(chave).slice(0, 40)}` };
        }
    }

    if (!Object.keys(novo).length) return { erro: "Nada para salvar." };

    const antes = await lerConfigBanco(guild.id);

    // Mudou o canal do painel: o painel antigo é apagado (igual ao /ticket)
    if ("canal_painel_id" in novo && antes?.canal_painel_id && antes.canal_painel_id !== novo.canal_painel_id) {
        await ticket._painel.apagarPainelAntigo(guild, antes.canal_painel_id, antes.mensagem_painel_id);

        novo.mensagem_painel_id = null;
    }

    const colunas = Object.keys(novo);

    await mysqlPool.query(
        `INSERT INTO ticket_config (guild_id, ${colunas.join(", ")})
         VALUES (?, ${colunas.map(() => "?").join(", ")})
         ON DUPLICATE KEY UPDATE ${colunas.map(c => `${c} = VALUES(${c})`).join(", ")}`,
        [String(guild.id), ...colunas.map(c => novo[c])]
    );

    return { ok: true };
}

// Envia ou atualiza a mensagem do painel no canal escolhido
async function publicar(guild) {
    await preparar();

    const config = await lerConfigBanco(guild.id);

    if (!config?.modelo_id) return { erro: "Escolha o modelo do painel primeiro." };
    if (!config.canal_painel_id) return { erro: "Escolha o canal do painel primeiro." };
    if (!config.categoria_id) return { erro: "Escolha a categoria dos tickets primeiro." };

    const [modelos] = await mysqlPool.query("SELECT * FROM ticket_modelos WHERE id = ? AND guild_id = ?", [config.modelo_id, String(guild.id)]);

    if (!modelos.length) return { erro: "O modelo escolhido não existe mais." };

    if (guild.channels.cache.get(config.categoria_id)?.type !== ChannelType.GuildCategory) {
        return { erro: "A categoria escolhida não existe mais." };
    }

    await mysqlPool.query("UPDATE ticket_config SET configurado = TRUE WHERE guild_id = ?", [String(guild.id)]);

    const painel = await ticket._painel.atualizarPainelPublicado(guild, modelos[0], await lerConfigBanco(guild.id));

    if (!painel) return { erro: "Não consegui enviar o painel. Confira se o bot pode ver e enviar mensagens nesse canal." };

    return { ok: true };
}

// ---------- modelos ----------

function validarModelo(corpo, parcial) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    const novo = {};

    for (const [chave, valor] of Object.entries(corpo)) {
        if (chave in TEXTOS) {
            if (typeof valor !== "string") return { erro: `Texto inválido em "${chave}".` };

            const v = valor.trim();

            if (v.length > TEXTOS[chave].max) return { erro: `Texto grande demais em "${chave}" (máximo ${TEXTOS[chave].max}).` };
            if (TEXTOS[chave].obrigatorio && !v) return { erro: chave === "nome" ? "O modelo precisa de um nome." : "O botão precisa de um texto." };

            novo[chave] = v || null;
        } else if (LINKS.includes(chave)) {
            if (typeof valor !== "string" || !linkValido(valor.trim())) return { erro: `"${chave}" precisa ser vazio ou um link http(s).` };

            novo[chave] = valor.trim() || null;
        } else if (chave === "cor") {
            if (typeof valor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(valor)) return { erro: "Cor inválida. Use o formato #RRGGBB." };

            novo.cor = valor.toUpperCase();
        } else if (chave === "botao_emoji") {
            if (typeof valor !== "string" || !emojiValido(valor.trim())) return { erro: "Emoji inválido. Use um emoji normal ou um personalizado como <:nome:123456789012345678>." };

            novo.botao_emoji = valor.trim() || null;
        } else if (chave === "botao_estilo") {
            if (!ESTILOS.includes(valor)) return { erro: "Estilo do botão inválido." };

            novo.botao_estilo = valor;
        } else if (chave === "mostrar_horario") {
            if (typeof valor !== "boolean") return { erro: `Valor inválido em "${chave}".` };

            novo.mostrar_horario = valor ? 1 : 0;
        } else if (chave === "campos") {
            const r = camposParaTexto(valor);

            if (r.erro) return r;

            novo.campos = r.texto;
        } else if (chave === "id") {
            continue;
        } else {
            return { erro: `Opção desconhecida: ${String(chave).slice(0, 40)}` };
        }
    }

    if (!parcial && !novo.nome) return { erro: "O modelo precisa de um nome." };

    if (!Object.keys(novo).length) return { erro: "Nada para salvar." };

    return { novo };
}

async function criarModelo(guild, corpo) {
    await preparar();

    const [[{ total }]] = await mysqlPool.query("SELECT COUNT(*) AS total FROM ticket_modelos WHERE guild_id = ?", [String(guild.id)]);

    if (Number(total) >= MAX_MODELOS) return { erro: `Limite de ${MAX_MODELOS} modelos atingido.` };

    const v = validarModelo(corpo, false);

    if (v.erro) return v;

    const dados = { cor: "#5865F2", ...v.novo };
    const colunas = Object.keys(dados);

    const [r] = await mysqlPool.query(
        `INSERT INTO ticket_modelos (guild_id, ${colunas.join(", ")}) VALUES (?, ${colunas.map(() => "?").join(", ")})`,
        [String(guild.id), ...colunas.map(c => dados[c])]
    );

    return { ok: true, id: String(r.insertId) };
}

async function salvarModelo(guild, id, corpo) {
    await preparar();

    if (!/^\d+$/.test(String(id))) return { erro: "Modelo inválido." };

    const v = validarModelo(corpo, true);

    if (v.erro) return v;

    const colunas = Object.keys(v.novo);

    const [r] = await mysqlPool.query(
        `UPDATE ticket_modelos SET ${colunas.map(c => `${c} = ?`).join(", ")} WHERE id = ? AND guild_id = ?`,
        [...colunas.map(c => v.novo[c]), String(id), String(guild.id)]
    );

    if (!r.affectedRows) {
        const [existe] = await mysqlPool.query("SELECT id FROM ticket_modelos WHERE id = ? AND guild_id = ?", [String(id), String(guild.id)]);

        if (!existe.length) return { erro: "Esse modelo não existe." };
    }

    // Se é o modelo do painel publicado, a mensagem do canal é atualizada
    const config = await lerConfigBanco(guild.id);
    let painelAtualizado = null;

    if (config && String(config.modelo_id) === String(id) && config.mensagem_painel_id) {
        const [m] = await mysqlPool.query("SELECT * FROM ticket_modelos WHERE id = ? AND guild_id = ?", [String(id), String(guild.id)]);

        painelAtualizado = !!(await ticket._painel.atualizarPainelPublicado(guild, m[0], config));
    }

    return { ok: true, painelAtualizado };
}

async function apagarModelo(guild, id) {
    await preparar();

    if (!/^\d+$/.test(String(id))) return { erro: "Modelo inválido." };

    const config = await lerConfigBanco(guild.id);

    if (config && String(config.modelo_id) === String(id)) {
        return { erro: "Esse é o modelo do painel atual. Escolha outro modelo antes de apagar." };
    }

    const [r] = await mysqlPool.query("DELETE FROM ticket_modelos WHERE id = ? AND guild_id = ?", [String(id), String(guild.id)]);

    if (!r.affectedRows) return { erro: "Esse modelo não existe." };

    return { ok: true };
}

module.exports = {
    ler,
    salvarConfig,
    publicar,
    criarModelo,
    salvarModelo,
    apagarModelo,
    _teste: { validarModelo, camposParaTexto, textoParaCampos, emojiValido, normalizarModelo, normalizarConfig }
};
