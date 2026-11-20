// =====================================================
// 🎙️ CALL PERSONALIZADA NO PAINEL
// =====================================================
// Usa a mesma tabela e o mesmo painel público do antigo /criarcall (callp_config).

const { ChannelType } = require("discord.js");

const cc = require("./comandos/criarcall.js");

const CHAVES_EMOJI = ["criar", "nome", "limite", "privar", "publica", "adicionar", "remover"];

const TEXTOS = {
    embed_titulo: 256,
    embed_descricao: 4096,
    embed_rodape: 2048
};

const LINKS = ["embed_thumbnail", "embed_imagem", "embed_rodape_icone"];

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

function descrever(config, guild) {
    const p = cc._painel;
    const emojis = {};

    for (const chave of CHAVES_EMOJI) {
        emojis[chave] = { valor: config[`emoji_${chave}`] || p.BOTOES[chave].emoji, padrao: p.BOTOES[chave].emoji, nome: p.BOTOES[chave].texto };
    }

    return {
        categoria_id: config.categoria_id || null,
        canal_id: config.canal_id || null,
        publicado: !!(config.canal_id && config.mensagem_id),
        embed_titulo: config.embed_titulo || p.PADRAO.titulo,
        embed_descricao: config.embed_descricao || p.PADRAO.descricao,
        embed_cor: (config.embed_cor && /^#[0-9a-f]{6}$/i.test(config.embed_cor) ? config.embed_cor : p.PADRAO.cor).toUpperCase(),
        embed_rodape: config.embed_rodape || "",
        embed_rodape_icone: config.embed_rodape_icone || "",
        embed_thumbnail: config.embed_thumbnail || "",
        embed_imagem: config.embed_imagem || "",
        emojis,
        categorias: [...guild.channels.cache.values()]
            .filter(c => c.type === ChannelType.GuildCategory)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name })),
        canais: [...guild.channels.cache.values()]
            .filter(ehTexto)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name }))
    };
}

async function ler(guild) {
    return descrever(await cc._painel.carregarConfig(guild.id), guild);
}

// Devolve { erro } ou { ok, atualizado }
async function salvar(guild, corpo) {
    const p = cc._painel;

    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    const novo = {};

    for (const [chave, valor] of Object.entries(corpo)) {
        if (chave in TEXTOS) {
            if (typeof valor !== "string") return { erro: `Texto inválido em "${chave}".` };
            if (valor.length > TEXTOS[chave]) return { erro: `Texto grande demais em "${chave}" (máximo ${TEXTOS[chave]}).` };

            novo[chave] = valor.trim();
        } else if (LINKS.includes(chave)) {
            if (typeof valor !== "string") return { erro: `Link inválido em "${chave}".` };

            const v = valor.trim();

            if (v && !p.urlValida(v)) return { erro: "Os links precisam começar com http:// ou https://" };

            novo[chave] = v;
        } else if (chave === "embed_cor") {
            const cor = p.normalizarCor(typeof valor === "string" ? valor : "");

            if (cor === null) return { erro: "Cor inválida. Use o formato #RRGGBB." };

            novo.embed_cor = cor;
        } else if (chave === "categoria_id") {
            if (valor === null || valor === "") novo.categoria_id = null;
            else if (typeof valor === "string" && guild.channels.cache.get(valor)?.type === ChannelType.GuildCategory) novo.categoria_id = valor;
            else return { erro: "Categoria inválida." };
        } else if (chave === "canal_id") {
            if (typeof valor !== "string" || !ehTexto(guild.channels.cache.get(valor))) return { erro: "Escolha um canal de texto válido." };

            novo.canal_id = valor;
        } else if (chave === "emojis") {
            if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { erro: "Emojis inválidos." };

            for (const [k, v] of Object.entries(valor)) {
                if (!CHAVES_EMOJI.includes(k)) return { erro: `Botão desconhecido: ${String(k).slice(0, 30)}` };
                if (typeof v !== "string") return { erro: "Emoji inválido." };

                const emoji = p.normalizarEmoji(v);

                if (emoji === null) {
                    return { erro: `O emoji de "${p.BOTOES[k].texto}" é inválido. Use um emoji normal ou um personalizado como <:nome:123456789012345678>.` };
                }

                // igual ao padrão = não precisa guardar
                novo[`emoji_${k}`] = emoji === p.BOTOES[k].emoji ? null : emoji;
            }
        } else {
            return { erro: `Opção desconhecida: ${String(chave).slice(0, 40)}` };
        }
    }

    if (!Object.keys(novo).length) return { erro: "Nada para salvar." };

    const atual = await p.carregarConfig(guild.id);

    // Trocou de canal: o painel antigo fica para trás (igual ao comando)
    if ("canal_id" in novo && atual.canal_id !== novo.canal_id) novo.mensagem_id = null;

    await p.salvarConfig(guild.id, novo);

    const atualizado = await p.atualizarPublicacao(guild);

    return { ok: true, atualizado };
}

async function publicar(guild) {
    const p = cc._painel;
    const config = await p.carregarConfig(guild.id);

    if (!config.canal_id) return { erro: "Primeiro escolha o canal onde o painel será publicado." };

    const canal = await guild.channels.fetch(config.canal_id).catch(() => null);

    if (!canal || !ehTexto(canal)) return { erro: "O canal escolhido não existe ou não é um canal de texto." };

    const payload = p.criarPainelPublico(config);

    try {
        if (config.mensagem_id) {
            const mensagem = await canal.messages.fetch(config.mensagem_id).catch(() => null);

            if (mensagem) {
                await mensagem.edit(payload);

                return { ok: true, atualizado: true };
            }
        }

        const mensagem = await canal.send(payload);

        await p.salvarConfig(guild.id, { mensagem_id: mensagem.id });
    } catch {
        return { erro: "Não consegui enviar o painel. Confira se o bot pode ver e enviar mensagens nesse canal." };
    }

    return { ok: true, atualizado: false };
}

module.exports = { ler, salvar, publicar, _teste: { descrever } };
