const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require("discord.js");
const { nomeBot } = require("../botNome.js");

const COR = 0x5865F2;

const NIVEIS_VERIFICACAO = {
    0: "Nenhum",
    1: "Baixo (e-mail verificado)",
    2: "Médio (conta com mais de 5 min)",
    3: "Alto (membro há mais de 10 min)",
    4: "Muito alto (telefone verificado)"
};

// =====================================================
// 👥 CONTAR PESSOAS E BOTS
// =====================================================
// Usa a lista de membros que o bot já mantém em memória.
// Se estiver incompleta, tenta baixar a lista inteira;
// se não der, calcula uma estimativa.

async function contarMembros(guild) {
    const total = guild.memberCount;

    try {
        if (guild.members.cache.size < total) {
            try {
                await guild.members.fetch();
            } catch (erro) {
                console.warn(
                    "⚠️ /serverinfo: não foi possível baixar todos os membros:",
                    erro?.message || erro
                );
            }
        }

        const bots =
            guild.members.cache.filter(
                m => m.user.bot
            ).size;

        return {
            total,
            bots,
            pessoas: Math.max(0, total - bots)
        };

    } catch (erro) {
        return {
            total,
            bots: null,
            pessoas: total
        };
    }
}

// =====================================================
// 💬 CONTAR CANAIS
// =====================================================

function contarCanais(guild) {
    const canais = [...guild.channels.cache.values()];

    const contar = (...tipos) =>
        canais.filter(
            c => tipos.includes(c.type)
        ).length;

    return {
        texto: contar(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement
        ),
        voz: contar(
            ChannelType.GuildVoice,
            ChannelType.GuildStageVoice
        ),
        categorias: contar(ChannelType.GuildCategory),
        foruns: contar(
            ChannelType.GuildForum,
            ChannelType.GuildMedia
        )
    };
}

// =====================================================
// 🏰 MONTAR EMBED
// =====================================================

async function criarResposta(guild) {
    const dono =
        await guild.fetchOwner().catch(() => null);

    const membros = await contarMembros(guild);
    const canais = contarCanais(guild);

    const criadoEm =
        Math.floor(guild.createdTimestamp / 1000);

    const emojis =
        [...guild.emojis.cache.values()];

    const animados =
        emojis.filter(e => e.animated).length;

    const cargos =
        Math.max(0, guild.roles.cache.size - 1);

    const textoMembros =
        membros.bots === null
            ? `${membros.total}`
            : `${membros.total}\n👤 ${membros.pessoas} pessoas\n🤖 ${membros.bots} bots`;

    const impulsos =
        guild.premiumSubscriptionCount || 0;

    const nivel = guild.premiumTier ?? 0;

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(`🏰 ${guild.name}`)
            .addFields(
                {
                    name: "🆔 ID",
                    value: `\`${guild.id}\``,
                    inline: true
                },
                {
                    name: "👑 Dono",
                    value: dono
                        ? `${dono.user}`
                        : `<@${guild.ownerId}>`,
                    inline: true
                },
                {
                    name: "📅 Criado em",
                    value: `<t:${criadoEm}:D>\n(<t:${criadoEm}:R>)`,
                    inline: true
                },
                {
                    name: "👥 Membros",
                    value: textoMembros,
                    inline: true
                },
                {
                    name: "💬 Canais",
                    value:
                        `📝 ${canais.texto} texto\n` +
                        `🔊 ${canais.voz} voz\n` +
                        `📁 ${canais.categorias} categorias` +
                        (
                            canais.foruns
                                ? `\n🗂️ ${canais.foruns} fóruns`
                                : ""
                        ),
                    inline: true
                },
                {
                    name: "🎭 Cargos",
                    value: String(cargos),
                    inline: true
                },
                {
                    name: "😀 Emojis",
                    value:
                        `${emojis.length - animados} estáticos\n` +
                        `${animados} animados`,
                    inline: true
                },
                {
                    name: "🏷️ Figurinhas",
                    value: String(guild.stickers?.cache?.size ?? 0),
                    inline: true
                },
                {
                    name: "💎 Impulsos",
                    value: `Nível ${nivel}\n${impulsos} impulsos`,
                    inline: true
                },
                {
                    name: "🛡️ Verificação",
                    value:
                        NIVEIS_VERIFICACAO[guild.verificationLevel] ||
                        "Desconhecida",
                    inline: true
                },
                {
                    name: "🌎 Idioma",
                    value: String(guild.preferredLocale || "—"),
                    inline: true
                }
            )
            .setFooter({
                text: nomeBot()
            });

    if (guild.description) {
        embed.setDescription(guild.description);
    }

    const icone =
        guild.iconURL({
            size: 1024,
            extension: "png"
        });

    const banner =
        guild.bannerURL({
            size: 1024,
            extension: "png"
        });

    if (icone) {
        embed.setThumbnail(icone);
    }

    if (banner) {
        embed.setImage(banner);
    }

    const resposta = {
        embeds: [embed]
    };

    const botoes = [];

    if (icone) {
        botoes.push(
            new ButtonBuilder()
                .setLabel("Ícone")
                .setEmoji("🖼️")
                .setStyle(ButtonStyle.Link)
                .setURL(icone)
        );
    }

    if (banner) {
        botoes.push(
            new ButtonBuilder()
                .setLabel("Banner")
                .setEmoji("🌄")
                .setStyle(ButtonStyle.Link)
                .setURL(banner)
        );
    }

    if (botoes.length > 0) {
        resposta.components = [
            new ActionRowBuilder()
                .addComponents(...botoes)
        ];
    }

    return resposta;
}

