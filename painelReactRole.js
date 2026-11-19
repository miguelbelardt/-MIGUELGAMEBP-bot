// =====================================================
// 🎭 REACTION ROLE NO PAINEL
// =====================================================
// Usa as mesmas tabelas e funções do /reactrole (react_role_configs e react_roles),
// então o que é feito aqui e no comando aparece nos dois lados.

const { ChannelType } = require("discord.js");

const reactrole = require("./comandos/reactrole.js");
const { mysqlPool } = require("./database/database.js");

const MAX_PARES = 20; // limite do Discord de reações diferentes numa mensagem
const MAX_CAMPOS = 10;

const TEXTOS = {
    content: 2000,
    embed_titulo: 256,
    embed_descricao: 4000,
    embed_autor_nome: 256,
    footer_texto: 2048
};

const LINKS = ["embed_url", "embed_autor_icone", "imagem", "thumbnail", "footer_icone"];
const BOOLEANOS = ["habilitado", "embed_habilitado", "footer_habilitado", "embed_timestamp"];

const EMOJI_PERSONALIZADO = /^<a?:\w{2,32}:\d{17,20}>$/;
const EMOJI_NORMAL = /^\p{Extended_Pictographic}[\p{Extended_Pictographic}️‍\u{1F3FB}-\u{1F3FF}]*$/u;

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

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

function ehCargoGerenciavel(guild, id) {
    const cargo = guild.roles.cache.get(String(id));

    return !!cargo && cargo.id !== guild.id && !cargo.managed && cargo.editable;
}

// ---------- validação ----------

