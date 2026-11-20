const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
    Events
} = require("discord.js");

const { mysqlPool } = require("../database/database.js");

// =====================================================
// ⚙️ CONFIGURAÇÕES
// =====================================================

const COR = 0xFF0000;

// De quanto em quanto tempo o bot procura vídeos novos.
const INTERVALO_VERIFICACAO = 5 * 60 * 1000;

// Quantos canais do YouTube cada servidor pode acompanhar.
const MAX_POR_SERVIDOR = 10;

// Máximo de avisos por canal em cada verificação (evita flood).
const MAX_AVISOS_POR_VERIFICACAO = 3;

// Vídeos publicados há mais tempo que isso nunca são avisados
// (ex.: o bot ficou desligado por dias).
const IDADE_MAXIMA_VIDEO = 2 * 24 * 60 * 60 * 1000;

const TEMPO_LIMITE_REDE = 15 * 1000;

const MENSAGEM_PADRAO =
    "🎬 Saiu vídeo novo no canal! Assista agora: {link}";

// =====================================================
// 😀 EMOJIS DO YOUTUBE
// =====================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).
// Os outros ficam aqui: para trocar, coloque o código do emoji
// (use /emojiinfo) ou um emoji normal.

const emojis = require("../emojis.js");

const EMOJIS = {
    youtube: "🎬",
    erro: emojis.erro,
    sucesso: emojis.sucesso,
    relogio: emojis.relogio
};

// =====================================================
// 🏗️ TABELA (criada sozinha na primeira vez)
// =====================================================

let tabelaPronta = null;

function prepararTabela() {
    if (!tabelaPronta) {
        tabelaPronta =
            mysqlPool.query(`
                CREATE TABLE IF NOT EXISTS youtube_inscricoes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    guild_id VARCHAR(30) NOT NULL,
                    yt_canal_id VARCHAR(40) NOT NULL,
                    yt_canal_nome VARCHAR(200) NOT NULL,
                    discord_canal_id VARCHAR(30) NOT NULL,
                    mensagem TEXT NOT NULL,
                    vistos TEXT NOT NULL,
                    criado_em BIGINT NOT NULL,
                    UNIQUE KEY unico_servidor_canal (guild_id, yt_canal_id)
                )
            `).catch(erro => {
                // Se falhar, tenta de novo na próxima vez
                tabelaPronta = null;
                throw erro;
            });
    }

    return tabelaPronta;
}

// =====================================================
// 🌐 REDE
// =====================================================

async function buscarTexto(url, cabecalhos = {}) {
    const controle = new AbortController();

    const relogio =
        setTimeout(
            () => controle.abort(),
            TEMPO_LIMITE_REDE
        );

    try {
        const resposta =
            await fetch(url, {
                signal: controle.signal,
                redirect: "follow",
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (compatible; DiscordBot)",
                    "Accept-Language": "en-US,en;q=0.9",
                    ...cabecalhos
                }
            });

        return {
            ok: resposta.ok,
            status: resposta.status,
            texto: await resposta.text()
        };

    } finally {
        clearTimeout(relogio);
    }
}

// =====================================================
// 🔎 DESCOBRIR O ID DO CANAL
// =====================================================
// Aceita: ID (UC...), link /channel/UC..., @nome ou link do
// canal (youtube.com/@nome, /c/nome, /user/nome).

const ID_CANAL = /^UC[\w-]{22}$/;

async function descobrirIdDoCanal(entrada) {
    const texto =
        String(entrada || "").trim();

    if (ID_CANAL.test(texto)) {
        return texto;
    }

    const noLink =
        texto.match(
            /youtube\.com\/channel\/(UC[\w-]{22})/i
        );

    if (noLink) {
        return noLink[1];
    }

    let url = null;

    if (/^@[\w.\-]+$/.test(texto)) {
        url = `https://www.youtube.com/${texto}`;

    } else if (
        /^(https?:\/\/)?(www\.|m\.)?youtube\.com\//i
            .test(texto)
    ) {
        url = /^https?:\/\//i.test(texto)
            ? texto
            : `https://${texto}`;
    }

    // Só abrimos links do próprio YouTube.
    if (!url) {
        return null;
    }

    const pagina =
        await buscarTexto(
            url,
            { Cookie: "SOCS=CAI; CONSENT=YES+1" }
        );

    const achado =
        pagina.texto.match(
            /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/
        ) ||
        pagina.texto.match(
            /"externalId":"(UC[\w-]{22})"/
        ) ||
        pagina.texto.match(
            /"channelId":"(UC[\w-]{22})"/
        );

    return achado ? achado[1] : null;
}