// =====================================================
// 🔎 ESCOLHER QUAL SERVIDOR MOSTRAR
// =====================================================
// Sem ID: mostra o servidor onde o comando foi usado.
// Com ID: mostra outro servidor, mas só se o bot estiver
// nele E a pessoa for membro dele (ou for o dono do bot).
// Assim ninguém consegue espiar servidores dos outros.

async function pegarIdDoDonoDoBot(client) {
    try {
        const aplicacao =
            await client.application.fetch();

        const dono = aplicacao.owner;

        if (!dono) {
            return null;
        }

        return dono.members
            ? dono.ownerId
            : dono.id;

    } catch (erro) {
        return null;
    }
}

async function escolherServidor(client, idPedido, usuarioId, guildAtual) {
    const id = String(idPedido || "").trim();

    if (!id) {
        if (!guildAtual) {
            return {
                erro: "❌ Use esse comando dentro de um servidor ou informe o ID de um servidor."
            };
        }

        return { guild: guildAtual };
    }

    if (!/^\d{15,25}$/.test(id)) {
        return {
            erro: "❌ ID inválido. Digite só os números do ID do servidor."
        };
    }

    const guild = client.guilds.cache.get(id);

    if (!guild) {
        return {
            erro: "❌ Não estou nesse servidor, então não consigo ver as informações dele."
        };
    }

    if (guildAtual && guild.id === guildAtual.id) {
        return { guild };
    }

    const ehDonoDoBot =
        (await pegarIdDoDonoDoBot(client)) === usuarioId;

    if (!ehDonoDoBot) {
        const membro =
            await guild.members
                .fetch(usuarioId)
                .catch(() => null);

        if (!membro) {
            return {
                erro: "❌ Você precisa ser membro desse servidor para ver as informações dele."
            };
        }
    }

    return { guild };
}

// =====================================================
// 🏰 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Veja informações do servidor. 🏰")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription(
                    "ID de outro servidor (opcional)."
                )
                .setRequired(false)
        ),

    contarMembros,
    contarCanais,
    escolherServidor,

    async execute(interaction) {
        try {
            const escolha =
                await escolherServidor(
                    interaction.client,
                    interaction.options.getString("id"),
                    interaction.user.id,
                    interaction.guild
                );

            if (escolha.erro) {
                return interaction.reply({
                    content: escolha.erro,
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            await interaction.editReply(
                await criarResposta(escolha.guild)
            );

        } catch (erro) {
            console.error(
                "❌ Erro no comando /serverinfo:",
                erro
            );

            const aviso = {
                content: "❌ Não foi possível mostrar as informações do servidor."
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(aviso).catch(() => { });
            } else {
                await interaction.reply({
                    ...aviso,
                    ephemeral: true
                }).catch(() => { });
            }
        }
    },

    async handlePrefix(message, args = []) {
        try {
            const escolha =
                await escolherServidor(
                    message.client,
                    args[0],
                    message.author.id,
                    message.guild
                );

            if (escolha.erro) {
                return message.reply(escolha.erro);
            }

            await message.reply(
                await criarResposta(escolha.guild)
            );

        } catch (erro) {
            console.error(
                "❌ Erro no comando serverinfo por prefixo:",
                erro
            );

            await message.reply(
                "❌ Não foi possível mostrar as informações do servidor."
            ).catch(() => { });
        }
    }
};
