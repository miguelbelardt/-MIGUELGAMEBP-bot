const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require("discord.js");
const { nomeBot } = require("../botNome.js");

const COR = 0x5865F2;

// =====================================================
// 😀 EMOJIS
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    espera: "<:ampulheta:1561391627090526231>"
};

// =====================================================
// 🏅 NOMES DAS INSÍGNIAS
// =====================================================

const INSIGNIAS = {
    Staff: "Equipe do Discord",
    Partner: "Parceiro do Discord",
    Hypesquad: "HypeSquad Events",
    BugHunterLevel1: "Caçador de Bugs (nível 1)",
    BugHunterLevel2: "Caçador de Bugs (nível 2)",
    HypeSquadOnlineHouse1: "HypeSquad Bravery",
    HypeSquadOnlineHouse2: "HypeSquad Brilliance",
    HypeSquadOnlineHouse3: "HypeSquad Balance",
    PremiumEarlySupporter: "Apoiador inicial",
    VerifiedBot: "Bot verificado",
    VerifiedDeveloper: "Desenvolvedor de bots verificado",
    CertifiedModerator: "Moderador certificado",
    BotHTTPInteractions: "Bot de interações",
    ActiveDeveloper: "Desenvolvedor ativo"
};

// =====================================================
// 🔑 PERMISSÕES IMPORTANTES
// =====================================================

const PERMISSOES = [
    ["ManageGuild", "Gerenciar servidor"],
    ["ManageRoles", "Gerenciar cargos"],
    ["ManageChannels", "Gerenciar canais"],
    ["ManageMessages", "Gerenciar mensagens"],
    ["KickMembers", "Expulsar membros"],
    ["BanMembers", "Banir membros"],
    ["ModerateMembers", "Castigar membros"],
    ["MentionEveryone", "Mencionar @everyone"]
];

function listarPermissoes(membro) {
    try {
        if (membro.permissions.has(PermissionFlagsBits.Administrator)) {
            return "Administrador (todas as permissões)";
        }

        const lista =
            PERMISSOES
                .filter(([chave]) =>
                    PermissionFlagsBits[chave] !== undefined &&
                    membro.permissions.has(PermissionFlagsBits[chave])
                )
                .map(([, nome]) => nome);

        return lista.length > 0
            ? lista.join(", ")
            : null;

    } catch (erro) {
        return null;
    }
}

function listarInsignias(usuario) {
    try {
        const nomes =
            usuario.flags
                ? usuario.flags.toArray()
                : [];

        const lista =
            nomes
                .filter(n => INSIGNIAS[n])
                .map(n => INSIGNIAS[n]);

        return lista.length > 0
            ? lista.join("\n")
            : null;

    } catch (erro) {
        return null;
    }
}

// =====================================================
// 🎭 LISTA DE CARGOS (cabe no limite do Discord)
// =====================================================

function listarCargos(membro, guildId) {
    const cargos =
        [...membro.roles.cache.values()]
            .filter(r => r.id !== guildId)
            .sort((a, b) => b.position - a.position);

    if (cargos.length === 0) {
        return { total: 0, texto: "Nenhum cargo" };
    }

    let texto = "";
    let mostrados = 0;

    for (const cargo of cargos) {
        const item = `<@&${cargo.id}>`;
        const proximo =
            texto ? `${texto} ${item}` : item;

        // deixa folga para o "+N" no final
        if (proximo.length > 940) {
            break;
        }

        texto = proximo;
        mostrados++;
    }

    const restantes = cargos.length - mostrados;

    if (restantes > 0) {
        texto += ` e mais ${restantes}`;
    }

    return { total: cargos.length, texto };
}

// =====================================================
// 🔢 POSIÇÃO DE ENTRADA NO SERVIDOR
// =====================================================

async function posicaoDeEntrada(guild, membro) {
    try {
        if (guild.members.cache.size < guild.memberCount) {
            try {
                await guild.members.fetch();
            } catch (erro) {
                return null;
            }
        }

        if (guild.members.cache.size < guild.memberCount) {
            return null;
        }

        const ordenados =
            [...guild.members.cache.values()]
                .filter(m => m.joinedTimestamp)
                .sort(
                    (a, b) =>
                        a.joinedTimestamp - b.joinedTimestamp
                );

        const indice =
            ordenados.findIndex(m => m.id === membro.id);

        return indice >= 0 ? indice + 1 : null;

    } catch (erro) {
        return null;
    }
}

