const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require("discord.js");

const { pool } = require("../database/database");

const sessoes = new Map();

function criarPainelSorteio() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("sorteio_config")
                .setLabel("Configurar")
                .setEmoji("⚙️")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("sorteio_canal")
                .setLabel("Escolher canal")
                .setEmoji("📢")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId("sorteio_vencedores")
                .setLabel("Vencedores")
                .setEmoji("🏆")
                .setStyle(ButtonStyle.Secondary)
        ),

        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("sorteio_preview")
                .setLabel("Visualizar sorteio")
                .setEmoji("👀")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("sorteio_enviar")
                .setLabel("Enviar sorteio")
                .setEmoji("🚀")
                .setStyle(ButtonStyle.Primary)
        )
    ];
}

function criarEmbedPainel(config) {
    const canal = config.canalId
        ? `<#${config.canalId}>`
        : "❌ Não escolhido";

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎉 Criador de Sorteio")
        .setDescription(
            "Configure o sorteio usando os botões abaixo."
        )
        .addFields(
            {
                name: "📝 Título",
                value: config.titulo || "❌ Não definido",
                inline: false
            },
            {
                name: "📄 Descrição",
                value: config.descricao || "❌ Não definida",
                inline: false
            },
            {
                name: "🎨 Cor",
                value: config.cor || "Padrão",
                inline: true
            },
            {
                name: "🏆 Vencedores",
                value: String(config.vencedores || 1),
                inline: true
            },
            {
                name: "📢 Canal",
                value: canal,
                inline: true
            },
            {
                name: "📅 Encerramento",
                value: config.data && config.horario
                    ? `${config.data} às ${config.horario}`
                    : "❌ Não definido",
                inline: false
            }
        )
        .setFooter({
            text: "As configurações ficam salvas enquanto você monta o sorteio."
        });
}

function criarEmbedPreview(config) {
    const embed = new EmbedBuilder()
        .setColor(config.cor || 0x5865F2)
        .setTitle(`🎉 ${config.titulo || "Sorteio"}`)
        .setDescription(
            config.descricao ||
            "🎁 Participe deste sorteio!"
        )
        .addFields({
            name: "🏆 Vencedores",
            value: String(config.vencedores || 1),
            inline: true
        });

    if (config.data && config.horario) {
        embed.addFields({
            name: "⏰ Encerramento",
            value: `${config.data} às ${config.horario}`,
            inline: true
        });
    }

    if (config.imagem) {
        embed.setImage(config.imagem);
    }

    if (config.thumbnail) {
        embed.setThumbnail(config.thumbnail);
    }

    embed.setFooter({
        text: "Clique no botão abaixo para participar!"
    });

    return embed;
}

function criarBotaoParticipar(sorteioId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`sorteio_participar_${sorteioId}`)
            .setLabel("Participar")
            .setEmoji("🎟️")
            .setStyle(ButtonStyle.Success)
    );
}

function converterData(data, horario) {
    if (!data || !horario) return null;

    const timestamp = new Date(
        `${data}T${horario}:00-03:00`
    ).getTime();

    return Number.isNaN(timestamp)
        ? null
        : timestamp;
}

async function criarSorteio(config) {
    const encerraEm = converterData(
        config.data,
        config.horario
    );

    if (!encerraEm) {
        throw new Error("Data ou horário inválido.");
    }

    const resultado = await pool.query(
        `
        INSERT INTO sorteios
        (
            guild_id,
            canal_id,
            titulo,
            descricao,
            cor,
            imagem,
            thumbnail,
            encerra_em,
            vencedores
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,
        [
            config.guildId,
            config.canalId,
            config.titulo,
            config.descricao,
            config.cor,
            config.imagem || null,
            config.thumbnail || null,
            encerraEm,
            config.vencedores || 1
        ]
    );

    return resultado.rows[0];
}

async function participarSorteio(sorteioId, userId) {
    try {
        await pool.query(
            `
            INSERT INTO sorteio_participantes
            (sorteio_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [sorteioId, userId]
        );

        return true;
    } catch (erro) {
        console.error(
            "❌ Erro ao registrar participante:",
            erro
        );

        return false;
    }
}

