const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require("discord.js");

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
                text: "MIGUELGAMEBP-bot"
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
// 🏰 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Veja informações do servidor. 🏰"),

    contarMembros,
    contarCanais,

    async execute(interaction) {
        try {
            if (!interaction.guild) {
                return interaction.reply({
                    content: "❌ Esse comando só funciona dentro de um servidor.",
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            await interaction.editReply(
                await criarResposta(interaction.guild)
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

    async handlePrefix(message) {
        try {
            if (!message.guild) {
                return message.reply(
                    "❌ Esse comando só funciona dentro de um servidor."
                );
            }

            await message.reply(
                await criarResposta(message.guild)
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