// =====================================================
// 🏰 EMBED 1: O MEMBRO NO SERVIDOR
// =====================================================

async function criarEmbedServidor(guild, membro) {
    const entrouEm =
        Math.floor(membro.joinedTimestamp / 1000);

    const posicao =
        await posicaoDeEntrada(guild, membro);

    const cargos =
        listarCargos(membro, guild.id);

    const maisAlto =
        membro.roles.highest &&
        membro.roles.highest.id !== guild.id
            ? `<@&${membro.roles.highest.id}>`
            : "Nenhum";

    const embed =
        new EmbedBuilder()
            .setColor(membro.displayColor || COR)
            .setTitle(`🏰 No servidor ${guild.name}`)
            .setThumbnail(
                membro.displayAvatarURL({
                    size: 512
                })
            )
            .addFields(
                {
                    name: "📛 Nome no servidor",
                    value: String(membro.displayName),
                    inline: true
                },
                {
                    name: "📥 Entrou em",
                    value: `<t:${entrouEm}:D>\n(<t:${entrouEm}:R>)`,
                    inline: true
                },
                {
                    name: "🔢 Posição de entrada",
                    value: posicao ? `#${posicao}` : "indisponível",
                    inline: true
                },
                {
                    name: "🎭 Cargo mais alto",
                    value: maisAlto,
                    inline: true
                },
                {
                    name: "🎨 Cor do nome",
                    value:
                        membro.displayColor
                            ? membro.displayHexColor
                            : "padrão",
                    inline: true
                },
                {
                    name: "👑 Dono do servidor",
                    value:
                        guild.ownerId === membro.id
                            ? "Sim"
                            : "Não",
                    inline: true
                }
            );

    if (membro.premiumSinceTimestamp) {
        const desde =
            Math.floor(membro.premiumSinceTimestamp / 1000);

        embed.addFields({
            name: "💎 Impulsionando desde",
            value: `<t:${desde}:D> (<t:${desde}:R>)`,
            inline: true
        });
    }

    if (
        membro.communicationDisabledUntilTimestamp &&
        membro.communicationDisabledUntilTimestamp > Date.now()
    ) {
        const ate =
            Math.floor(
                membro.communicationDisabledUntilTimestamp / 1000
            );

        embed.addFields({
            name: `${EMOJIS.espera} Em castigo até`,
            value: `<t:${ate}:f> (<t:${ate}:R>)`,
            inline: true
        });
    }

    const permissoes = listarPermissoes(membro);

    if (permissoes) {
        embed.addFields({
            name: "🔑 Permissões importantes",
            value: permissoes
        });
    }

    embed.addFields({
        name: `🎭 Cargos (${cargos.total})`,
        value: cargos.texto
    });

    return embed;
}

// =====================================================
// 👤 EMBED 2: O PERFIL PRINCIPAL
// =====================================================

function criarEmbedPerfil(usuario) {
    const criadaEm =
        Math.floor(usuario.createdTimestamp / 1000);

    const insignias =
        listarInsignias(usuario);

    const embed =
        new EmbedBuilder()
            .setColor(usuario.accentColor || COR)
            .setTitle(`👤 Perfil de ${usuario.username}`)
            .setThumbnail(
                usuario.displayAvatarURL({
                    size: 512
                })
            )
            .addFields(
                {
                    name: "🏷️ Usuário",
                    value: `@${usuario.username}`,
                    inline: true
                },
                {
                    name: "✨ Nome de exibição",
                    value: usuario.globalName || "—",
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: `\`${usuario.id}\``,
                    inline: true
                },
                {
                    name: "🤖 Bot",
                    value: usuario.bot ? "Sim" : "Não",
                    inline: true
                },
                {
                    name: "📅 Conta criada em",
                    value: `<t:${criadaEm}:D>\n(<t:${criadaEm}:R>)`,
                    inline: true
                }
            )
            .setFooter({
                text: nomeBot()
            });

    if (usuario.accentColor) {
        embed.addFields({
            name: "🎨 Cor do perfil",
            value: usuario.hexAccentColor || "—",
            inline: true
        });
    }

    if (insignias) {
        embed.addFields({
            name: "🏅 Insígnias",
            value: insignias
        });
    }

    const banner =
        usuario.bannerURL
            ? usuario.bannerURL({
                size: 1024,
                extension: "png"
            })
            : null;

    if (banner) {
        embed.setImage(banner);
    }

    return embed;
}