// =====================================================
// 📺 LER O FEED DO CANAL
// =====================================================

function decodificar(texto) {
    return String(texto || "")
        .replace(
            /&#x([0-9a-f]+);/gi,
            (_, n) => String.fromCodePoint(parseInt(n, 16))
        )
        .replace(
            /&#(\d+);/g,
            (_, n) => String.fromCodePoint(Number(n))
        )
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .trim();
}

function lerFeed(xml) {
    const partes = String(xml).split("<entry>");

    const cabecalho = partes[0];

    const nomeCanal =
        decodificar(
            (
                cabecalho.match(
                    /<author>\s*<name>([\s\S]*?)<\/name>/
                ) || []
            )[1]
        );

    const videos =
        partes
            .slice(1)
            .map(entrada => ({
                id: (
                    entrada.match(
                        /<yt:videoId>([\w-]{11})<\/yt:videoId>/
                    ) || []
                )[1],

                titulo: decodificar(
                    (
                        entrada.match(
                            /<title>([\s\S]*?)<\/title>/
                        ) || []
                    )[1]
                ),

                publicadoEm: Date.parse(
                    (
                        entrada.match(
                            /<published>(.*?)<\/published>/
                        ) || []
                    )[1] || ""
                ) || 0
            }))
            .filter(video => video.id);

    return { nomeCanal, videos };
}

async function buscarVideos(idCanal) {
    const resposta =
        await buscarTexto(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${idCanal}`
        );

    if (!resposta.ok) {
        throw new Error(
            `O YouTube respondeu ${resposta.status} ao ler o canal ${idCanal}.`
        );
    }

    return lerFeed(resposta.texto);
}

// =====================================================
// ✉️ MONTAR A MENSAGEM
// =====================================================
// Variáveis: {link}, {titulo} e {canal}.

function neutralizarMencoes(texto) {
    // Título/nome vêm do YouTube: nunca podem marcar ninguém.
    return String(texto).replace(/@/g, "@​");
}

function temLink(modelo) {
    return /\{link\}/i.test(String(modelo));
}

function montarMensagem(modelo, video, nomeCanal) {
    return String(modelo)
        .replace(
            /\{link\}/gi,
            () => `https://www.youtube.com/watch?v=${video.id}`
        )
        .replace(
            /\{titulo\}/gi,
            () => neutralizarMencoes(video.titulo)
        )
        .replace(
            /\{canal\}/gi,
            () => neutralizarMencoes(nomeCanal)
        )
        .slice(0, 2000);
}

// =====================================================
// 🗄️ BANCO
// =====================================================

function lerVistos(texto) {
    try {
        const lista = JSON.parse(texto);

        return Array.isArray(lista)
            ? lista.map(String)
            : [];

    } catch {
        return [];
    }
}

async function buscarInscricao(guildId, id) {
    const [linhas] =
        await mysqlPool.query(
            `
            SELECT *
            FROM youtube_inscricoes
            WHERE id = ?
            AND guild_id = ?
            `,
            [id, guildId]
        );

    return linhas[0] || null;
}

// =====================================================
// 🔁 VERIFICAÇÃO AUTOMÁTICA
// =====================================================

let rodando = false;
let iniciado = false;

function pausa(ms) {
    return new Promise(resolver => setTimeout(resolver, ms));
}

async function pegarCanalDiscord(client, inscricao) {
    try {
        const canal =
            client.channels.cache.get(
                inscricao.discord_canal_id
            ) ||
            await client.channels.fetch(
                inscricao.discord_canal_id
            );

        if (
            !canal ||
            !canal.isTextBased() ||
            canal.guildId !== inscricao.guild_id
        ) {
            return null;
        }

        return canal;

    } catch {
        return null;
    }
}

