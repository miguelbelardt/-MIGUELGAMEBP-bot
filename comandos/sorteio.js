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

// ================================
// 🗄️ BANCO
// ================================

async function prepararBanco() {
    try {
        await pool.query(`
            ALTER TABLE sorteios
            ADD COLUMN IF NOT EXISTS criador_id VARCHAR(30)
        `);

        await pool.query(`
            ALTER TABLE sorteios
            ADD COLUMN IF NOT EXISTS mensagem_id VARCHAR(30)
        `);

        await pool.query(`
            ALTER TABLE sorteios
            ADD COLUMN IF NOT EXISTS mostrar_participantes
            BOOLEAN NOT NULL DEFAULT FALSE
        `);

        console.log("💾 Banco de sorteios preparado.");
    } catch (erro) {
        console.error("❌ Erro ao preparar banco de sorteios:", erro);
    }
}

// ================================
// ⚙️ CONFIG
// ================================

function criarConfig(guildId, usuarioId) {
    return {
        guildId,
        usuarioId,

        canalId: null,

        titulo: "",
        descricao: "",
        cor: "5865F2",

        imagem: null,
        thumbnail: null,

        data: null,
        horario: null,

        vencedores: 1,
        mostrarParticipantes: false,

        sorteioId: null,

        painelMensagemId: null,
        painelCanalId: null
    };
}

function normalizarCor(cor) {
    if (!cor) return 0x5865F2;

    const valor = String(cor)
        .trim()
        .replace("#", "");

    if (!/^[0-9A-Fa-f]{6}$/.test(valor)) {
        return 0x5865F2;
    }

    return parseInt(valor, 16);
}

// ================================
// 🛠️ PAINEL
// ================================

function criarPainelSorteio(usuarioId) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sorteio_config_${usuarioId}`)
                .setLabel("Configurar")
                .setEmoji("⚙️")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`sorteio_canal_${usuarioId}`)
                .setLabel("Escolher canal")
                .setEmoji("📢")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(`sorteio_vencedores_${usuarioId}`)
                .setLabel("Vencedores")
                .setEmoji("🏆")
                .setStyle(ButtonStyle.Secondary)
        ),

        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sorteio_data_${usuarioId}`)
                .setLabel("Data e horário")
                .setEmoji("📅")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(`sorteio_participantes_${usuarioId}`)
                .setLabel("Participantes")
                .setEmoji("👥")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(`sorteio_preview_${usuarioId}`)
                .setLabel("Visualizar sorteio")
                .setEmoji("👀")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`sorteio_enviar_${usuarioId}`)
                .setLabel("Enviar sorteio")
                .setEmoji("🚀")
                .setStyle(ButtonStyle.Primary)
        )
    ];
}

function criarEmbedPainel(config) {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎉 Criador de Sorteio")
        .setDescription("Configure o sorteio usando os botões abaixo.")
        .addFields(
            {
                name: "📝 Título",
                value: config.titulo || "❌ Não definido"
            },
            {
                name: "📄 Descrição",
                value: config.descricao || "❌ Não definida"
            },
            {
                name: "🎨 Cor",
                value: `#${String(config.cor || "5865F2").replace("#", "")}`,
                inline: true
            },
            {
                name: "🏆 Vencedores",
                value: String(config.vencedores || 1),
                inline: true
            },
            {
                name: "📢 Canal",
                value: config.canalId
                    ? `<#${config.canalId}>`
                    : "❌ Não escolhido",
                inline: true
            },
            {
                name: "👥 Participantes",
                value: config.mostrarParticipantes
                    ? "🟢 Visíveis"
                    : "🔴 Ocultos",
                inline: true
            },
            {
                name: "📅 Encerramento",
                value:
                    config.data && config.horario
                        ? `${config.data} às ${config.horario}`
                        : "❌ Não definido"
            }
        );
}

// ================================
// 🎉 EMBED DO SORTEIO
// ================================