// =====================================================
// 🔘 BOTÕES DE LINK (AVATAR / BANNER)
// =====================================================

function criarBotoes(usuario, membro) {
    const botoes = [];

    const avatar =
        usuario.displayAvatarURL({
            size: 1024,
            extension: "png"
        });

    if (avatar) {
        botoes.push(
            new ButtonBuilder()
                .setLabel("Avatar")
                .setEmoji("🖼️")
                .setStyle(ButtonStyle.Link)
                .setURL(avatar)
        );
    }

    if (membro && membro.avatar) {
        botoes.push(
            new ButtonBuilder()
                .setLabel("Avatar no servidor")
                .setEmoji("🏰")
                .setStyle(ButtonStyle.Link)
                .setURL(
                    membro.displayAvatarURL({
                        size: 1024,
                        extension: "png"
                    })
                )
        );
    }

    const banner =
        usuario.bannerURL
            ? usuario.bannerURL({
                size: 1024,
                extension: "png"
            })
            : null;

    if (banner) {
        botoes.push(
            new ButtonBuilder()
                .setLabel("Banner")
                .setEmoji("🌄")
                .setStyle(ButtonStyle.Link)
                .setURL(banner)
        );
    }

    if (botoes.length === 0) {
        return [];
    }

    return [
        new ActionRowBuilder()
            .addComponents(...botoes)
    ];
}

// =====================================================
// 💬 MONTAR RESPOSTA
// =====================================================

async function criarResposta(usuarioBase, guild) {
    // Busca de novo para vir com banner e cor do perfil
    let usuario = usuarioBase;

    try {
        usuario = await usuarioBase.fetch(true);
    } catch (erro) {
        usuario = usuarioBase;
    }

    let membro = null;

    if (guild) {
        membro =
            await guild.members
                .fetch(usuario.id)
                .catch(() => null);
    }

    const embeds = [];

    if (guild && membro) {
        embeds.push(
            await criarEmbedServidor(guild, membro)
        );
    }

    embeds.push(criarEmbedPerfil(usuario));

    const resposta = {
        embeds
    };

    if (guild && !membro) {
        resposta.content =
            `ℹ️ **${usuario.username}** não está em **${guild.name}**, ` +
            `então só dá pra mostrar o perfil dele.`;
    }

    const componentes =
        criarBotoes(usuario, membro);

    if (componentes.length > 0) {
        resposta.components = componentes;
    }

    return resposta;
}

// =====================================================
// 👤 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("membroinfo")
        .setDescription(
            "Veja as informações de um membro e do perfil dele. 👤"
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription(
                    "Quem você quer consultar (se vazio, é você)."
                )
                .setRequired(false)
        ),

    listarCargos,
    listarPermissoes,
    listarInsignias,
    posicaoDeEntrada,

    async execute(interaction) {
        try {
            const usuario =
                interaction.options.getUser("usuario") ||
                interaction.user;

            await interaction.deferReply();

            await interaction.editReply(
                await criarResposta(
                    usuario,
                    interaction.guild
                )
            );

        } catch (erro) {
            console.error(
                "❌ Erro no comando /membroinfo:",
                erro
            );

            const aviso = {
                content: "❌ Não foi possível mostrar as informações do membro."
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
            let usuario =
                message.mentions.users.first() || null;

            if (!usuario && args[0]) {
                const id = args[0].replace(/\D/g, "");

                if (id.length >= 15) {
                    usuario =
                        await message.client.users
                            .fetch(id)
                            .catch(() => null);
                }

                if (!usuario) {
                    return message.reply(
                        "❌ Não encontrei esse usuário. Use `'membroinfo @pessoa` ou o ID dela."
                    );
                }
            }

            if (!usuario) {
                usuario = message.author;
            }

            await message.reply(
                await criarResposta(
                    usuario,
                    message.guild
                )
            );

        } catch (erro) {
            console.error(
                "❌ Erro no comando membroinfo por prefixo:",
                erro
            );

            await message.reply(
                "❌ Não foi possível mostrar as informações do membro."
            ).catch(() => { });
        }
    }
};