async function finalizarSorteio(client, sorteio) {
    try {
        const participantes = await pool.query(
            `
            SELECT user_id
            FROM sorteio_participantes
            WHERE sorteio_id = $1
            `,
            [sorteio.id]
        );

        const lista = participantes.rows.map(
            participante => participante.user_id
        );

        if (lista.length === 0) {
            await pool.query(
                `
                UPDATE sorteios
                SET encerrado = TRUE
                WHERE id = $1
                `,
                [sorteio.id]
            );

            const canal = await client.channels
                .fetch(sorteio.canal_id)
                .catch(() => null);

            if (canal) {
                await canal.send(
                    `🎉 O sorteio **${sorteio.titulo}** terminou, mas ninguém participou.`
                );
            }

            return;
        }

        const embaralhados = [...lista];

        for (
            let i = embaralhados.length - 1;
            i > 0;
            i--
        ) {
            const j = Math.floor(
                Math.random() * (i + 1)
            );

            [
                embaralhados[i],
                embaralhados[j]
            ] = [
                embaralhados[j],
                embaralhados[i]
            ];
        }

        const quantidade = Math.min(
            sorteio.vencedores,
            embaralhados.length
        );

        const vencedores =
            embaralhados.slice(0, quantidade);

        await pool.query(
            `
            UPDATE sorteios
            SET
                encerrado = TRUE,
                vencedores_ids = $1
            WHERE id = $2
            `,
            [vencedores, sorteio.id]
        );

        const canal = await client.channels
            .fetch(sorteio.canal_id)
            .catch(() => null);

        if (!canal) return;

        const mencoes = vencedores
            .map(id => `<@${id}>`)
            .join(", ");

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("🏆 Sorteio encerrado!")
            .setDescription(
                `🎉 O sorteio **${sorteio.titulo}** terminou!\n\n` +
                `🏆 **Vencedores:**\n${mencoes}`
            );

        await canal.send({
            embeds: [embed]
        });

    } catch (erro) {
        console.error(
            "❌ Erro ao finalizar sorteio:",
            erro
        );
    }
}

async function verificarSorteios(client) {
    try {
        const resultado = await pool.query(
            `
            SELECT *
            FROM sorteios
            WHERE encerrado = FALSE
            AND encerra_em <= $1
            `,
            [Date.now()]
        );

        for (const sorteio of resultado.rows) {
            await finalizarSorteio(
                client,
                sorteio
            );
        }
    } catch (erro) {
        console.error(
            "❌ Erro ao verificar sorteios:",
            erro
        );
    }
}

