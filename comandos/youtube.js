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

function resumo(inscricao) {
    return (
        `**#${inscricao.id}** • [${inscricao.yt_canal_nome}](https://www.youtube.com/channel/${inscricao.yt_canal_id}) → <#${inscricao.discord_canal_id}>`
    );
}

function podeEnviar(canal, guild) {
    const permissoes =
        canal.permissionsFor(guild.members.me);

    return Boolean(
        permissoes &&
        permissoes.has(PermissionFlagsBits.ViewChannel) &&
        permissoes.has(PermissionFlagsBits.SendMessages)
    );
}

async function adicionar(interaction) {
    const entrada =
        interaction.options.getString("canal");

    const destino =
        interaction.options.getChannel("destino");

    const mensagem =
        interaction.options.getString("mensagem") ||
        MENSAGEM_PADRAO;

    if (!temLink(mensagem)) {
        return `${EMOJIS.erro} A mensagem precisa ter a variável \`{link}\` — é nela que o link do vídeo entra.`;
    }

    if (!podeEnviar(destino, interaction.guild)) {
        return `${EMOJIS.erro} Eu não consigo ver ou enviar mensagens em ${destino}. Ajuste as permissões do canal.`;
    }

    const [contagem] =
        await mysqlPool.query(
            `
            SELECT COUNT(*) AS total
            FROM youtube_inscricoes
            WHERE guild_id = ?
            `,
            [interaction.guild.id]
        );

    if (Number(contagem[0].total) >= MAX_POR_SERVIDOR) {
        return `${EMOJIS.erro} Este servidor já acompanha ${MAX_POR_SERVIDOR} canais. Remova um com \`/youtube remover\` antes de adicionar outro.`;
    }

    let idCanal;

    try {
        idCanal =
            await descobrirIdDoCanal(entrada);

    } catch (erro) {
        console.error(
            "❌ YouTube: erro ao descobrir o canal:",
            erro?.message || erro
        );

        idCanal = null;
    }

    if (!idCanal) {
        return `${EMOJIS.erro} Não consegui achar esse canal. Use o link do canal (\`youtube.com/@nome\` ou \`youtube.com/channel/UC...\`), o \`@nome\` ou o ID que começa com \`UC\`.`;
    }

    const [existente] =
        await mysqlPool.query(
            `
            SELECT id
            FROM youtube_inscricoes
            WHERE guild_id = ?
            AND yt_canal_id = ?
            `,
            [interaction.guild.id, idCanal]
        );

    if (existente.length > 0) {
        return `${EMOJIS.erro} Este canal já está cadastrado (#${existente[0].id}). Use \`/youtube editar\` para mudar a mensagem ou o destino.`;
    }

    let feed;

    try {
        feed = await buscarVideos(idCanal);

    } catch (erro) {
        console.error(
            "❌ YouTube: erro ao ler o feed:",
            erro?.message || erro
        );

        return `${EMOJIS.erro} O YouTube não devolveu os vídeos desse canal. Confira se o canal existe e tente de novo.`;
    }

    const nome =
        (feed.nomeCanal || "Canal do YouTube")
            .slice(0, 200);

    // Os vídeos que já existem hoje NÃO geram aviso:
    // só os vídeos novos a partir de agora.
    const [resultado] =
        await mysqlPool.query(
            `
            INSERT INTO youtube_inscricoes (
                guild_id,
                yt_canal_id,
                yt_canal_nome,
                discord_canal_id,
                mensagem,
                vistos,
                criado_em
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                interaction.guild.id,
                idCanal,
                nome,
                destino.id,
                mensagem,
                JSON.stringify(
                    feed.videos.map(video => video.id)
                ),
                Date.now()
            ]
        );

    const exemplo =
        feed.videos[0]
            ? montarMensagem(mensagem, feed.videos[0], nome)
            : mensagem;

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(`${EMOJIS.sucesso} Canal adicionado`)
            .setDescription(
                `${resumo({
                    id: resultado.insertId,
                    yt_canal_nome: nome,
                    yt_canal_id: idCanal,
                    discord_canal_id: destino.id
                })}\n\n` +
                `**Prévia da mensagem:**\n${exemplo}\n\n` +
                `Vou avisar apenas dos vídeos que forem publicados daqui pra frente. ` +
                `Use \`/youtube testar\` para ver como fica no canal.`
            )
            .setFooter({
                text: `Verifico a cada ${INTERVALO_VERIFICACAO / 60000} minutos.`
            });

    return { embeds: [embed] };
}