function criarEmbedPreview(config, participantes = []) {
    const embed = new EmbedBuilder()
        .setColor(normalizarCor(config.cor))
        .setTitle(`🎉 ${config.titulo || "Sorteio"}`)
        .setDescription(
            config.descricao || "🎁 Participe deste sorteio!"
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

    if (config.mostrarParticipantes) {
        const lista = participantes.slice(0, 20);

        let texto = lista.length
            ? lista.map(id => `<@${id}>`).join("\n")
            : "Ninguém participou ainda.";

        if (participantes.length > 20) {
            texto += `\n... e mais **${participantes.length - 20}** pessoa(s).`;
        }

        embed.addFields({
            name: `👥 Participantes (${participantes.length})`,
            value: texto.slice(0, 1024)
        });
    }

    if (config.imagem) {
        embed.setImage(config.imagem);
    }

    if (config.thumbnail) {
        embed.setThumbnail(config.thumbnail);
    }

    embed.setFooter({
        text: "🎉 Clique no botão abaixo para participar!"
    });

    return embed;
}

// ================================
// 🎟️ BOTÕES DO SORTEIO
// ================================

function criarBotoesSorteio(
    id,
    quantidade = 0
) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sorteio_participar_${id}`)
                .setLabel(`Participar (${quantidade})`)
                .setEmoji("🎟️")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`sorteio_editar_${id}`)
                .setLabel("Editar sorteio")
                .setEmoji("✏️")
                .setStyle(ButtonStyle.Secondary)
        )
    ];
}

function criarBotaoParticipar(id) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`sorteio_participar_${id}`)
            .setLabel("Participar")
            .setEmoji("🎟️")
            .setStyle(ButtonStyle.Success)
    );
}

// ================================
// 📅 DATA
// ================================

function converterData(data, horario) {
    if (!data || !horario) return null;

    const timestamp = new Date(
        `${data}T${horario}:00-03:00`
    ).getTime();

    return Number.isNaN(timestamp)
        ? null
        : timestamp;
}

function formatarData(timestamp) {
    const data = new Date(Number(timestamp));

    return {
        data: data.toLocaleDateString("pt-BR"),
        horario: data.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
        })
    };
}

// ================================
// ✏️ ATUALIZAR PAINEL
// ================================

async function atualizarPainelCriacao(
    client,
    config
) {
    try {
        if (
            !config.painelMensagemId ||
            !config.painelCanalId
        ) {
            return false;
        }

        const canal = await client.channels
            .fetch(config.painelCanalId)
            .catch(() => null);

        if (!canal) return false;

        const mensagem = await canal.messages
            .fetch(config.painelMensagemId)
            .catch(() => null);

        if (!mensagem) return false;

        await mensagem.edit({
            embeds: [criarEmbedPainel(config)],
            components: criarPainelSorteio(
                config.usuarioId
            )
        });

        return true;
    } catch (erro) {
        console.error(
            "❌ Erro ao atualizar painel:",
            erro
        );

        return false;
    }
}

// ================================
// 🗄️ CRIAR SORTEIO
// ================================

async function criarSorteio(config) {
    const encerraEm = converterData(
        config.data,
        config.horario
    );

    if (!encerraEm) {
        throw new Error(
            "Data ou horário inválido."
        );
    }

    if (encerraEm <= Date.now()) {
        throw new Error(
            "A data e o horário precisam estar no futuro."
        );
    }

    const resultado = await pool.query(
        `
        INSERT INTO sorteios (
            guild_id,
            canal_id,
            criador_id,
            titulo,
            descricao,
            cor,
            imagem,
            thumbnail,
            encerra_em,
            vencedores,
            mostrar_participantes
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )
        RETURNING *
        `,
        [
            config.guildId,
            config.canalId,
            config.usuarioId,
            config.titulo,
            config.descricao,
            config.cor,
            config.imagem || null,
            config.thumbnail || null,
            encerraEm,
            config.vencedores || 1,
            config.mostrarParticipantes
        ]
    );

    return resultado.rows[0];
}

async function buscarSorteio(id) {
    const resultado = await pool.query(
        `
        SELECT *
        FROM sorteios
        WHERE id = $1
        `,
        [id]
    );

    return resultado.rows[0] || null;
}

async function buscarParticipantes(id) {
    const resultado = await pool.query(
        `
        SELECT user_id
        FROM sorteio_participantes
        WHERE sorteio_id = $1
        ORDER BY user_id
        `,
        [id]
    );

    return resultado.rows.map(
        p => p.user_id
    );
}

// ================================
// ✏️ ATUALIZAR MENSAGEM DO SORTEIO
// ================================

async function atualizarMensagemSorteio(
    client,
    id
) {
    try {
        const sorteio =
            await buscarSorteio(id);

        if (
            !sorteio ||
            !sorteio.mensagem_id
        ) {
            return false;
        }

        const canal = await client.channels
            .fetch(sorteio.canal_id)
            .catch(() => null);

        if (!canal) return false;

        const mensagem = await canal.messages
            .fetch(sorteio.mensagem_id)
            .catch(() => null);

        if (!mensagem) return false;

        const participantes =
            await buscarParticipantes(id);

        const data =
            formatarData(sorteio.encerra_em);

        const config = {
            titulo: sorteio.titulo,
            descricao: sorteio.descricao,
            cor: sorteio.cor,
            imagem: sorteio.imagem,
            thumbnail: sorteio.thumbnail,
            vencedores: sorteio.vencedores,
            mostrarParticipantes:
                sorteio.mostrar_participantes,
            data: data.data,
            horario: data.horario
        };

        await mensagem.edit({
            embeds: [
                criarEmbedPreview(
                    config,
                    participantes
                )
            ],
            components: criarBotoesSorteio(
                id,
                participantes.length
            )
        });

        return true;
    } catch (erro) {
        console.error(
            "❌ Erro ao atualizar mensagem do sorteio:",
            erro
        );

        return false;
    }
}

// ================================
// 🎟️ PARTICIPAR
// ================================

async function participarSorteio(
    id,
    userId,
    client
) {
    try {
        const sorteio =
            await buscarSorteio(id);

        if (!sorteio) {
            return {
                sucesso: false,
                mensagem:
                    "❌ Esse sorteio não existe."
            };
        }

        if (sorteio.encerrado) {
            return {
                sucesso: false,
                mensagem:
                    "❌ Esse sorteio já foi encerrado."
            };
        }

        if (
            Number(sorteio.encerra_em) <=
            Date.now()
        ) {
            return {
                sucesso: false,
                mensagem:
                    "❌ Esse sorteio já terminou."
            };
        }

        const resultado =
            await pool.query(
                `
                INSERT INTO sorteio_participantes
                (sorteio_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                RETURNING user_id
                `,
                [id, userId]
            );

        if (!resultado.rows.length) {
            return {
                sucesso: false,
                mensagem:
                    "⚠️ Você já está participando desse sorteio."
            };
        }

        await atualizarMensagemSorteio(
            client,
            id
        );

        return {
            sucesso: true,
            mensagem:
                "🎟️ Você está participando do sorteio!"
        };
    } catch (erro) {
        console.error(
            "❌ Erro ao registrar participante:",
            erro
        );

        return {
            sucesso: false,
            mensagem:
                "❌ Não foi possível registrar sua participação."
        };
    }
}

// ================================
// 🏆 FINALIZAR
// ================================

async function finalizarSorteio(
    client,
    sorteio
) {
    try {
        const lista =
            await buscarParticipantes(
                sorteio.id
            );

        if (!lista.length) {
            await pool.query(
                `
                UPDATE sorteios
                SET encerrado = TRUE
                WHERE id = $1
                `,
                [sorteio.id]
            );

            const canal =
                await client.channels
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
            Number(sorteio.vencedores) || 1,
            embaralhados.length
        );

        const vencedores =
            embaralhados.slice(
                0,
                quantidade
            );

        await pool.query(
            `
            UPDATE sorteios
            SET encerrado = TRUE,
                vencedores_ids = $1
            WHERE id = $2
            `,
            [
                vencedores,
                sorteio.id
            ]
        );

        const canal =
            await client.channels
                .fetch(sorteio.canal_id)
                .catch(() => null);

        if (!canal) return;

        const mencoes =
            vencedores
                .map(id => `<@${id}>`)
                .join(", ");

        const embed =
            new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(
                    "🏆 Sorteio encerrado!"
                )
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
        const resultado =
            await pool.query(
                `
                SELECT *
                FROM sorteios
                WHERE encerrado = FALSE
                AND encerra_em <= $1
                `,
                [Date.now()]
            );

        for (
            const sorteio
            of resultado.rows
        ) {
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
    prepararBanco();
    verificarSorteios(client);

    setInterval(
        () => verificarSorteios(client),
        10000
    );

    console.log(
        "🎉 Sistema de sorteios iniciado."
    );
}

// ================================
// 🔐 VERIFICAR CRIADOR
// ================================

async function verificarCriador(
    interaction,
    id
) {
    const sorteio =
        await buscarSorteio(id);

    if (!sorteio) {
        await interaction.reply({
            content:
                "❌ Esse sorteio não existe.",
            ephemeral: true
        });

        return null;
    }

    if (
        String(sorteio.criador_id) !==
        String(interaction.user.id)
    ) {
        await interaction.reply({
            content:
                "❌ Apenas quem criou este sorteio pode editá-lo.",
            ephemeral: true
        });

        return null;
    }

    if (sorteio.encerrado) {
        await interaction.reply({
            content:
                "❌ Esse sorteio já foi encerrado e não pode mais ser editado.",
            ephemeral: true
        });

        return null;
    }

    return sorteio;
}

// ================================
// 📦 EXPORTAÇÃO
// ================================

module.exports = {

    data: new SlashCommandBuilder()
        .setName("sorteio")
        .setDescription(
            "Cria um novo sorteio."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    // ================================
    // /SORTEIO
    // ================================

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

        const config =
            criarConfig(
                interaction.guildId,
                interaction.user.id
            );

        sessoes.set(
            interaction.user.id,
            config
        );

        await interaction.reply({
            embeds: [
                criarEmbedPainel(config)
            ],
            components:
                criarPainelSorteio(
                    interaction.user.id
                )
        });

        const mensagem =
            await interaction.fetchReply();

        config.painelMensagemId =
            mensagem.id;

        config.painelCanalId =
            interaction.channelId;
    },

    // ================================
    // 🔘 BOTÕES
    // ================================

    async handleButton(interaction) {

        const customId =
            interaction.customId;

        const userId =
            interaction.user.id;

        // ================================
        // ✏️ EDITAR SORTEIO EXISTENTE
        // ================================

        if (
            customId.startsWith(
                "sorteio_editar_"
            )
        ) {
            const id =
                customId.replace(
                    "sorteio_editar_",
                    ""
                );

            const sorteio =
                await verificarCriador(
                    interaction,
                    id
                );

            if (!sorteio) return;

            const config =
                criarConfig(
                    sorteio.guild_id,
                    sorteio.criador_id
                );

            config.sorteioId =
                sorteio.id;

            config.canalId =
                sorteio.canal_id;

            config.titulo =
                sorteio.titulo;

            config.descricao =
                sorteio.descricao;

            config.cor =
                sorteio.cor;

            config.imagem =
                sorteio.imagem;

            config.thumbnail =
                sorteio.thumbnail;

            config.vencedores =
                Number(
                    sorteio.vencedores
                ) || 1;

            config.mostrarParticipantes =
                sorteio.mostrar_participantes;

            config.painelMensagemId =
                sorteio.mensagem_id;

            config.painelCanalId =
                sorteio.canal_id;

            const data =
                formatarData(
                    sorteio.encerra_em
                );

            config.data =
                data.data
                    .split("/")
                    .reverse()
                    .join("-");

            config.horario =
                data.horario;

            sessoes.set(
                userId,
                config
            );

            // A PRÓPRIA MENSAGEM DO SORTEIO
            // vira o painel de edição.
            return interaction.update({
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(
                        userId
                    )
            });
        }

        // ================================
        // 🔐 IDENTIFICAR DONO DO PAINEL
        // ================================

        const partes =
            customId.split("_");

        const donoId =
            partes[partes.length - 1];

        const idsComDono = [
            "sorteio_config",
            "sorteio_canal",
            "sorteio_vencedores",
            "sorteio_data",
            "sorteio_participantes",
            "sorteio_preview",
            "sorteio_enviar"
        ];

        const tipo =
            partes.slice(0, -1).join("_");

        if (
            idsComDono.includes(tipo) &&
            donoId !== userId
        ) {
            return interaction.reply({
                content:
                    "❌ Apenas quem criou este sorteio pode usar este painel.",
                ephemeral: true
            });
        }

        const config =
            sessoes.get(userId);

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou.",
                ephemeral: true
            });
        }

        // ================================
        // ⚙️ CONFIGURAR
        // ================================

        if (
            tipo ===
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

            const campos = [
                [
                    "titulo",
                    "Título",
                    TextInputStyle.Short,
                    true,
                    256
                ],
                [
                    "descricao",
                    "Descrição",
                    TextInputStyle.Paragraph,
                    true,
                    4000
                ],
                [
                    "cor",
                    "Cor hexadecimal",
                    TextInputStyle.Short,
                    false,
                    6
                ],
                [
                    "imagem",
                    "Imagem",
                    TextInputStyle.Short,
                    false,
                    1000
                ],
                [
                    "thumbnail",
                    "Thumbnail",
                    TextInputStyle.Short,
                    false,
                    1000
                ]
            ];

            modal.addComponents(
                ...campos.map(
                    ([
                        id,
                        label,
                        style,
                        required,
                        max
                    ]) =>
                        new ActionRowBuilder()
                            .addComponents(
                                new TextInputBuilder()
                                    .setCustomId(
                                        id
                                    )
                                    .setLabel(
                                        label
                                    )
                                    .setStyle(
                                        style
                                    )
                                    .setRequired(
                                        required
                                    )
                                    .setMaxLength(
                                        max
                                    )
                                    .setValue(
                                        config[id] ||
                                        (
                                            id ===
                                            "cor"
                                                ? "5865F2"
                                                : ""
                                        )
                                    )
                            )
                )
            );

            return interaction.showModal(
                modal
            );
        }

        // ================================
        // 📅 DATA
        // ================================

        if (
            tipo ===
            "sorteio_data"
        ) {

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "sorteio_modal_data"
                    )
                    .setTitle(
                        "📅 Encerramento do sorteio"
                    );

            const data =
                new TextInputBuilder()
                    .setCustomId("data")
                    .setLabel(
                        "Data de encerramento"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(true)
                    .setPlaceholder(
                        "2026-12-31"
                    )
                    .setValue(
                        config.data || ""
                    );

            const horario =
                new TextInputBuilder()
                    .setCustomId(
                        "horario"
                    )
                    .setLabel(
                        "Horário de encerramento"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(true)
                    .setPlaceholder(
                        "23:59"
                    )
                    .setValue(
                        config.horario || ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(data),

                new ActionRowBuilder()
                    .addComponents(horario)
            );

            return interaction.showModal(
                modal
            );
        }

        // ================================
        // 👥 PARTICIPANTES
        // ================================

        if (
            tipo ===
            "sorteio_participantes"
        ) {

            config.mostrarParticipantes =
                !config.mostrarParticipantes;

            if (config.sorteioId) {

                await pool.query(
                    `
                    UPDATE sorteios
                    SET mostrar_participantes = $1
                    WHERE id = $2
                    `,
                    [
                        config.mostrarParticipantes,
                        config.sorteioId
                    ]
                );

                return interaction.update({
                    embeds: [
                        criarEmbedPreview(
                            config,
                            await buscarParticipantes(
                                config.sorteioId
                            )
                        )
                    ],
                    components:
                        criarBotoesSorteio(
                            config.sorteioId,
                            (
                                await buscarParticipantes(
                                    config.sorteioId
                                )
                            ).length
                        )
                });
            }

            return interaction.update({
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(
                        userId
                    )
            });
        }

        // ================================
        // 📢 CANAL
        // ================================

        if (
            tipo ===
            "sorteio_canal"
        ) {

            if (config.sorteioId) {
                return interaction.reply({
                    content:
                        "❌ O canal não pode ser alterado depois que o sorteio foi enviado.",
                    ephemeral: true
                });
            }

            const menu =
                new ChannelSelectMenuBuilder()
                    .setCustomId(
                        `sorteio_selecionar_canal_${userId}`
                    )
                    .setPlaceholder(
                        "📢 Escolha o canal do sorteio"
                    )
                    .addChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    );

            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            0x5865F2
                        )
                        .setTitle(
                            "📢 Escolha o canal"
                        )
                        .setDescription(
                            "Selecione abaixo o canal onde o sorteio será enviado."
                        )
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(menu)
                ]
            });
        }

        // ================================
        // 🏆 VENCEDORES
        // ================================

        if (
            tipo ===
            "sorteio_vencedores"
        ) {

            const menu =
                new StringSelectMenuBuilder()
                    .setCustomId(
                        `sorteio_selecionar_vencedores_${userId}`
                    )
                    .setPlaceholder(
                        "🏆 Quantos vencedores?"
                    )
                    .addOptions(
                        {
                            label:
                                "1 vencedor",
                            value:
                                "1",
                            emoji:
                                "🥇"
                        },
                        {
                            label:
                                "2 vencedores",
                            value:
                                "2",
                            emoji:
                                "🥈"
                        },
                        {
                            label:
                                "3 vencedores",
                            value:
                                "3",
                            emoji:
                                "🥉"
                        },
                        {
                            label:
                                "5 vencedores",
                            value:
                                "5",
                            emoji:
                                "🏆"
                        },
                        {
                            label:
                                "10 vencedores",
                            value:
                                "10",
                            emoji:
                                "🎉"
                        }
                    );

            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            0x5865F2
                        )
                        .setTitle(
                            "🏆 Vencedores"
                        )
                        .setDescription(
                            "Escolha quantas pessoas poderão ganhar."
                        )
                ],
                components: [
                    new ActionRowBuilder()
                        .addComponents(menu)
                ]
            });
        }

        // ================================
        // 👀 PREVIEW
        // ================================

        if (
            tipo ===
            "sorteio_preview"
        ) {

            return interaction.reply({
                content:
                    "👀 **Prévia do sorteio:**",
                embeds: [
                    criarEmbedPreview(
                        config
                    )
                ],
                components: [
                    criarBotaoParticipar(
                        "preview"
                    )
                ],
                ephemeral: true
            });
        }

        // ================================
        // 🚀 ENVIAR / SALVAR
        // ================================

        if (
            tipo ===
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

            if (
                !config.data ||
                !config.horario
            ) {
                return interaction.reply({
                    content:
                        "❌ Defina a data e o horário de encerramento.",
                    ephemeral: true
                });
            }

            const encerraEm =
                converterData(
                    config.data,
                    config.horario
                );

            if (
                !encerraEm ||
                encerraEm <= Date.now()
            ) {
                return interaction.reply({
                    content:
                        "❌ A data e o horário precisam estar no futuro.",
                    ephemeral: true
                });
            }

            try {

                // ================================
                // ✏️ EDITANDO SORTEIO EXISTENTE
                // ================================

                if (config.sorteioId) {

                    await pool.query(
                        `
                        UPDATE sorteios
                        SET titulo = $1,
                            descricao = $2,
                            cor = $3,
                            imagem = $4,
                            thumbnail = $5,
                            encerra_em = $6,
                            vencedores = $7,
                            mostrar_participantes = $8
                        WHERE id = $9
                        `,
                        [
                            config.titulo,
                            config.descricao,
                            config.cor,
                            config.imagem,
                            config.thumbnail,
                            encerraEm,
                            config.vencedores,
                            config.mostrarParticipantes,
                            config.sorteioId
                        ]
                    );

                    await atualizarMensagemSorteio(
                        interaction.client,
                        config.sorteioId
                    );

                    sessoes.delete(
                        userId
                    );

                    return interaction.update({
                        embeds: [
                            criarEmbedPreview(
                                config,
                                await buscarParticipantes(
                                    config.sorteioId
                                )
                            )
                        ],
                        components:
                            criarBotoesSorteio(
                                config.sorteioId,
                                (
                                    await buscarParticipantes(
                                        config.sorteioId
                                    )
                                ).length
                            )
                    });
                }

                // ================================
                // 🎉 CRIANDO NOVO
                // ================================

                const canal =
                    await interaction.guild.channels
                        .fetch(
                            config.canalId
                        )
                        .catch(
                            () => null
                        );

                if (!canal) {
                    return interaction.reply({
                        content:
                            "❌ Não consegui encontrar o canal escolhido.",
                        ephemeral: true
                    });
                }

                const sorteio =
                    await criarSorteio(
                        config
                    );

                // Se o painel está no mesmo canal,
                // transforma ele na mensagem do sorteio.
                if (
                    config.painelCanalId ===
                    config.canalId
                ) {

                    const painel =
                        await interaction.channel.messages
                            .fetch(
                                config.painelMensagemId
                            )
                            .catch(
                                () => null
                            );

                    if (!painel) {
                        throw new Error(
                            "Não consegui encontrar o painel original."
                        );
                    }

                    await painel.edit({
                        embeds: [
                            criarEmbedPreview(
                                config
                            )
                        ],
                        components:
                            criarBotoesSorteio(
                                sorteio.id,
                                0
                            )
                    });

                    await pool.query(
                        `
                        UPDATE sorteios
                        SET mensagem_id = $1
                        WHERE id = $2
                        `,
                        [
                            painel.id,
                            sorteio.id
                        ]
                    );

                    sessoes.delete(
                        userId
                    );

                    return interaction.deferUpdate();
                }

                // Se o canal escolhido for diferente,
                // o painel original não pode virar mensagem
                // porque são canais diferentes.
                const mensagem =
                    await canal.send({
                        embeds: [
                            criarEmbedPreview(
                                config
                            )
                        ],
                        components:
                            criarBotoesSorteio(
                                sorteio.id,
                                0
                            )
                    });

                await pool.query(
                    `
                    UPDATE sorteios
                    SET mensagem_id = $1
                    WHERE id = $2
                    `,
                    [
                        mensagem.id,
                        sorteio.id
                    ]
                );

                sessoes.delete(
                    userId
                );

                return interaction.reply({
                    content:
                        `✅ Sorteio enviado em ${canal}!`,
                    ephemeral: true
                });

            } catch (erro) {

                console.error(
                    "❌ Erro ao criar/enviar sorteio:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível criar o sorteio.",
                    ephemeral: true
                });
            }
        }
    },

    // ================================
    // 📝 MODAIS
    // ================================

    async handleModal(interaction) {

        const config =
            sessoes.get(
                interaction.user.id
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou.",
                ephemeral: true
            });
        }

        // ================================
        // ⚙️ CONFIGURAÇÃO
        // ================================

        if (
            interaction.customId ===
            "sorteio_modal_config"
        ) {

            config.titulo =
                interaction.fields
                    .getTextInputValue(
                        "titulo"
                    )
                    .trim();

            config.descricao =
                interaction.fields
                    .getTextInputValue(
                        "descricao"
                    )
                    .trim();

            const cor =
                interaction.fields
                    .getTextInputValue(
                        "cor"
                    )
                    .trim()
                    .replace(
                        "#",
                        ""
                    );

            if (
                cor &&
                !/^[0-9A-Fa-f]{6}$/.test(
                    cor
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ A cor precisa estar no formato hexadecimal.",
                    ephemeral: true
                });
            }

            config.cor =
                cor || "5865F2";

            config.imagem =
                interaction.fields
                    .getTextInputValue(
                        "imagem"
                    )
                    .trim() || null;

            config.thumbnail =
                interaction.fields
                    .getTextInputValue(
                        "thumbnail"
                    )
                    .trim() || null;

            if (config.sorteioId) {

                await pool.query(
                    `
                    UPDATE sorteios
                    SET titulo = $1,
                        descricao = $2,
                        cor = $3,
                        imagem = $4,
                        thumbnail = $5
                    WHERE id = $6
                    `,
                    [
                        config.titulo,
                        config.descricao,
                        config.cor,
                        config.imagem,
                        config.thumbnail,
                        config.sorteioId
                    ]
                );
            }

            // EDITA A MESMA MENSAGEM
            return interaction.update({
                embeds: [
                    config.sorteioId
                        ? criarEmbedPreview(
                            config,
                            await buscarParticipantes(
                                config.sorteioId
                            )
                        )
                        : criarEmbedPainel(
                            config
                        )
                ],
                components:
                    config.sorteioId
                        ? criarBotoesSorteio(
                            config.sorteioId,
                            (
                                await buscarParticipantes(
                                    config.sorteioId
                                )
                            ).length
                        )
                        : criarPainelSorteio(
                            interaction.user.id
                        )
            });
        }

        // ================================
        // 📅 DATA
        // ================================

        if (
            interaction.customId ===
            "sorteio_modal_data"
        ) {

            const data =
                interaction.fields
                    .getTextInputValue(
                        "data"
                    )
                    .trim();

            const horario =
                interaction.fields
                    .getTextInputValue(
                        "horario"
                    )
                    .trim();

            if (
                !/^\d{4}-\d{2}-\d{2}$/.test(
                    data
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ A data precisa estar no formato `AAAA-MM-DD`.",
                    ephemeral: true
                });
            }

            if (
                !/^\d{2}:\d{2}$/.test(
                    horario
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ O horário precisa estar no formato `HH:MM`.",
                    ephemeral: true
                });
            }

            const encerraEm =
                converterData(
                    data,
                    horario
                );

            if (
                !encerraEm ||
                encerraEm <= Date.now()
            ) {
                return interaction.reply({
                    content:
                        "❌ A data e o horário precisam estar no futuro.",
                    ephemeral: true
                });
            }

            config.data = data;
            config.horario = horario;

            if (config.sorteioId) {

                await pool.query(
                    `
                    UPDATE sorteios
                    SET encerra_em = $1
                    WHERE id = $2
                    `,
                    [
                        encerraEm,
                        config.sorteioId
                    ]
                );

                const participantes =
                    await buscarParticipantes(
                        config.sorteioId
                    );

                return interaction.update({
                    embeds: [
                        criarEmbedPreview(
                            config,
                            participantes
                        )
                    ],
                    components:
                        criarBotoesSorteio(
                            config.sorteioId,
                            participantes.length
                        )
                });
            }

            return interaction.update({
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(
                        interaction.user.id
                    )
            });
        }
    },

    // ================================
    // 🔽 SELECTS
    // ================================

    async handleSelect(interaction) {

        const customId =
            interaction.customId;

        const userId =
            interaction.user.id;

        const config =
            sessoes.get(userId);

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou.",
                ephemeral: true
            });
        }

        // ================================
        // 📢 CANAL
        // ================================

        if (
            customId.startsWith(
                "sorteio_selecionar_canal_"
            )
        ) {

            const donoId =
                customId.replace(
                    "sorteio_selecionar_canal_",
                    ""
                );

            if (
                donoId !== userId
            ) {
                return interaction.reply({
                    content:
                        "❌ Apenas quem criou este sorteio pode escolher o canal.",
                    ephemeral: true
                });
            }

            config.canalId =
                interaction.values[0];

            return interaction.update({
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(
                        userId
                    )
            });
        }

        // ================================
        // 🏆 VENCEDORES
        // ================================

        if (
            customId.startsWith(
                "sorteio_selecionar_vencedores_"
            )
        ) {

            const donoId =
                customId.replace(
                    "sorteio_selecionar_vencedores_",
                    ""
                );

            if (
                donoId !== userId
            ) {
                return interaction.reply({
                    content:
                        "❌ Apenas quem criou este sorteio pode escolher os vencedores.",
                    ephemeral: true
                });
            }

            config.vencedores =
                Number(
                    interaction.values[0]
                );

            if (config.sorteioId) {

                await pool.query(
                    `
                    UPDATE sorteios
                    SET vencedores = $1
                    WHERE id = $2
                    `,
                    [
                        config.vencedores,
                        config.sorteioId
                    ]
                );

                const participantes =
                    await buscarParticipantes(
                        config.sorteioId
                    );

                return interaction.update({
                    embeds: [
                        criarEmbedPreview(
                            config,
                            participantes
                        )
                    ],
                    components:
                        criarBotoesSorteio(
                            config.sorteioId,
                            participantes.length
                        )
                });
            }

            return interaction.update({
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(
                        userId
                    )
            });
        }
    },

    // ================================
    // 🎟️ PARTICIPAÇÃO
    // ================================

    async handleParticipation(
        interaction
    ) {

        const id =
            interaction.customId.replace(
                "sorteio_participar_",
                ""
            );

        if (id === "preview") {
            return interaction.reply({
                content:
                    "👀 Essa é apenas uma prévia. O sorteio ainda não começou.",
                ephemeral: true
            });
        }

        const resultado =
            await participarSorteio(
                id,
                interaction.user.id,
                interaction.client
            );

        return interaction.reply({
            content:
                resultado.mensagem,
            ephemeral: true
        });
    },

    iniciarSistemaSorteios,

    verificarSorteios,

    finalizarSorteio,

    atualizarMensagemSorteio
};
