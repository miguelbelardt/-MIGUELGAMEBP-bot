const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const os = require("os");

const COR = 0x5865F2;

// =====================================================
// ✨ BOTS QUE INSPIRARAM O MIGUELGAMEBP
// =====================================================
// Para trocar ou adicionar, é só mexer nesta lista.
// Se a menção (@) não aparecer direito no Discord,
// troque USAR_MENCAO para false e vai mostrar só o nome.

const INSPIRACOES = [
    { nome: "Zooukou", id: "1558458296514379796" },
    { nome: "Loritta", id: "297153970613387264" },
    { nome: "Carl-bot", id: "235148962103951360" }
];

const USAR_MENCAO = true;

function listarInspiracoes() {
    const itens =
        INSPIRACOES.map(bot =>
            USAR_MENCAO
                ? `<@${bot.id}>`
                : `**${bot.nome}**`
        );

    if (itens.length <= 1) {
        return itens.join("");
    }

    return (
        itens.slice(0, -1).join(", ") +
        " e " +
        itens[itens.length - 1]
    );
}

// =====================================================
// 🕐 FORMATAR TEMPO LIGADO
// =====================================================

function formatarTempo(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));

    const dias = Math.floor(total / 86400);
    const horas = Math.floor((total % 86400) / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;

    const partes = [];

    if (dias) partes.push(`${dias}d`);
    if (dias || horas) partes.push(`${horas}h`);
    if (dias || horas || minutos) partes.push(`${minutos}m`);

    partes.push(`${segundos}s`);

    return partes.join(" ");
}

function versaoDiscordJs() {
    try {
        return require("discord.js").version || "?";
    } catch (erro) {
        return "?";
    }
}

// =====================================================
// 👑 DESCOBRIR QUEM CRIOU O BOT
// =====================================================
// Pega o dono da aplicação direto do Discord (não precisa
// colocar ID no código). Se for uma equipe, mostra o dono
// da equipe. Se não conseguir, usa o texto padrão.

const CRIADOR_PADRAO = "Miguel";

let criadorEmCache = null;

async function pegarCriador(client) {
    if (criadorEmCache) {
        return criadorEmCache;
    }

    try {
        const aplicacao =
            await client.application.fetch();

        const dono = aplicacao.owner;

        if (dono) {
            const id =
                dono.members
                    ? dono.ownerId
                    : dono.id;

            if (id) {
                criadorEmCache = `<@${id}>`;
                return criadorEmCache;
            }
        }

    } catch (erro) {
        console.warn(
            "⚠️ /botinfo: não foi possível descobrir o criador do bot:",
            erro?.message || erro
        );
    }

    return CRIADOR_PADRAO;
}

// =====================================================
// 🤖 MONTAR EMBED
// =====================================================

function criarEmbed(client, latenciaResposta, criador) {
    const bot = client.user;

    const criadoEm =
        Math.floor(bot.createdTimestamp / 1000);

    const totalMembros =
        client.guilds.cache.reduce(
            (soma, servidor) =>
                soma + (servidor.memberCount || 0),
            0
        );

    const ping =
        client.ws.ping >= 0
            ? `${Math.round(client.ws.ping)}ms`
            : "calculando...";

    const memoria =
        (process.memoryUsage().rss / 1024 / 1024)
            .toFixed(1);

    const comandos =
        client.commands?.size ??
        client.application?.commands?.cache?.size ??
        0;

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(`🤖 ${bot.username}`)
            .setDescription(
                `Olá! Eu sou o **MIGUELGAMEBP**, um bot feito por ${criador || CRIADOR_PADRAO} ` +
                `para deixar o servidor mais divertido e organizado, com economia, XP, tickets, ` +
                `sorteios, registro, calls personalizadas, boas-vindas e muito mais.\n\n` +
                `✨ Fui inspirado em bots incríveis como ${listarInspiracoes()}.`
            )
            .setThumbnail(
                bot.displayAvatarURL({
                    size: 512
                })
            )
            .addFields(
                {
                    name: "🆔 ID",
                    value: `\`${bot.id}\``,
                    inline: true
                },
                {
                    name: "👑 Criador",
                    value: criador || CRIADOR_PADRAO,
                    inline: true
                },
                {
                    name: "📅 Criado em",
                    value: `<t:${criadoEm}:D>\n(<t:${criadoEm}:R>)`,
                    inline: true
                },
                {
                    name: "🟢 Ligado há",
                    value: formatarTempo(client.uptime || 0),
                    inline: true
                },
                {
                    name: "🌐 Servidores",
                    value: String(client.guilds.cache.size),
                    inline: true
                },
                {
                    name: "👥 Membros",
                    value: `${totalMembros}\n(soma dos servidores)`,
                    inline: true
                },
                {
                    name: "💬 Canais",
                    value: String(client.channels.cache.size),
                    inline: true
                },
                {
                    name: "⌨️ Comandos",
                    value: String(comandos),
                    inline: true
                },
                {
                    name: "📡 Ping",
                    value:
                        `API: ${ping}` +
                        (
                            latenciaResposta !== null
                                ? `\nResposta: ${latenciaResposta}ms`
                                : ""
                        ),
                    inline: true
                },
                {
                    name: "🧠 Memória",
                    value: `${memoria} MB`,
                    inline: true
                },
                {
                    name: "🧰 Tecnologia",
                    value:
                        `Node.js ${process.version}\n` +
                        `discord.js ${versaoDiscordJs()}`,
                    inline: true
                },
                {
                    name: "💻 Sistema",
                    value: `${os.platform()} (${os.arch()})`,
                    inline: true
                }
            )
            .setFooter({
                text: "MIGUELGAMEBP-bot"
            });

    return embed;
}

// =====================================================
// 🤖 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Veja informações sobre o bot. 🤖"),

    criarEmbed,
    formatarTempo,
    pegarCriador,
    listarInspiracoes,

    async execute(interaction) {
        try {
            const latencia =
                Math.max(
                    0,
                    Date.now() - interaction.createdTimestamp
                );

            await interaction.reply({
                embeds: [
                    criarEmbed(
                        interaction.client,
                        latencia,
                        await pegarCriador(interaction.client)
                    )
                ]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando /botinfo:",
                erro
            );

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Não foi possível mostrar as informações do bot.",
                    ephemeral: true
                }).catch(() => { });
            }
        }
    },

    async handlePrefix(message) {
        try {
            const latencia =
                Math.max(
                    0,
                    Date.now() - message.createdTimestamp
                );

            await message.reply({
                embeds: [
                    criarEmbed(
                        message.client,
                        latencia,
                        await pegarCriador(message.client)
                    )
                ]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando botinfo por prefixo:",
                erro
            );

            await message.reply(
                "❌ Não foi possível mostrar as informações do bot."
            ).catch(() => { });
        }
    }
};