// Valida os campos da mensagem. Devolve { campos } ou { erro }
function validarCampos(corpo, somenteReacoes) {
    const campos = {};

    for (const chave of Object.keys(corpo)) {
        if (["modo", "canal_id", "mensagem_id", "cargos", "id"].includes(chave)) continue;

        const valor = corpo[chave];

        if (somenteReacoes && chave !== "habilitado") {
            return { erro: "Essa mensagem já existia no servidor: aqui só dá para mexer nas reações e cargos." };
        }

        if (BOOLEANOS.includes(chave)) {
            if (typeof valor !== "boolean") return { erro: `Valor inválido em "${chave}".` };

            campos[chave] = valor;
        } else if (chave in TEXTOS) {
            if (typeof valor !== "string") return { erro: `Texto inválido em "${chave}".` };

            if (valor.length > TEXTOS[chave]) return { erro: `Texto grande demais em "${chave}" (máximo ${TEXTOS[chave]}).` };

            campos[chave] = valor.trim() || null;
        } else if (LINKS.includes(chave)) {
            if (typeof valor !== "string" || !linkValido(valor.trim())) return { erro: `"${chave}" precisa ser vazio ou um link http(s).` };

            campos[chave] = valor.trim() || null;
        } else if (chave === "embed_cor") {
            if (valor === "" || valor === null) campos.embed_cor = null;
            else if (typeof valor === "string" && /^#[0-9a-fA-F]{6}$/.test(valor)) campos.embed_cor = valor.toUpperCase();
            else return { erro: "Cor inválida. Use o formato #RRGGBB." };
        } else if (chave === "embed_campos") {
            if (!Array.isArray(valor) || valor.length > MAX_CAMPOS) return { erro: `No máximo ${MAX_CAMPOS} campos.` };

            const lista = [];

            for (const c of valor) {
                if (!c || typeof c.nome !== "string" || typeof c.valor !== "string") return { erro: "Campo inválido." };

                const nome = c.nome.trim();
                const v = c.valor.trim();

                if (!nome && !v) continue;
                if (!nome || !v) return { erro: "Todo campo precisa de nome e valor." };
                if (nome.length > 256 || v.length > 1024) return { erro: "Campo grande demais (nome até 256, valor até 1024)." };

                lista.push({ nome, valor: v, inline: c.inline === true });
            }

            campos.embed_campos = lista.length ? JSON.stringify(lista) : null;
        } else {
            return { erro: `Opção desconhecida: ${String(chave).slice(0, 40)}` };
        }
    }

    return { campos };
}

// Valida a lista de pares emoji → cargo. Devolve { pares } ou { erro }
function validarCargos(guild, lista) {
    if (!Array.isArray(lista)) return { erro: "Lista de cargos inválida." };

    if (lista.length > MAX_PARES) return { erro: `No máximo ${MAX_PARES} reações por mensagem.` };

    const pares = [];
    const vistos = new Set();

    for (const item of lista) {
        if (!item || typeof item.emoji !== "string" || typeof item.cargo_id !== "string") return { erro: "Reação inválida." };

        const bruto = item.emoji.trim();

        if (!(EMOJI_PERSONALIZADO.test(bruto) || EMOJI_NORMAL.test(bruto))) {
            return { erro: `Emoji inválido: ${bruto.slice(0, 30)}. Use um emoji normal ou um personalizado como <:nome:123456789012345678>.` };
        }

        const emoji = reactrole._painel.normalizarEmoji(bruto);
        const chave = reactrole._painel.chaveEmoji(emoji);

        if (vistos.has(chave)) return { erro: `O emoji ${bruto} está repetido.` };

        vistos.add(chave);

        if (!ehCargoGerenciavel(guild, item.cargo_id)) {
            return { erro: "Um dos cargos não existe ou eu não consigo gerenciá-lo. Coloque o cargo do bot acima dele." };
        }

        pares.push({ emoji, cargo_id: item.cargo_id });
    }

    return { pares };
}

// ---------- leitura ----------

function descrever(config, cargos) {
    return {
        id: String(config.id),
        canal_id: config.canal_id || null,
        mensagem_id: config.mensagem_id || null,
        somente_reacoes: !!Number(config.somente_reacoes),
        habilitado: !!Number(config.habilitado),
        content: config.content || "",
        embed_habilitado: !!Number(config.embed_habilitado),
        embed_titulo: config.embed_titulo || "",
        embed_url: config.embed_url || "",
        embed_descricao: config.embed_descricao || "",
        embed_cor: /^#[0-9a-f]{6}$/i.test(config.embed_cor || "") ? config.embed_cor.toUpperCase() : "#5865F2",
        embed_autor_nome: config.embed_autor_nome || "",
        embed_autor_icone: config.embed_autor_icone || "",
        imagem: config.imagem || "",
        thumbnail: config.thumbnail || "",
        footer_habilitado: !!Number(config.footer_habilitado),
        footer_texto: config.footer_texto || "",
        footer_icone: config.footer_icone || "",
        embed_timestamp: !!Number(config.embed_timestamp),
        embed_campos: reactrole._painel.parseCampos(config.embed_campos).map(c => ({
            nome: String(c.nome ?? ""), valor: String(c.valor ?? ""), inline: !!c.inline
        })),
        cargos: cargos.map(c => ({ emoji: c.emoji, cargo_id: c.cargo_id }))
    };
}

async function listaDoServidor(guild) {
    await reactrole._painel.garantirTabela();

    const [configs] = await mysqlPool.query(
        "SELECT * FROM react_role_configs WHERE guild_id = ? AND mensagem_id IS NOT NULL ORDER BY id DESC",
        [String(guild.id)]
    );

    const [cargos] = await mysqlPool.query("SELECT * FROM react_roles WHERE guild_id = ? ORDER BY id", [String(guild.id)]);

    return configs.map(c => descrever(c, cargos.filter(r => r.mensagem_id === c.mensagem_id)));
}

async function ler(guild) {
    const canais = [...guild.channels.cache.values()].filter(ehTexto).sort((a, b) => a.rawPosition - b.rawPosition);

    return {
        lista: await listaDoServidor(guild),
        canais: canais.map(c => ({ id: c.id, nome: c.name })),
        cargos: [...guild.roles.cache.values()]
            .filter(r => r.id !== guild.id && !r.managed)
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, nome: r.name, gerenciavel: !!r.editable })),
        maxPares: MAX_PARES,
        maxCampos: MAX_CAMPOS
    };
}

// ---------- aplicar na mensagem ----------