async function editar(interaction) {
    const id =
        interaction.options.getInteger("id");

    const mensagem =
        interaction.options.getString("mensagem");

    const destino =
        interaction.options.getChannel("destino");

    if (!mensagem && !destino) {
        return `${EMOJIS.erro} Informe a nova \`mensagem\`, o novo \`destino\`, ou os dois.`;
    }

    const inscricao =
        await buscarInscricao(interaction.guild.id, id);

    if (!inscricao) {
        return `${EMOJIS.erro} Não achei o item #${id}. Veja os números com \`/youtube listar\`.`;
    }

    if (mensagem && !temLink(mensagem)) {
        return `${EMOJIS.erro} A mensagem precisa ter a variável \`{link}\`.`;
    }

    if (destino && !podeEnviar(destino, interaction.guild)) {
        return `${EMOJIS.erro} Eu não consigo ver ou enviar mensagens em ${destino}. Ajuste as permissões do canal.`;
    }

    await mysqlPool.query(
        `
        UPDATE youtube_inscricoes
        SET mensagem = ?,
            discord_canal_id = ?
        WHERE id = ?
        AND guild_id = ?
        `,
        [
            mensagem || inscricao.mensagem,
            destino ? destino.id : inscricao.discord_canal_id,
            id,
            interaction.guild.id
        ]
    );

    return `${EMOJIS.sucesso} Item #${id} atualizado.`;
}

async function remover(interaction) {
    const id =
        interaction.options.getInteger("id");

    const inscricao =
        await buscarInscricao(interaction.guild.id, id);

    if (!inscricao) {
        return `${EMOJIS.erro} Não achei o item #${id}. Veja os números com \`/youtube listar\`.`;
    }

    await mysqlPool.query(
        `
        DELETE FROM youtube_inscricoes
        WHERE id = ?
        AND guild_id = ?
        `,
        [id, interaction.guild.id]
    );

    return `${EMOJIS.sucesso} **${inscricao.yt_canal_nome}** removido. Não vou mais avisar dos vídeos desse canal.`;
}

async function listar(interaction) {
    const [linhas] =
        await mysqlPool.query(
            `
            SELECT *
            FROM youtube_inscricoes
            WHERE guild_id = ?
            ORDER BY id
            `,
            [interaction.guild.id]
        );

    if (linhas.length === 0) {
        return `${EMOJIS.youtube} Nenhum canal cadastrado ainda. Use \`/youtube adicionar\`.`;
    }

    const texto =
        linhas
            .map(inscricao => {
                const previa =
                    String(inscricao.mensagem)
                        .replace(/\s+/g, " ")
                        .slice(0, 80);

                return `${resumo(inscricao)}\n> ${neutralizarMencoes(previa)}`;
            })
            .join("\n\n");

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(`${EMOJIS.youtube} Canais do YouTube`)
            .setDescription(texto.slice(0, 4000))
            .setFooter({
                text: `${linhas.length}/${MAX_POR_SERVIDOR} canais`
            });

    return { embeds: [embed] };
}