function iniciarSistemaSorteios(client) {
    setInterval(() => {
        verificarSorteios(client);
    }, 10000);

    console.log(
        "🎉 Sistema de sorteios iniciado."
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sorteio")
        .setDescription("Cria um novo sorteio.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return interaction.reply({
                content:
                    "❌ Você precisa ser administrador para criar sorteios.",
                ephemeral: true
            });
        }

        const config = {
            guildId: interaction.guildId,
            canalId: null,
            titulo: "",
            descricao: "",
            cor: "5865F2",
            imagem: null,
            thumbnail: null,
            data: null,
            horario: null,
            vencedores: 1
        };

        sessoes.set(
            interaction.user.id,
            config
        );

        await interaction.reply({
            embeds: [
                criarEmbedPainel(config)
            ],
            components: criarPainelSorteio(),
            ephemeral: true
        });
    },

    async handleButton(interaction) {
        const userId = interaction.user.id;

        let config = sessoes.get(userId);

        if (!config) {
            config = {
                guildId: interaction.guildId,
                canalId: null,
                titulo: "",
                descricao: "",
                cor: "5865F2",
                imagem: null,
                thumbnail: null,
                data: null,
                horario: null,
                vencedores: 1
            };

            sessoes.set(userId, config);
        }

        if (
            interaction.customId ===
            "sorteio_config"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "sorteio_modal_config"
                    )
                    .setTitle(
                        "⚙️ Configurar sorteio"
                    );

            const titulo =
                new TextInputBuilder()
                    .setCustomId("titulo")
                    .setLabel("Título")
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(true)
                    .setValue(
                        config.titulo || ""
                    );

            const descricao =
                new TextInputBuilder()
                    .setCustomId("descricao")
                    .setLabel("Descrição")
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(true)
                    .setValue(
                        config.descricao || ""
                    );

            const cor =
                new TextInputBuilder()
                    .setCustomId("cor")
                    .setLabel("Cor hexadecimal")
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "5865F2"
                    )
                    .setValue(
                        config.cor || "5865F2"
                    );

            const imagem =
                new TextInputBuilder()
                    .setCustomId("imagem")
                    .setLabel("Imagem")
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setValue(
                        config.imagem || ""
                    );

            const thumbnail =
                new TextInputBuilder()
                    .setCustomId("thumbnail")
                    .setLabel("Thumbnail")
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setValue(
                        config.thumbnail || ""
                    );

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    titulo
                ),
                new ActionRowBuilder().addComponents(
                    descricao
                ),
                new ActionRowBuilder().addComponents(
                    cor
                ),
                new ActionRowBuilder().addComponents(
                    imagem
                ),
                new ActionRowBuilder().addComponents(
                    thumbnail
                )
            );

            return interaction.showModal(
                modal
            );
        }

        if (
            interaction.customId ===
            "sorteio_canal"
        ) {
            const menu =
                new ChannelSelectMenuBuilder()
                    .setCustomId(
                        "sorteio_selecionar_canal"
                    )
                    .setPlaceholder(
                        "📢 Escolha o canal do sorteio"
                    )
                    .addChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    )
                    .setMinValues(1)
                    .setMaxValues(1);

            return interaction.reply({
                content:
                    "📢 Escolha o canal onde o sorteio será enviado:",
                components: [
                    new ActionRowBuilder().addComponents(
                        menu
                    )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.customId ===
            "sorteio_vencedores"
        ) {
            const menu =
                new StringSelectMenuBuilder()
                    .setCustomId(
                        "sorteio_selecionar_vencedores"
                    )
                    .setPlaceholder(
                        "🏆 Quantos vencedores?"
                    )
                    .addOptions(
                        {
                            label: "1 vencedor",
                            value: "1",
                            emoji: "🥇"
                        },
                        {
                            label: "2 vencedores",
                            value: "2",
                            emoji: "🥈"
                        },
                        {
                            label: "3 vencedores",
                            value: "3",
                            emoji: "🥉"
                        },
                        {
                            label: "5 vencedores",
                            value: "5",
                            emoji: "🏆"
                        },
                        {
                            label: "10 vencedores",
                            value: "10",
                            emoji: "🎉"
                        }
                    );

            return interaction.reply({
                content:
                    "🏆 Escolha quantas pessoas poderão ganhar:",
                components: [
                    new ActionRowBuilder().addComponents(
                        menu
                    )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.customId ===
            "sorteio_preview"
        ) {
            return interaction.reply({
                content:
                    "👀 **Prévia do sorteio:**",
                embeds: [
                    criarEmbedPreview(config)
                ],
                components: [
                    criarBotaoParticipar(
                        "preview"
                    )
                ],
                ephemeral: true
            });
        }

        if (
            interaction.customId ===
            "sorteio_enviar"
        ) {
            if (!config.titulo) {
                return interaction.reply({
                    content:
                        "❌ Configure o título primeiro.",
                    ephemeral: true
                });
            }

            if (!config.descricao) {
                return interaction.reply({
                    content:
                        "❌ Configure a descrição primeiro.",
                    ephemeral: true
                });
            }

            if (!config.canalId) {
                return interaction.reply({
                    content:
                        "❌ Escolha o canal do sorteio.",
                    ephemeral: true
                });
            }

            if (!config.data || !config.horario) {
                return interaction.reply({
                    content:
                        "❌ Defina a data e o horário de encerramento.",
                    ephemeral: true
                });
            }

            const canal =
                await interaction.guild.channels
                    .fetch(config.canalId)
                    .catch(() => null);

            if (!canal) {
                return interaction.reply({
                    content:
                        "❌ Não consegui encontrar o canal escolhido.",
                    ephemeral: true
                });
            }

            const sorteio =
                await criarSorteio(config);

            await canal.send({
                embeds: [
                    criarEmbedPreview(config)
                ],
                components: [
                    criarBotaoParticipar(
                        sorteio.id
                    )
                ]
            });

            sessoes.delete(userId);

            return interaction.reply({
                content:
                    `✅ Sorteio enviado em ${canal}!`,
                ephemeral: true
            });
        }
    },

    async handleModal(interaction) {
        if (
            interaction.customId !==
            "sorteio_modal_config"
        ) {
            return;
        }

        const config =
            sessoes.get(
                interaction.user.id
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou. Use `/sorteio` novamente.",
                ephemeral: true
            });
        }

        config.titulo =
            interaction.fields.getTextInputValue(
                "titulo"
            );

        config.descricao =
            interaction.fields.getTextInputValue(
                "descricao"
            );

        config.cor =
            interaction.fields.getTextInputValue(
                "cor"
            ) || "5865F2";

        config.imagem =
            interaction.fields.getTextInputValue(
                "imagem"
            ) || null;

        config.thumbnail =
            interaction.fields.getTextInputValue(
                "thumbnail"
            ) || null;

        return interaction.reply({
            content:
                "✅ Configurações salvas!",
            embeds: [
                criarEmbedPainel(config)
            ],
            components: criarPainelSorteio(),
            ephemeral: true
        });
    },

    async handleSelect(interaction) {
        const config =
            sessoes.get(
                interaction.user.id
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou. Use `/sorteio` novamente.",
                ephemeral: true
            });
        }

        if (
            interaction.customId ===
            "sorteio_selecionar_canal"
        ) {
            config.canalId =
                interaction.values[0];

            return interaction.update({
                content:
                    `✅ Canal escolhido: <#${config.canalId}>`,
                components: []
            });
        }

        if (
            interaction.customId ===
            "sorteio_selecionar_vencedores"
        ) {
            config.vencedores =
                Number(
                    interaction.values[0]
                );

            return interaction.update({
                content:
                    `🏆 Quantidade de vencedores definida: **${config.vencedores}**`,
                components: []
            });
        }
    },

    async handleParticipation(interaction) {
        const sorteioId =
            interaction.customId.replace(
                "sorteio_participar_",
                ""
            );

        if (sorteioId === "preview") {
            return interaction.reply({
                content:
                    "👀 Essa é apenas uma prévia. O sorteio ainda não começou.",
                ephemeral: true
            });
        }

        const resultado =
            await participarSorteio(
                sorteioId,
                interaction.user.id
            );

        if (!resultado) {
            return interaction.reply({
                content:
                    "❌ Não foi possível registrar sua participação.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content:
                "🎟️ Você está participando do sorteio!",
            ephemeral: true
        });
    },

    iniciarSistemaSorteios,

    verificarSorteios,

    finalizarSorteio
};