// Faz as reações e os cargos da mensagem ficarem iguais à lista enviada.
// Devolve { avisos } com o que não deu certo (ex.: emoji que o bot não consegue usar).
async function aplicarCargos(guild, mensagem, config, pares) {
    const rr = reactrole._painel;
    const avisos = [];
    const atuais = await rr.buscarCargos(guild.id, mensagem.id);
    const novas = new Set(pares.map(p => rr.chaveEmoji(p.emoji)));

    // removidos
    for (const atual of atuais) {
        if (novas.has(rr.chaveEmoji(atual.emoji))) continue;

        await rr.removerCargoReacao(guild.id, mensagem.id, atual.emoji);

        if (!Number(config.somente_reacoes)) {
            await rr.removerReacaoDaMensagem(mensagem, atual.emoji);
        } else {
            // mensagem de outra pessoa: tira só a reação do bot
            const reacao = mensagem.reactions.cache.find(r => rr.chaveEmoji(r.emoji) === rr.chaveEmoji(atual.emoji));
            await reacao?.users.remove(guild.members.me.id).catch(() => {});
        }
    }

    // novos ou alterados
    for (const par of pares) {
        const existente = atuais.find(a => rr.chaveEmoji(a.emoji) === rr.chaveEmoji(par.emoji));

        if (existente && existente.cargo_id === par.cargo_id) continue;

        try {
            const jaTem = mensagem.reactions.cache.find(r => rr.chaveEmoji(r.emoji) === rr.chaveEmoji(par.emoji));

            if (!jaTem) await mensagem.react(par.emoji);
        } catch {
            avisos.push(`Não consegui usar o emoji ${par.emoji} (ele existe e eu consigo usá-lo?).`);
            continue;
        }

        await rr.salvarCargo({
            guildId: guild.id,
            mensagemId: mensagem.id,
            emoji: par.emoji,
            cargoId: par.cargo_id,
            config
        });
    }

    // Reações que faltam na mensagem (ex.: alguém as removeu)
    await rr.adicionarReacoes(mensagem, await rr.buscarCargos(guild.id, mensagem.id));

    return avisos;
}

async function buscarMensagem(guild, canalId, mensagemId) {
    const canal = guild.channels.cache.get(String(canalId));

    if (!ehTexto(canal)) return null;

    try {
        return await canal.messages.fetch(String(mensagemId));
    } catch {
        return null;
    }
}

// ---------- criar ----------

async function criar(guild, corpo) {
    const rr = reactrole._painel;

    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    const existente = corpo.modo === "existente";

    if (corpo.modo !== "nova" && !existente) return { erro: "Escolha se é uma mensagem nova ou uma já existente." };

    const canal = guild.channels.cache.get(String(corpo.canal_id));

    if (!ehTexto(canal)) return { erro: "Escolha um canal válido." };

    const v = validarCampos(corpo, existente);

    if (v.erro) return v;

    const c = validarCargos(guild, corpo.cargos ?? []);

    if (c.erro) return c;

    if (!c.pares.length) return { erro: "Adicione pelo menos uma reação com cargo." };

    await rr.garantirTabela();

    let mensagemExistente = null;

    if (existente) {
        if (typeof corpo.mensagem_id !== "string" || !/^\d{17,20}$/.test(corpo.mensagem_id.trim())) return { erro: "ID da mensagem inválido." };

        mensagemExistente = await buscarMensagem(guild, canal.id, corpo.mensagem_id.trim());

        if (!mensagemExistente) return { erro: "Não achei essa mensagem nesse canal." };

        if (mensagemExistente.author?.id === guild.client.user.id) {
            return { erro: "Essa mensagem é do próprio bot. Crie uma mensagem nova aqui no site." };
        }

        if (await rr.buscarConfigMensagem(guild.id, mensagemExistente.id)) return { erro: "Essa mensagem já tem Reaction Role configurado." };
    }

    const id = await rr.criarConfig(guild.id, existente);

    try {
        const base = {
            canal_id: canal.id,
            mensagem_id: existente ? mensagemExistente.id : null,
            somente_reacoes: existente ? 1 : 0,
            embed_habilitado: 1,
            ...v.campos
        };

        // booleanos do formulário viram 0/1 no banco
        for (const k of BOOLEANOS) if (typeof base[k] === "boolean") base[k] = base[k] ? 1 : 0;

        await rr.atualizarConfig(id, guild.id, base);

        let config = await rr.buscarConfig(id, guild.id);
        let mensagem = mensagemExistente;

        if (!existente) {
            const embed = rr.criarEmbed(config);

            if (!config.content && !embed) {
                await rr.excluirConfigDoBanco(config, guild.id);

                return { erro: "Escreva uma mensagem ou preencha o embed." };
            }

            try {
                mensagem = await canal.send({ content: config.content || null, embeds: embed ? [embed] : [] });
            } catch {
                await rr.excluirConfigDoBanco(config, guild.id);

                return { erro: "Não consegui enviar a mensagem. Confira se o bot pode ver e enviar mensagens nesse canal." };
            }

            await rr.atualizarConfig(id, guild.id, { mensagem_id: mensagem.id });
            config = await rr.buscarConfig(id, guild.id);
        }

        const avisos = await aplicarCargos(guild, mensagem, config, c.pares);

        if (!existente) await rr.sincronizarCargos(guild.id, mensagem.id, config);

        return { ok: true, id: String(id), avisos };
    } catch (erro) {
        // não deixa uma configuração pela metade
        const sobra = await rr.buscarConfig(id, guild.id).catch(() => null);

        if (sobra && !sobra.mensagem_id) await rr.excluirConfigDoBanco(sobra, guild.id).catch(() => {});

        throw erro;
    }
}