async function testar(interaction) {
    const id =
        interaction.options.getInteger("id");

    const inscricao =
        await buscarInscricao(interaction.guild.id, id);

    if (!inscricao) {
        return `${EMOJIS.erro} Não achei o item #${id}. Veja os números com \`/youtube listar\`.`;
    }

    const canal =
        await pegarCanalDiscord(
            interaction.client,
            inscricao
        );

    if (!canal) {
        return `${EMOJIS.erro} Não encontrei o canal <#${inscricao.discord_canal_id}>. Use \`/youtube editar\` para escolher outro.`;
    }

    let feed;

    try {
        feed = await buscarVideos(inscricao.yt_canal_id);

    } catch {
        return `${EMOJIS.erro} Não consegui ler os vídeos do YouTube agora. Tente de novo em instantes.`;
    }

    if (feed.videos.length === 0) {
        return `${EMOJIS.erro} Esse canal ainda não tem vídeos públicos.`;
    }

    try {
        await canal.send({
            content: montarMensagem(
                inscricao.mensagem,
                feed.videos[0],
                feed.nomeCanal || inscricao.yt_canal_nome
            )
        });

    } catch {
        return `${EMOJIS.erro} Não consegui enviar em ${canal}. Confira minhas permissões lá.`;
    }

    return `${EMOJIS.sucesso} Teste enviado em ${canal}, com o último vídeo do canal.`;
}

// =====================================================
// 🎬 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("youtube")
        .setDescription(
            "Avisa no servidor quando um canal do YouTube posta vídeo novo."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )

        .addSubcommand(sub =>
            sub
                .setName("adicionar")
                .setDescription(
                    "Acompanha um canal do YouTube."
                )
                .addStringOption(option =>
                    option
                        .setName("canal")
                        .setDescription(
                            "Link do canal, @nome ou ID (UC...)."
                        )
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName("destino")
                        .setDescription(
                            "Canal do Discord onde o aviso será enviado."
                        )
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("mensagem")
                        .setDescription(
                            "Texto do aviso. Use {link}, {titulo} e {canal}."
                        )
                        .setMaxLength(1000)
                        .setRequired(false)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("editar")
                .setDescription(
                    "Muda a mensagem ou o destino de um canal."
                )
                .addIntegerOption(option =>
                    option
                        .setName("id")
                        .setDescription(
                            "Número do item (veja em /youtube listar)."
                        )
                        .setMinValue(1)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("mensagem")
                        .setDescription(
                            "Novo texto. Use {link}, {titulo} e {canal}."
                        )
                        .setMaxLength(1000)
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName("destino")
                        .setDescription(
                            "Novo canal do Discord para os avisos."
                        )
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(false)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("remover")
                .setDescription(
                    "Para de acompanhar um canal."
                )
                .addIntegerOption(option =>
                    option
                        .setName("id")
                        .setDescription(
                            "Número do item (veja em /youtube listar)."
                        )
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("listar")
                .setDescription(
                    "Mostra os canais acompanhados."
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("testar")
                .setDescription(
                    "Envia o aviso com o último vídeo do canal."
                )
                .addIntegerOption(option =>
                    option
                        .setName("id")
                        .setDescription(
                            "Número do item (veja em /youtube listar)."
                        )
                        .setMinValue(1)
                        .setRequired(true)
                )
        ),

    iniciar,

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: `${EMOJIS.erro} Este comando só funciona dentro de um servidor.`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return interaction.reply({
                content: `${EMOJIS.erro} Você precisa ser administrador para usar este comando.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const subcomando =
            interaction.options.getSubcommand();

        const acoes = {
            adicionar,
            editar,
            remover,
            listar,
            testar
        };

        try {
            // Ler o YouTube pode demorar mais de 3 segundos.
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            await prepararTabela();

            const resposta =
                await acoes[subcomando](interaction);

            await interaction.editReply(
                typeof resposta === "string"
                    ? { content: resposta }
                    : resposta
            );

        } catch (erro) {
            console.error(
                `❌ Erro no comando /youtube ${subcomando}:`,
                erro
            );

            const aviso = {
                content: `${EMOJIS.erro} Não foi possível concluir. Tente de novo em instantes.`
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(aviso)
                    .catch(() => { });
            } else {
                await interaction.reply({
                    ...aviso,
                    flags: MessageFlags.Ephemeral
                }).catch(() => { });
            }
        }
    },

    async handlePrefix(message) {
        await message.reply(
            `${EMOJIS.youtube} Esse comando funciona só como slash: use \`/youtube\`.`
        ).catch(() => { });
    }
};
