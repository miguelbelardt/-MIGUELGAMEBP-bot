// =====================================================
// 🎬 AVISOS DO YOUTUBE NO PAINEL
// =====================================================
// Usa a mesma tabela (youtube_inscricoes) e a mesma verificação automática do antigo /youtube.

const { ChannelType } = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const yt = require("./comandos/youtube.js")._painel;

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

async function ler(guild) {
    await yt.prepararTabela();

    const [linhas] = await mysqlPool.query(
        "SELECT * FROM youtube_inscricoes WHERE guild_id = ? ORDER BY id",
        [guild.id]
    );

    return {
        max: yt.MAX_POR_SERVIDOR,
        intervaloMin: yt.INTERVALO_VERIFICACAO / 60000,
        mensagemPadrao: yt.MENSAGEM_PADRAO,
        inscricoes: linhas.map(l => ({
            id: String(l.id),
            canal_nome: l.yt_canal_nome,
            canal_url: `https://www.youtube.com/channel/${l.yt_canal_id}`,
            destino_id: l.discord_canal_id,
            mensagem: l.mensagem
        })),
        canais: [...guild.channels.cache.values()]
            .filter(ehTexto)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name }))
    };
}

function validarMensagem(m) {
    if (typeof m !== "string") return "Mensagem inválida.";
    if (m.trim().length > 2000) return "A mensagem passou de 2000 caracteres.";
    if (!yt.temLink(m)) return "A mensagem precisa ter {link} — é nela que o link do vídeo entra.";

    return null;
}

function validarDestino(guild, id) {
    if (typeof id !== "string") return { erro: "Escolha o canal onde os avisos serão enviados." };

    const canal = guild.channels.cache.get(id);

    if (!ehTexto(canal)) return { erro: "Escolha um canal de texto válido." };
    if (!yt.podeEnviar(canal, guild)) return { erro: `Eu não consigo ver ou enviar mensagens em #${canal.name}. Ajuste as permissões do canal.` };

    return { canal };
}

function chavesOk(corpo, permitidas) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return "Dados inválidos.";

    for (const k of Object.keys(corpo)) {
        if (!permitidas.includes(k)) return `Opção desconhecida: ${String(k).slice(0, 40)}`;
    }

    return null;
}

async function adicionar(guild, corpo) {
    const e = chavesOk(corpo, ["canal", "destino_id", "mensagem"]);

    if (e) return { erro: e };

    const entrada = typeof corpo.canal === "string" ? corpo.canal.trim() : "";

    if (!entrada || entrada.length > 300) return { erro: "Informe o link, o @nome ou o ID do canal do YouTube." };

    const mensagem = corpo.mensagem === undefined || corpo.mensagem === "" ? yt.MENSAGEM_PADRAO : corpo.mensagem;
    const em = validarMensagem(mensagem);

    if (em) return { erro: em };

    const dest = validarDestino(guild, corpo.destino_id);

    if (dest.erro) return dest;

    await yt.prepararTabela();

    const [[{ total }]] = await mysqlPool.query(
        "SELECT COUNT(*) AS total FROM youtube_inscricoes WHERE guild_id = ?",
        [guild.id]
    );

    if (Number(total) >= yt.MAX_POR_SERVIDOR) return { erro: `Este servidor já acompanha ${yt.MAX_POR_SERVIDOR} canais. Remova um antes de adicionar outro.` };

    let idCanal = null;

    try {
        idCanal = await yt.descobrirIdDoCanal(entrada);
    } catch (err) {
        console.error("❌ YouTube (painel): erro ao descobrir o canal:", err?.message || err);
    }

    if (!idCanal) return { erro: "Não consegui achar esse canal. Use o link do canal (youtube.com/@nome ou youtube.com/channel/UC...), o @nome ou o ID que começa com UC." };

    const [existente] = await mysqlPool.query(
        "SELECT id FROM youtube_inscricoes WHERE guild_id = ? AND yt_canal_id = ?",
        [guild.id, idCanal]
    );

    if (existente.length) return { erro: "Este canal já está cadastrado. Edite a mensagem ou o destino dele na lista." };

    let feed;

    try {
        feed = await yt.buscarVideos(idCanal);
    } catch (err) {
        console.error("❌ YouTube (painel): erro ao ler o feed:", err?.message || err);

        return { erro: "O YouTube não devolveu os vídeos desse canal. Confira se o canal existe e tente de novo." };
    }

    const nome = (feed.nomeCanal || "Canal do YouTube").slice(0, 200);

    // Os vídeos que já existem hoje NÃO geram aviso: só os novos a partir de agora.
    const [r] = await mysqlPool.query(
        `INSERT INTO youtube_inscricoes
            (guild_id, yt_canal_id, yt_canal_nome, discord_canal_id, mensagem, vistos, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [guild.id, idCanal, nome, dest.canal.id, mensagem, JSON.stringify(feed.videos.map(v => v.id)), Date.now()]
    );

    return { ok: true, id: String(r.insertId), nome };
}

async function carregar(guild, id) {
    if (!/^\d{1,12}$/.test(String(id))) return null;

    await yt.prepararTabela();

    const [linhas] = await mysqlPool.query(
        "SELECT * FROM youtube_inscricoes WHERE id = ? AND guild_id = ?",
        [id, guild.id]
    );

    return linhas[0] || null;
}

async function editar(guild, id, corpo) {
    const e = chavesOk(corpo, ["destino_id", "mensagem"]);

    if (e) return { erro: e };

    const atual = await carregar(guild, id);

    if (!atual) return { erro: "Canal não encontrado." };

    let mensagem = atual.mensagem;
    let destino = atual.discord_canal_id;

    if ("mensagem" in corpo) {
        const em = validarMensagem(corpo.mensagem);

        if (em) return { erro: em };

        mensagem = corpo.mensagem;
    }

    if ("destino_id" in corpo) {
        const d = validarDestino(guild, corpo.destino_id);

        if (d.erro) return d;

        destino = d.canal.id;
    }

    await mysqlPool.query(
        "UPDATE youtube_inscricoes SET mensagem = ?, discord_canal_id = ? WHERE id = ? AND guild_id = ?",
        [mensagem, destino, id, guild.id]
    );

    return { ok: true };
}

async function remover(guild, id) {
    const atual = await carregar(guild, id);

    if (!atual) return { erro: "Canal não encontrado." };

    await mysqlPool.query("DELETE FROM youtube_inscricoes WHERE id = ? AND guild_id = ?", [id, guild.id]);

    return { ok: true, nome: atual.yt_canal_nome };
}

async function testar(guild, id) {
    const atual = await carregar(guild, id);

    if (!atual) return { erro: "Canal não encontrado." };

    const canal = await guild.channels.fetch(atual.discord_canal_id).catch(() => null);

    if (!ehTexto(canal)) return { erro: "O canal de destino não existe mais. Escolha outro." };

    let feed;

    try {
        feed = await yt.buscarVideos(atual.yt_canal_id);
    } catch {
        return { erro: "Não consegui ler os vídeos do YouTube agora. Tente de novo em instantes." };
    }

    if (!feed.videos.length) return { erro: "Esse canal ainda não tem vídeos públicos." };

    try {
        await canal.send({ content: yt.montarMensagem(atual.mensagem, feed.videos[0], feed.nomeCanal || atual.yt_canal_nome) });
    } catch {
        return { erro: `Não consegui enviar em #${canal.name}. Confira minhas permissões lá.` };
    }

    return { ok: true, destino: canal.name };
}

module.exports = { ler, adicionar, editar, remover, testar };
