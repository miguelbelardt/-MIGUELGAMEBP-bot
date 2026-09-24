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

// =====================================================
// 🗄️ PREPARAR BANCO
// =====================================================

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
            ADD COLUMN IF NOT EXISTS mostrar_participantes BOOLEAN
            NOT NULL DEFAULT FALSE
        `);

        console.log("💾 Banco de sorteios preparado.");
    } catch (erro) {
        console.error(
            "❌ Erro ao preparar banco de sorteios:",
            erro
        );
    }
}

// =====================================================
// ⚙️ CONFIGURAÇÃO
// =====================================================

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
        mostrarParticipantes: false
    };
}

// =====================================================
// 🎨 COR
// =====================================================

function normalizarCor(cor) {
    if (!cor) return 0x5865F2;

    let valor = String(cor)
        .trim()
        .replace("#", "");

    if (!/^[0-9A-Fa-f]{6}$/.test(valor)) {
        return 0x5865F2;
    }

    return parseInt(valor, 16);
}

// =====================================================
// 🛠️ PAINEL DE CRIAÇÃO
// =====================================================

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
                .setCustomId("sorteio_data")
                .setLabel("Data e horário")
                .setEmoji("📅")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId("sorteio_participantes")
                .setLabel("Participantes")
                .setEmoji("👥")
                .setStyle(ButtonStyle.Secondary),

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

// =====================================================
// 📋 PAINEL
// =====================================================

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
                value:
                    `#${String(
                        config.cor || "5865F2"
                    ).replace("#", "")}`,
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
                name: "👥 Participantes",
                value:
                    config.mostrarParticipantes
                        ? "🟢 Visíveis"
                        : "🔴 Ocultos",
                inline: true
            },
            {
                name: "📅 Encerramento",
                value:
                    config.data && config.horario
                        ? `${config.data} às ${config.horario}`
                        : "❌ Não definido",
                inline: false
            }
        )
        .setFooter({
            text: "As configurações ficam salvas enquanto você monta o sorteio."
        });
}

// =====================================================
// 🎉 EMBED DO SORTEIO
// =====================================================

function criarEmbedPreview(config, participantes = []) {
    const embed = new EmbedBuilder()
        .setColor(normalizarCor(config.cor))
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
            value:
                `${config.data} às ${config.horario}`,
            inline: true
        });
    }

    if (config.mostrarParticipantes) {
        let lista = participantes;

        if (lista.length > 20) {
            lista = lista.slice(0, 20);
        }

        let texto;

        if (lista.length === 0) {
            texto = "Ninguém participou ainda.";
        } else {
            texto = lista
                .map(id => `<@${id}>`)
                .join("\n");

            if (participantes.length > 20) {
                texto +=
                    `\n... e mais **${participantes.length - 20}** pessoa(s).`;
            }
        }

        embed.addFields({
            name: `👥 Participantes (${participantes.length})`,
            value: texto.slice(0, 1024),
            inline: false
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

// =====================================================
// 🎟️ BOTÕES DO SORTEIO
// =====================================================

function criarBotoesSorteio(
    sorteioId,
    quantidadeParticipantes = 0
) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `sorteio_participar_${sorteioId}`
                )
                .setLabel(
                    `Participar (${quantidadeParticipantes})`
                )
                .setEmoji("🎟️")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(
                    `sorteio_editar_${sorteioId}`
                )
                .setLabel("Editar sorteio")
                .setEmoji("✏️")
                .setStyle(ButtonStyle.Secondary)
        )
    ];
}

function criarBotaoParticipar(sorteioId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(
                `sorteio_participar_${sorteioId}`
            )
            .setLabel("Participar")
            .setEmoji("🎟️")
            .setStyle(ButtonStyle.Success)
    );
}

// =====================================================
// 📅 DATA
// =====================================================

function converterData(data, horario) {
    if (!data || !horario) return null;

    const timestamp = new Date(
        `${data}T${horario}:00-03:00`
    ).getTime();

    return Number.isNaN(timestamp)
        ? null
        : timestamp;
}

// =====================================================
// 🗄️ CRIAR SORTEIO
// =====================================================

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
        INSERT INTO sorteios
        (
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
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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

// =====================================================
// 👥 BUSCAR PARTICIPANTES
// =====================================================

async function buscarParticipantes(sorteioId) {
    const resultado = await pool.query(
        `
        SELECT user_id
        FROM sorteio_participantes
        WHERE sorteio_id = $1
        ORDER BY user_id
        `,
        [sorteioId]
    );

    return resultado.rows.map(
        participante => participante.user_id
    );
}

// =====================================================
// ✏️ ATUALIZAR MENSAGEM DO SORTEIO
// =====================================================

async function atualizarMensagemSorteio(
    client,
    sorteioId
) {
    try {
        const resultado = await pool.query(
            `
            SELECT *
            FROM sorteios
            WHERE id = $1
            `,
            [sorteioId]
        );

        if (resultado.rows.length === 0) {
            return false;
        }

        const sorteio = resultado.rows[0];

        if (!sorteio.mensagem_id) {
            return false;
        }

        const canal = await client.channels
            .fetch(sorteio.canal_id)
            .catch(() => null);

        if (!canal) {
            return false;
        }

        const mensagem = await canal.messages
            .fetch(sorteio.mensagem_id)
            .catch(() => null);

        if (!mensagem) {
            return false;
        }

        const participantes =
            await buscarParticipantes(sorteio.id);

        const config = {
            titulo: sorteio.titulo,
            descricao: sorteio.descricao,
            cor: sorteio.cor,
            imagem: sorteio.imagem,
            thumbnail: sorteio.thumbnail,
            vencedores: sorteio.vencedores,
            mostrarParticipantes:
                sorteio.mostrar_participantes,
            data: new Date(
                Number(sorteio.encerra_em)
            )
                .toLocaleDateString("pt-BR"),
            horario: new Date(
                Number(sorteio.encerra_em)
            )
                .toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                })
        };

        await mensagem.edit({
            embeds: [
                criarEmbedPreview(
                    config,
                    participantes
                )
            ],
            components: criarBotoesSorteio(
                sorteio.id,
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

// =====================================================
// 🎟️ PARTICIPAR
// =====================================================

async function participarSorteio(
    sorteioId,
    userId,
    client
) {
    try {
        const sorteio =
            await pool.query(
                `
                SELECT *
                FROM sorteios
                WHERE id = $1
                `,
                [sorteioId]
            );

        if (sorteio.rows.length === 0) {
            return {
                sucesso: false,
                mensagem:
                    "❌ Esse sorteio não existe."
            };
        }

        const dados =
            sorteio.rows[0];

        if (dados.encerrado) {
            return {
                sucesso: false,
                mensagem:
                    "❌ Esse sorteio já foi encerrado."
            };
        }

        if (
            Number(dados.encerra_em) <=
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
                [
                    sorteioId,
                    userId
                ]
            );

        if (
            resultado.rows.length ===
            0
        ) {
            return {
                sucesso: false,
                mensagem:
                    "⚠️ Você já está participando desse sorteio."
            };
        }

        await atualizarMensagemSorteio(
            client,
            sorteioId
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

// =====================================================
// 🏆 FINALIZAR SORTEIO
// =====================================================

async function finalizarSorteio(
    client,
    sorteio
) {
    try {
        const lista =
            await buscarParticipantes(
                sorteio.id
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

        const embaralhados =
            [...lista];

        for (
            let i = embaralhados.length - 1;
            i > 0;
            i--
        ) {
            const j =
                Math.floor(
                    Math.random() *
                    (i + 1)
                );

            [
                embaralhados[i],
                embaralhados[j]
            ] = [
                embaralhados[j],
                embaralhados[i]
            ];
        }

        const quantidade =
            Math.min(
                Number(
                    sorteio.vencedores
                ) || 1,
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
            SET
                encerrado = TRUE,
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
                .map(
                    id =>
                        `<@${id}>`
                )
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

// =====================================================
// ⏰ VERIFICAR SORTEIOS
// =====================================================

async function verificarSorteios(
    client
) {
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
            const sorteio of
            resultado.rows
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

// =====================================================
// 🔄 SISTEMA
// =====================================================

function iniciarSistemaSorteios(
    client
) {
    prepararBanco();

    verificarSorteios(
        client
    );

    setInterval(
        () =>
            verificarSorteios(
                client
            ),
        10000
    );

    console.log(
        "🎉 Sistema de sorteios iniciado."
    );
}

// =====================================================
// ✏️ EDITAR SORTEIO EXISTENTE
// =====================================================

async function buscarSorteio(
    sorteioId
) {
    const resultado =
        await pool.query(
            `
            SELECT *
            FROM sorteios
            WHERE id = $1
            `,
            [sorteioId]
        );

    return resultado.rows[0] || null;
}

async function verificarCriador(
    interaction,
    sorteioId
) {
    const sorteio =
        await buscarSorteio(
            sorteioId
        );

    if (!sorteio) {
        await interaction.reply({
            content:
                "❌ Esse sorteio não existe.",
            ephemeral: true
        });

        return null;
    }

    if (
        String(
            sorteio.criador_id
        ) !==
        String(
            interaction.user.id
        )
    ) {
        await interaction.reply({
            content:
                "❌ Apenas a pessoa que criou este sorteio pode editá-lo.",
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

// =====================================================
// 📦 EXPORTAÇÃO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sorteio")
        .setDescription(
            "Cria um novo sorteio."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    // =================================================
    // /SORTEIO
    // =================================================

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
                criarEmbedPainel(
                    config
                )
            ],
            components:
                criarPainelSorteio(),
            ephemeral: true
        });
    },

    // =================================================
    // 🔘 BOTÕES
    // =================================================

    async handleButton(
        interaction
    ) {
        const userId =
            interaction.user.id;

        // =============================================
        // ✏️ EDITAR SORTEIO EXISTENTE
        // =============================================

        if (
            interaction.customId.startsWith(
                "sorteio_editar_"
            )
        ) {
            const sorteioId =
                interaction.customId.replace(
                    "sorteio_editar_",
                    ""
                );

            const sorteio =
                await verificarCriador(
                    interaction,
                    sorteioId
                );

            if (!sorteio) return;

            const config =
                criarConfig(
                    sorteio.guild_id,
                    sorteio.criador_id
                );

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

            const data =
                new Date(
                    Number(
                        sorteio.encerra_em
                    )
                );

            config.data =
                data
                    .toLocaleDateString(
                        "en-CA"
                    );

            config.horario =
                data
                    .toLocaleTimeString(
                        "pt-BR",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    );

            config.sorteioId =
                sorteio.id;

            sessoes.set(
                userId,
                config
            );

            return interaction.reply({
                content:
                    "✏️ **Editando sorteio**\nUse os botões abaixo para alterar as configurações.",
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(),
                ephemeral: true
            });
        }

        // =============================================
        // 🧩 CONFIGURAÇÃO
        // =============================================

        let config =
            sessoes.get(
                userId
            );

        if (!config) {
            config =
                criarConfig(
                    interaction.guildId,
                    userId
                );

            sessoes.set(
                userId,
                config
            );
        }

        // =============================================
        // ⚙️ CONFIG
        // =============================================

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
                    .setCustomId(
                        "titulo"
                    )
                    .setLabel(
                        "Título"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(
                        true
                    )
                    .setMaxLength(
                        256
                    )
                    .setValue(
                        config.titulo ||
                        ""
                    );

            const descricao =
                new TextInputBuilder()
                    .setCustomId(
                        "descricao"
                    )
                    .setLabel(
                        "Descrição"
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(
                        true
                    )
                    .setMaxLength(
                        4000
                    )
                    .setValue(
                        config.descricao ||
                        ""
                    );

            const cor =
                new TextInputBuilder()
                    .setCustomId(
                        "cor"
                    )
                    .setLabel(
                        "Cor hexadecimal"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(
                        false
                    )
                    .setPlaceholder(
                        "5865F2"
                    )
                    .setValue(
                        config.cor ||
                        "5865F2"
                    );

            const imagem =
                new TextInputBuilder()
                    .setCustomId(
                        "imagem"
                    )
                    .setLabel(
                        "Imagem"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(
                        false
                    )
                    .setPlaceholder(
                        "https://..."
                    )
                    .setValue(
                        config.imagem ||
                        ""
                    );

            const thumbnail =
                new TextInputBuilder()
                    .setCustomId(
                        "thumbnail"
                    )
                    .setLabel(
                        "Thumbnail"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(
                        false
                    )
                    .setPlaceholder(
                        "https://..."
                    )
                    .setValue(
                        config.thumbnail ||
                        ""
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

        // =============================================
        // 📅 DATA
        // =============================================

        if (
            interaction.customId ===
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
                    .setCustomId(
                        "data"
                    )
                    .setLabel(
                        "Data de encerramento"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(
                        true
                    )
                    .setPlaceholder(
                        "2026-12-31"
                    )
                    .setValue(
                        config.data ||
                        ""
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
                    .setRequired(
                        true
                    )
                    .setPlaceholder(
                        "23:59"
                    )
                    .setValue(
                        config.horario ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    data
                ),
                new ActionRowBuilder().addComponents(
                    horario
                )
            );

            return interaction.showModal(
                modal
            );
        }

        // =============================================
        // 👥 PARTICIPANTES
        // =============================================

        if (
            interaction.customId ===
            "sorteio_participantes"
        ) {
            config.mostrarParticipantes =
                !config.mostrarParticipantes;

            const status =
                config.mostrarParticipantes
                    ? "🟢 ativada"
                    : "🔴 desativada";

            // Se for edição, salva imediatamente
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

                await atualizarMensagemSorteio(
                    interaction.client,
                    config.sorteioId
                );
            }

            return interaction.reply({
                content:
                    `👥 Visualização dos participantes ${status}!`,
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(),
                ephemeral: true
            });
        }

        // =============================================
        // 📢 CANAL
        // =============================================

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
                    .setMinValues(
                        1
                    )
                    .setMaxValues(
                        1
                    );

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

        // =============================================
        // 🏆 VENCEDORES
        // =============================================

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

        // =============================================
        // 👀 PREVIEW
        // =============================================

        if (
            interaction.customId ===
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

        // =============================================
        // 🚀 ENVIAR
        // =============================================

        if (
            interaction.customId ===
            "sorteio_enviar"
        ) {
            if (!config.titulo) {
                return interaction.reply({
                    content:
                        "❌ Configure o título primeiro.",
                    ephemeral:
                        true
                });
            }

            if (!config.descricao) {
                return interaction.reply({
                    content:
                        "❌ Configure a descrição primeiro.",
                    ephemeral:
                        true
                });
            }

            if (!config.canalId) {
                return interaction.reply({
                    content:
                        "❌ Escolha o canal do sorteio.",
                    ephemeral:
                        true
                });
            }

            if (
                !config.data ||
                !config.horario
            ) {
                return interaction.reply({
                    content:
                        "❌ Defina a data e o horário de encerramento.",
                    ephemeral:
                        true
                });
            }

            const encerraEm =
                converterData(
                    config.data,
                    config.horario
                );

            if (!encerraEm) {
                return interaction.reply({
                    content:
                        "❌ A data ou horário está inválido.",
                    ephemeral:
                        true
                });
            }

            if (
                encerraEm <=
                Date.now()
            ) {
                return interaction.reply({
                    content:
                        "❌ A data e o horário precisam estar no futuro.",
                    ephemeral:
                        true
                });
            }

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
                    ephemeral:
                        true
                });
            }

            try {
                const sorteio =
                    await criarSorteio(
                        config
                    );

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
                    ephemeral:
                        true
                });
            } catch (erro) {
                console.error(
                    "❌ Erro ao criar/enviar sorteio:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível criar o sorteio.",
                    ephemeral:
                        true
                });
            }
        }
    },

    // =================================================
    // 📝 MODAIS
    // =================================================

    async handleModal(
        interaction
    ) {
        const config =
            sessoes.get(
                interaction.user.id
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou. Use `/sorteio` novamente.",
                ephemeral:
                    true
            });
        }

        // =============================================
        // ⚙️ CONFIGURAÇÃO
        // =============================================

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
                    .trim();

            if (
                cor &&
                !/^[0-9A-Fa-f]{6}$/.test(
                    cor.replace(
                        "#",
                        ""
                    )
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ A cor precisa estar no formato hexadecimal, por exemplo `5865F2`.",
                    ephemeral:
                        true
                });
            }

            config.cor =
                cor.replace(
                    "#",
                    ""
                ) ||
                "5865F2";

            config.imagem =
                interaction.fields
                    .getTextInputValue(
                        "imagem"
                    )
                    .trim() ||
                null;

            config.thumbnail =
                interaction.fields
                    .getTextInputValue(
                        "thumbnail"
                    )
                    .trim() ||
                null;

            // =========================================
            // ✏️ SALVAR E ATUALIZAR SORTEIO EXISTENTE
            // =========================================

            if (config.sorteioId) {
                await pool.query(
                    `
                    UPDATE sorteios
                    SET
                        titulo = $1,
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

                await atualizarMensagemSorteio(
                    interaction.client,
                    config.sorteioId
                );
            }

            return interaction.reply({
                content:
                    config.sorteioId
                        ? "✅ Sorteio atualizado!"
                        : "✅ Configurações salvas!",
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(),
                ephemeral:
                    true
            });
        }

        // =============================================
        // 📅 DATA
        // =============================================

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
                    ephemeral:
                        true
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
                    ephemeral:
                        true
                });
            }

            const encerraEm =
                converterData(
                    data,
                    horario
                );

            if (!encerraEm) {
                return interaction.reply({
                    content:
                        "❌ A data ou horário informado é inválido.",
                    ephemeral:
                        true
                });
            }

            if (
                encerraEm <=
                Date.now()
            ) {
                return interaction.reply({
                    content:
                        "❌ A data e o horário precisam estar no futuro.",
                    ephemeral:
                        true
                });
            }

            config.data =
                data;

            config.horario =
                horario;

            // =========================================
            // ✏️ ATUALIZAR SORTEIO EXISTENTE
            // =========================================

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

                await atualizarMensagemSorteio(
                    interaction.client,
                    config.sorteioId
                );
            }

            return interaction.reply({
                content:
                    config.sorteioId
                        ? "✅ Data e horário atualizados!"
                        : "✅ Data e horário salvos!",
                embeds: [
                    criarEmbedPainel(
                        config
                    )
                ],
                components:
                    criarPainelSorteio(),
                ephemeral:
                    true
            });
        }
    },

    // =================================================
    // 🔽 SELECT MENUS
    // =================================================

    async handleSelect(
        interaction
    ) {
        const config =
            sessoes.get(
                interaction.user.id
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua sessão de sorteio expirou. Use `/sorteio` novamente.",
                ephemeral:
                    true
            });
        }

        // =============================================
        // 📢 CANAL
        // =============================================

        if (
            interaction.customId ===
            "sorteio_selecionar_canal"
        ) {
            config.canalId =
                interaction.values[0];

            // Canal só pode ser alterado se o sorteio ainda não foi enviado
            if (config.sorteioId) {
                await pool.query(
                    `
                    UPDATE sorteios
                    SET canal_id = $1
                    WHERE id = $2
                    `,
                    [
                        config.canalId,
                        config.sorteioId
                    ]
                );
            }

            return interaction.update({
                content:
                    `✅ Canal escolhido: <#${config.canalId}>`,
                components: []
            });
        }

        // =============================================
        // 🏆 VENCEDORES
        // =============================================

        if (
            interaction.customId ===
            "sorteio_selecionar_vencedores"
        ) {
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

                await atualizarMensagemSorteio(
                    interaction.client,
                    config.sorteioId
                );
            }

            return interaction.update({
                content:
                    `🏆 Quantidade de vencedores definida: **${config.vencedores}**`,
                components: []
            });
        }
    },

    // =================================================
    // 🎟️ PARTICIPAÇÃO
    // =================================================

    async handleParticipation(
        interaction
    ) {
        const sorteioId =
            interaction.customId.replace(
                "sorteio_participar_",
                ""
            );

        if (
            sorteioId ===
            "preview"
        ) {
            return interaction.reply({
                content:
                    "👀 Essa é apenas uma prévia. O sorteio ainda não começou.",
                ephemeral:
                    true
            });
        }

        const resultado =
            await participarSorteio(
                sorteioId,
                interaction.user.id,
                interaction.client
            );

        return interaction.reply({
            content:
                resultado.mensagem,
            ephemeral:
                true
        });
    },

    // =================================================
    // 🔄 SISTEMA
    // =================================================

    iniciarSistemaSorteios,

    verificarSorteios,

    finalizarSorteio,

    atualizarMensagemSorteio
};