async function processarInscricao(client, inscricao, feed) {
    const vistos =
        lerVistos(inscricao.vistos);

    const novos =
        feed.videos.filter(
            video => !vistos.includes(video.id)
        );

    if (novos.length === 0) {
        return;
    }

    const agora = Date.now();

    // Do mais antigo para o mais novo, só os recentes e no
    // máximo MAX_AVISOS_POR_VERIFICACAO (os mais novos).
    const paraEnviar =
        novos
            .filter(
                video =>
                    !video.publicadoEm ||
                    agora - video.publicadoEm <=
                        IDADE_MAXIMA_VIDEO
            )
            .reverse()
            .slice(-MAX_AVISOS_POR_VERIFICACAO);

    const descartados =
        novos.filter(
            video => !paraEnviar.includes(video)
        );

    const enviados = [];

    const canal =
        await pegarCanalDiscord(client, inscricao);

    if (canal) {
        for (const video of paraEnviar) {
            try {
                await canal.send({
                    content: montarMensagem(
                        inscricao.mensagem,
                        video,
                        feed.nomeCanal ||
                            inscricao.yt_canal_nome
                    )
                });

                enviados.push(video.id);

            } catch (erro) {
                console.error(
                    `❌ YouTube: não consegui enviar o aviso (inscrição ${inscricao.id}):`,
                    erro?.message || erro
                );

                // Os que faltam ficam sem marcar: tenta de novo
                // na próxima verificação.
                break;
            }
        }
    }

    const novaLista =
        [
            ...enviados,
            ...descartados.map(video => video.id),
            ...vistos
        ]
            .filter(
                (id, posicao, lista) =>
                    lista.indexOf(id) === posicao
            )
            .slice(0, 60);

    await mysqlPool.query(
        `
        UPDATE youtube_inscricoes
        SET vistos = ?
        WHERE id = ?
        `,
        [
            JSON.stringify(novaLista),
            inscricao.id
        ]
    );

    if (enviados.length > 0) {
        console.log(
            `🎬 YouTube: ${enviados.length} aviso(s) enviado(s) de ${feed.nomeCanal || inscricao.yt_canal_nome} (servidor ${inscricao.guild_id})`
        );
    }
}

async function verificar(client) {
    if (rodando) {
        return;
    }

    rodando = true;

    try {
        await prepararTabela();

        const [inscricoes] =
            await mysqlPool.query(
                "SELECT * FROM youtube_inscricoes"
            );

        // Cada canal do YouTube é lido uma vez só, mesmo
        // que vários servidores o acompanhem.
        const porCanal = new Map();

        for (const inscricao of inscricoes) {
            if (
                !client.guilds.cache.has(
                    inscricao.guild_id
                )
            ) {
                continue;
            }

            if (!porCanal.has(inscricao.yt_canal_id)) {
                porCanal.set(inscricao.yt_canal_id, []);
            }

            porCanal.get(inscricao.yt_canal_id)
                .push(inscricao);
        }

        for (const [idCanal, lista] of porCanal) {
            let feed;

            try {
                feed = await buscarVideos(idCanal);

            } catch (erro) {
                console.warn(
                    `⚠️ YouTube: não consegui ler o canal ${idCanal}:`,
                    erro?.message || erro
                );

                continue;
            }

            for (const inscricao of lista) {
                try {
                    await processarInscricao(
                        client,
                        inscricao,
                        feed
                    );

                } catch (erro) {
                    console.error(
                        `❌ YouTube: erro na inscrição ${inscricao.id}:`,
                        erro
                    );
                }
            }

            await pausa(1000);
        }

    } catch (erro) {
        console.error(
            "❌ YouTube: erro na verificação automática:",
            erro
        );

    } finally {
        rodando = false;
    }
}

// Chamado pelo index.js (uma vez, ao ligar o bot).
function iniciar(client) {
    const comecar = () => {
        if (iniciado) {
            return;
        }

        iniciado = true;

        console.log(
            "🎬 Sistema de avisos do YouTube iniciado."
        );

        setTimeout(() => verificar(client), 20 * 1000);

        setInterval(
            () => verificar(client),
            INTERVALO_VERIFICACAO
        );
    };

    if (client.isReady()) {
        comecar();
    } else {
        client.once(Events.ClientReady, comecar);
    }
}

// =====================================================
// 💬 RESPOSTAS DO COMANDO
// =====================================================

function podeEnviar(canal, guild) {
    const permissoes =
        canal.permissionsFor(guild.members.me);

    return Boolean(
        permissoes &&
        permissoes.has(PermissionFlagsBits.ViewChannel) &&
        permissoes.has(PermissionFlagsBits.SendMessages)
    );
}

// =====================================================
// 🎬 COMANDO
// =====================================================

module.exports = {
    iniciar
};

// O comando /youtube foi removido: agora tudo é configurado pelo painel do site.
// Este arquivo continua porque o bot ainda verifica os vídeos novos e manda os avisos.
// Usado pelo painel do site (painelYouTube.js)
module.exports._painel = {
    MENSAGEM_PADRAO,
    MAX_POR_SERVIDOR,
    INTERVALO_VERIFICACAO,
    prepararTabela,
    descobrirIdDoCanal,
    buscarVideos,
    montarMensagem,
    temLink,
    podeEnviar,
    pegarCanalDiscord
};