// ---------- salvar ----------

async function salvar(guild, id, corpo) {
    const rr = reactrole._painel;

    if (!/^\d+$/.test(String(id))) return { erro: "Configuração inválida." };

    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    await rr.garantirTabela();

    const config = await rr.buscarConfig(String(id), guild.id);

    if (!config || !config.mensagem_id) return { erro: "Essa configuração não existe." };

    if ("canal_id" in corpo && corpo.canal_id !== config.canal_id) return { erro: "Não dá para trocar o canal de uma mensagem já enviada." };

    if ("mensagem_id" in corpo && corpo.mensagem_id !== config.mensagem_id) return { erro: "Não dá para trocar a mensagem." };

    const somente = !!Number(config.somente_reacoes);
    const v = validarCampos(corpo, somente);

    if (v.erro) return v;

    let pares = null;

    if ("cargos" in corpo) {
        const c = validarCargos(guild, corpo.cargos);

        if (c.erro) return c;

        if (!c.pares.length) return { erro: "A mensagem precisa ter pelo menos uma reação com cargo. Para remover tudo, apague a configuração." };

        pares = c.pares;
    }

    const mensagem = await buscarMensagem(guild, config.canal_id, config.mensagem_id);

    if (!mensagem) return { erro: "A mensagem não existe mais no canal. Apague esta configuração e crie de novo." };

    const novo = { ...v.campos };

    for (const k of BOOLEANOS) if (typeof novo[k] === "boolean") novo[k] = novo[k] ? 1 : 0;

    if (Object.keys(novo).length) await rr.atualizarConfig(config.id, guild.id, novo);

    const atualizada = await rr.buscarConfig(config.id, guild.id);

    if (!somente) {
        const embed = rr.criarEmbed(atualizada);

        if (!atualizada.content && !embed) return { erro: "A mensagem precisa ter texto ou embed." };

        try {
            await rr.aplicarMensagem(mensagem, atualizada);
        } catch {
            return { erro: "Não consegui editar a mensagem. Confira as permissões do bot no canal." };
        }
    }

    let avisos = [];

    if (pares) avisos = await aplicarCargos(guild, mensagem, atualizada, pares);

    if (!somente) await rr.sincronizarCargos(guild.id, mensagem.id, atualizada);

    return { ok: true, avisos };
}

// ---------- apagar ----------

async function apagar(guild, id) {
    const rr = reactrole._painel;

    if (!/^\d+$/.test(String(id))) return { erro: "Configuração inválida." };

    await rr.garantirTabela();

    const config = await rr.buscarConfig(String(id), guild.id);

    if (!config) return { erro: "Essa configuração não existe." };

    if (config.canal_id && config.mensagem_id) {
        const mensagem = await buscarMensagem(guild, config.canal_id, config.mensagem_id);

        if (mensagem) {
            try {
                if (Number(config.somente_reacoes)) {
                    // mensagem de outra pessoa: não é apagada, só saem as reações do bot
                    for (const par of await rr.buscarCargos(guild.id, mensagem.id)) {
                        const reacao = mensagem.reactions.cache.find(r => rr.chaveEmoji(r.emoji) === rr.chaveEmoji(par.emoji));
                        await reacao?.users.remove(guild.members.me.id).catch(() => {});
                    }
                } else {
                    await mensagem.delete();
                }
            } catch (erro) {
                if (erro?.code !== 10008) return { erro: "Não consegui apagar a mensagem. O bot precisa da permissão Gerenciar Mensagens no canal." };
            }
        }
    }

    await rr.excluirConfigDoBanco(config, guild.id);

    return { ok: true };
}

module.exports = {
    ler,
    criar,
    salvar,
    apagar,
    _teste: { validarCampos, validarCargos, descrever }
};
