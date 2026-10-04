const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ChannelType
} = require("discord.js");

const { mysqlPool } = require("../database/database");

// =====================================================
// ⚙️ COMANDO REACT ROLE
// =====================================================

const data = new SlashCommandBuilder()
    .setName("reactrole")
    .setDescription("Configura um sistema de cargos por reação.")
    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
    )

    // =================================================
    // ⚙️ CONFIGURAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("configurar")
            .setDescription(
                "Abre o painel de configuração do Reaction Role."
            )
    )

    // =================================================
    // ✏️ EDITAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("editar")
            .setDescription(
                "Edita um Reaction Role já existente."
            )
    )

    // =================================================
    // 📋 STATUS
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("status")
            .setDescription(
                "Mostra a configuração de um Reaction Role."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )
    )

    // =================================================
    // 🧪 TESTE
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("teste")
            .setDescription(
                "Testa um Reaction Role."
            )
    )

    // =================================================
    // 🟢 ATIVAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("ativar")
            .setDescription(
                "Ativa um Reaction Role."
            )
    )

    // =================================================
    // 🔴 DESATIVAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("desativar")
            .setDescription(
                "Desativa um Reaction Role."
            )
    );

// =====================================================
// 🎨 NORMALIZAR COR
// =====================================================

function normalizarCor(cor) {
    if (!cor) return null;

    let texto = String(cor)
        .trim()
        .replace(/^#/, "");

    if (!/^[0-9A-Fa-f]{6}$/.test(texto)) {
        return null;
    }

    return `#${texto.toUpperCase()}`;
}

// =====================================================
// 🎭 NORMALIZAR EMOJI
// =====================================================

function normalizarEmoji(emoji) {
    if (!emoji) return null;

    if (
        typeof emoji === "object" &&
        emoji.id
    ) {
        return `${emoji.name}:${emoji.id}`;
    }

    const texto = String(emoji).trim();

    const customEmoji = texto.match(
        /^<a?:([^:>]+):(\d+)>$/
    );

    if (customEmoji) {
        return `${customEmoji[1]}:${customEmoji[2]}`;
    }

    return texto;
}

// =====================================================
// 🔗 VALIDAR URL
// =====================================================

function urlValida(url) {
    if (!url) return true;

    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// =====================================================
// 💾 CRIAR CONFIGURAÇÃO
// =====================================================

async function criarConfig(guildId) {
    const [resultado] = await mysqlPool.query(
        `
        INSERT INTO react_role_configs (
            guild_id,
            habilitado,
            embed_habilitado
        )
        VALUES (?, TRUE, TRUE)
        `,
        [guildId]
    );

    return resultado.insertId;
}

// =====================================================
// 🔎 BUSCAR CONFIGURAÇÃO
// =====================================================

async function buscarConfig(id, guildId) {
    const [rows] = await mysqlPool.query(
        `
        SELECT *
        FROM react_role_configs
        WHERE id = ?
          AND guild_id = ?
        LIMIT 1
        `,
        [id, guildId]
    );

    return rows[0] || null;
}

// =====================================================
// 🔎 BUSCAR POR MENSAGEM
// =====================================================

async function buscarConfigMensagem(
    guildId,
    mensagemId
) {
    const [rows] = await mysqlPool.query(
        `
        SELECT *
        FROM react_role_configs
        WHERE guild_id = ?
          AND mensagem_id = ?
        LIMIT 1
        `,
        [
            guildId,
            mensagemId
        ]
    );

    return rows[0] || null;
}

// =====================================================
// 💾 ATUALIZAR CONFIG
// =====================================================

async function atualizarConfig(
    id,
    guildId,
    dados
) {
    await mysqlPool.query(
        `
        UPDATE react_role_configs
        SET
            canal_id = ?,
            mensagem_id = ?,
            content = ?,
            embed_habilitado = ?,
            embed_titulo = ?,
            embed_descricao = ?,
            embed_cor = ?,
            footer_habilitado = ?,
            footer_texto = ?,
            imagem = ?,
            thumbnail = ?,
            habilitado = ?,
            atualizado_em =
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        WHERE id = ?
          AND guild_id = ?
        `,
        [
            dados.canal_id || null,
            dados.mensagem_id || null,
            dados.content || null,

            dados.embed_habilitado !== false,

            dados.embed_titulo || null,
            dados.embed_descricao || null,
            dados.embed_cor || null,

            dados.footer_habilitado === true,
            dados.footer_texto || null,

            dados.imagem || null,
            dados.thumbnail || null,

            dados.habilitado !== false,

            id,
            guildId
        ]
    );
}

// =====================================================
// 🎭 BUSCAR CARGOS
// =====================================================

async function buscarCargos(
    guildId,
    mensagemId
) {
    if (!mensagemId) return [];

    const [rows] = await mysqlPool.query(
        `
        SELECT *
        FROM react_roles
        WHERE guild_id = ?
          AND mensagem_id = ?
        ORDER BY id ASC
        `,
        [
            guildId,
            mensagemId
        ]
    );

    return rows;
}

// =====================================================
// 🎭 SALVAR CARGO
// =====================================================

async function salvarCargo({
    guildId,
    mensagemId,
    emoji,
    cargoId,
    config
}) {
    const emojiNormalizado =
        normalizarEmoji(emoji);

    await mysqlPool.query(
        `
        INSERT INTO react_roles (
            guild_id,
            mensagem_id,
            emoji,
            cargo_id,
            content,
            embed_habilitado,
            embed_titulo,
            embed_descricao,
            embed_cor,
            footer_habilitado,
            footer_texto,
            imagem,
            thumbnail,
            criado_em,
            atualizado_em
        )
        VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000,
            UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        )
        ON DUPLICATE KEY UPDATE
            cargo_id = VALUES(cargo_id),
            content = VALUES(content),
            embed_habilitado = VALUES(embed_habilitado),
            embed_titulo = VALUES(embed_titulo),
            embed_descricao = VALUES(embed_descricao),
            embed_cor = VALUES(embed_cor),
            footer_habilitado = VALUES(footer_habilitado),
            footer_texto = VALUES(footer_texto),
            imagem = VALUES(imagem),
            thumbnail = VALUES(thumbnail),
            atualizado_em =
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        `,
        [
            guildId,
            mensagemId,
            emojiNormalizado,
            cargoId,

            config.content || null,

            config.embed_habilitado !== false,
            config.embed_titulo || null,
            config.embed_descricao || null,
            config.embed_cor || null,

            config.footer_habilitado === true,
            config.footer_texto || null,

            config.imagem || null,
            config.thumbnail || null
        ]
    );
}

// =====================================================
// 🧹 SINCRONIZAR CONFIGURAÇÃO NOS CARGOS
// =====================================================

async function sincronizarCargos(
    guildId,
    mensagemId,
    config
) {
    await mysqlPool.query(
        `
        UPDATE react_roles
        SET
            content = ?,
            embed_habilitado = ?,
            embed_titulo = ?,
            embed_descricao = ?,
            embed_cor = ?,
            footer_habilitado = ?,
            footer_texto = ?,
            imagem = ?,
            thumbnail = ?,
            atualizado_em =
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
        WHERE guild_id = ?
          AND mensagem_id = ?
        `,
        [
            config.content || null,

            config.embed_habilitado !== false,
            config.embed_titulo || null,
            config.embed_descricao || null,
            config.embed_cor || null,

            config.footer_habilitado === true,
            config.footer_texto || null,

            config.imagem || null,
            config.thumbnail || null,

            guildId,
            mensagemId
        ]
    );
}

// =====================================================
// 🗑️ REMOVER CARGO
// =====================================================

async function removerCargo(
    guildId,
    mensagemId,
    emoji
) {
    const emojiNormalizado =
        normalizarEmoji(emoji);

    const [resultado] =
        await mysqlPool.query(
            `
            DELETE FROM react_roles
            WHERE guild_id = ?
              AND mensagem_id = ?
              AND emoji = ?
            `,
            [
                guildId,
                mensagemId,
                emojiNormalizado
            ]
        );

    return resultado.affectedRows > 0;
}

// =====================================================
// 🎨 CRIAR EMBED
// =====================================================

function criarEmbed(config) {
    if (config.embed_habilitado === false) {
        return null;
    }

    if (
        !config.embed_titulo &&
        !config.embed_descricao &&
        !config.embed_cor &&
        !config.footer_texto &&
        !config.imagem &&
        !config.thumbnail
    ) {
        return null;
    }

    const embed = new EmbedBuilder();

    if (config.embed_titulo) {
        embed.setTitle(
            config.embed_titulo
        );
    }

    if (config.embed_descricao) {
        embed.setDescription(
            config.embed_descricao
        );
    }

    if (config.embed_cor) {
        embed.setColor(
            config.embed_cor
        );
    }

    if (
        config.footer_habilitado &&
        config.footer_texto
    ) {
        embed.setFooter({
            text: config.footer_texto
        });
    }

    if (config.imagem) {
        embed.setImage(
            config.imagem
        );
    }

    if (config.thumbnail) {
        embed.setThumbnail(
            config.thumbnail
        );
    }

    return embed;
}

// =====================================================
// 📨 APLICAR CONFIG NA MENSAGEM
// =====================================================

async function aplicarMensagem(
    mensagem,
    config
) {
    const embed =
        criarEmbed(config);

    const dados = {
        content:
            config.content || null,
        embeds:
            embed ? [embed] : []
    };

    await mensagem.edit(dados);
}

// =====================================================
// 📋 PAINEL
// =====================================================

async function criarPainel(
    config,
    cargos = [],
    modo = "configurar"
) {
    const embed =
        new EmbedBuilder()
            .setTitle(
                modo === "editar"
                    ? "✏️ EDITAR REACTION ROLE"
                    : "🎭 CONFIGURAÇÃO DO REACTION ROLE"
            )
            .setColor(
                config.embed_cor ||
                "#00A8FF"
            )
            .setDescription(
                [
                    `📢 **Canal:** ${
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "Não configurado"
                    }`,

                    `📨 **Mensagem:** ${
                        config.mensagem_id
                            ? `\`${config.mensagem_id}\``
                            : "Ainda não enviada"
                    }`,

                    `🎭 **Cargos:** ${
                        cargos.length
                    } configurado(s)`,

                    `🎨 **Embed:** ${
                        config.embed_habilitado !== false
                            ? "Ativado"
                            : "Desativado"
                    }`,

                    `🟢 **Sistema:** ${
                        config.habilitado !== false
                            ? "Ativado"
                            : "Desativado"
                    }`
                ].join("\n")
            );

    if (cargos.length) {
        embed.addFields({
            name: "🎭 Cargos configurados",
            value: cargos
                .map(
                    cargo =>
                        `${cargo.emoji} → <@&${cargo.cargo_id}>`
                )
                .join("\n")
                .slice(0, 1024)
        });
    }

    const canalRow =
        new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId(
                    `rr_canal_${config.id}`
                )
                .setPlaceholder(
                    "📢 Selecionar canal"
                )
                .setChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setMinValues(1)
                .setMaxValues(1)
        );

    const row1 =
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `rr_mensagem_${config.id}`
                )
                .setLabel("Mensagem")
                .setEmoji("📨")
                .setStyle(
                    ButtonStyle.Primary
                ),

            new ButtonBuilder()
                .setCustomId(
                    `rr_cargos_${config.id}`
                )
                .setLabel("Cargos")
                .setEmoji("🎭")
                .setStyle(
                    ButtonStyle.Primary
                ),

            new ButtonBuilder()
                .setCustomId(
                    `rr_embed_${config.id}`
                )
                .setLabel("Embed")
                .setEmoji("🎨")
                .setStyle(
                    ButtonStyle.Primary
                )
        );

    const row2 =
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `rr_imagens_${config.id}`
                )
                .setLabel("Imagens")
                .setEmoji("🖼️")
                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()
                .setCustomId(
                    `rr_rodape_${config.id}`
                )
                .setLabel("Rodapé")
                .setEmoji("📌")
                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()
                .setCustomId(
                    `rr_enviar_${config.id}`
                )
                .setLabel(
                    modo === "editar"
                        ? "Salvar"
                        : "Enviar"
                )
                .setEmoji(
                    modo === "editar"
                        ? "💾"
                        : "📤"
                )
                .setStyle(
                    ButtonStyle.Success
                )
        );

    const row3 =
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `rr_ativar_${config.id}`
                )
                .setLabel("Ativar")
                .setEmoji("🟢")
                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()
                .setCustomId(
                    `rr_desativar_${config.id}`
                )
                .setLabel("Desativar")
                .setEmoji("🔴")
                .setStyle(
                    ButtonStyle.Danger
                ),

            new ButtonBuilder()
                .setCustomId(
                    `rr_testar_${config.id}`
                )
                .setLabel("Testar")
                .setEmoji("🧪")
                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()
                .setCustomId(
                    `rr_fechar_${config.id}`
                )
                .setLabel("Fechar")
                .setEmoji("❌")
                .setStyle(
                    ButtonStyle.Danger
                )
        );

    return {
        embeds: [embed],
        components: [
            canalRow,
            row1,
            row2,
            row3
        ]
    };
}

// =====================================================
// 📨 MODAL MENSAGEM
// =====================================================

function modalMensagem(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_mensagem_${config.id}`
            )
            .setTitle(
                "📨 Mensagem"
            );

    const content =
        new TextInputBuilder()
            .setCustomId(
                "content"
            )
            .setLabel(
                "Conteúdo da mensagem"
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setPlaceholder(
                "Texto que aparecerá acima do Embed..."
            )
            .setValue(
                config.content || ""
            );

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            content
        )
    );

    return modal;
}

// =====================================================
// 🎨 MODAL EMBED
// =====================================================

function modalEmbed(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_embed_${config.id}`
            )
            .setTitle(
                "🎨 Configuração do Embed"
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
            .setRequired(false)
            .setValue(
                config.embed_titulo || ""
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
            .setRequired(false)
            .setValue(
                config.embed_descricao || ""
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
            .setRequired(false)
            .setPlaceholder(
                "#00A8FF"
            )
            .setValue(
                config.embed_cor || ""
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
        )
    );

    return modal;
}

// =====================================================
// 🖼️ MODAL IMAGENS
// =====================================================

function modalImagens(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_imagens_${config.id}`
            )
            .setTitle(
                "🖼️ Imagens"
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
            .setRequired(false)
            .setValue(
                config.imagem || ""
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
            .setRequired(false)
            .setValue(
                config.thumbnail || ""
            );

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            imagem
        ),
        new ActionRowBuilder().addComponents(
            thumbnail
        )
    );

    return modal;
}

// =====================================================
// 📌 MODAL RODAPÉ
// =====================================================

function modalRodape(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_rodape_${config.id}`
            )
            .setTitle(
                "📌 Rodapé"
            );

    const rodape =
        new TextInputBuilder()
            .setCustomId(
                "rodape"
            )
            .setLabel(
                "Texto do rodapé"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                config.footer_texto || ""
            );

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            rodape
        )
    );

    return modal;
}

// =====================================================
// 🎭 MODAL CARGO
// =====================================================

function modalCargo(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `rr_modal_cargo_${config.id}`
            )
            .setTitle(
                "🎭 Adicionar Cargo"
            );

    const emoji =
        new TextInputBuilder()
            .setCustomId(
                "emoji"
            )
            .setLabel(
                "Emoji"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setPlaceholder(
                "😀 ou <:nome:123456789>"
            );

    const cargo =
        new TextInputBuilder()
            .setCustomId(
                "cargo"
            )
            .setLabel(
                "ID do cargo"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setPlaceholder(
                "123456789012345678"
            );

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            emoji
        ),
        new ActionRowBuilder().addComponents(
            cargo
        )
    );

    return modal;
}

// =====================================================
// 📨 ENVIAR / EDITAR MENSAGEM
// =====================================================

async function enviarOuEditar(
    interaction,
    config
) {
    if (!config.canal_id) {
        return {
            erro:
                "❌ Primeiro selecione o canal onde a mensagem será enviada."
        };
    }

    const canal =
        await interaction.guild.channels.fetch(
            config.canal_id
        );

    if (!canal || !canal.isTextBased()) {
        return {
            erro:
                "❌ O canal configurado não é válido."
        };
    }

    let mensagem;

    // =================================================
    // ✏️ EDITAR
    // =================================================

    if (config.mensagem_id) {
        try {
            mensagem =
                await canal.messages.fetch(
                    config.mensagem_id
                );
        } catch {
            return {
                erro:
                    "❌ Não consegui encontrar a mensagem configurada nesse canal."
            };
        }

        await aplicarMensagem(
            mensagem,
            config
        );
    }

    // =================================================
    // 📤 NOVA MENSAGEM
    // =================================================

    else {
        const embed =
            criarEmbed(config);

        mensagem =
            await canal.send({
                content:
                    config.content || null,
                embeds:
                    embed
                        ? [embed]
                        : []
            });

        await mysqlPool.query(
            `
            UPDATE react_role_configs
            SET
                mensagem_id = ?,
                atualizado_em =
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            WHERE id = ?
              AND guild_id = ?
            `,
            [
                mensagem.id,
                config.id,
                interaction.guild.id
            ]
        );

        config.mensagem_id =
            mensagem.id;
    }

    // =================================================
    // 🎭 ADICIONAR REAÇÕES
    // =================================================

    const cargos =
        await buscarCargos(
            interaction.guild.id,
            config.mensagem_id
        );

    for (const item of cargos) {
        try {
            await mensagem.react(
                item.emoji
            );
        } catch (erro) {
            console.error(
                `❌ Não consegui adicionar o emoji ${item.emoji}:`,
                erro
            );
        }
    }

    await sincronizarCargos(
        interaction.guild.id,
        config.mensagem_id,
        config
    );

    return {
        mensagem
    };
}

// =====================================================
// 🎭 PROCESSAR REAÇÃO
// =====================================================

async function handleReaction(
    reaction,
    user,
    adicionar
) {
    try {
        if (!reaction.guild) return;
        if (user.bot) return;

        if (reaction.partial) {
            await reaction.fetch();
        }

        const guildId =
            reaction.guild.id;

        const mensagemId =
            reaction.message.id;

        const emoji =
            normalizarEmoji(
                reaction.emoji
            );

        const config =
            await buscarConfigMensagem(
                guildId,
                mensagemId
            );

        if (
            !config ||
            config.habilitado === false
        ) {
            return;
        }

        const [rows] =
            await mysqlPool.query(
                `
                SELECT *
                FROM react_roles
                WHERE guild_id = ?
                  AND mensagem_id = ?
                  AND emoji = ?
                LIMIT 1
                `,
                [
                    guildId,
                    mensagemId,
                    emoji
                ]
            );

        if (!rows.length) {
            return;
        }

        const cargoId =
            rows[0].cargo_id;

        const membro =
            await reaction.guild.members.fetch(
                user.id
            );

        const cargo =
            await reaction.guild.roles.fetch(
                cargoId
            );

        if (!cargo) {
            console.error(
                `❌ Cargo ${cargoId} não encontrado.`
            );
            return;
        }

        if (!cargo.editable) {
            console.error(
                `❌ Não posso gerenciar o cargo ${cargo.name}.`
            );
            return;
        }

        if (adicionar) {
            if (
                !membro.roles.cache.has(
                    cargo.id
                )
            ) {
                await membro.roles.add(
                    cargo,
                    "Reaction Role"
                );

                console.log(
                    `🎭 Cargo ${cargo.name} dado para ${user.tag}.`
                );
            }
        } else {
            if (
                membro.roles.cache.has(
                    cargo.id
                )
            ) {
                await membro.roles.remove(
                    cargo,
                    "Reaction Role"
                );

                console.log(
                    `🎭 Cargo ${cargo.name} removido de ${user.tag}.`
                );
            }
        }

    } catch (erro) {
        console.error(
            "❌ Erro ao processar Reaction Role:",
            erro
        );
    }
}

// =====================================================
// 🖱️ TRATAR INTERAÇÕES DO PAINEL
// =====================================================

async function tratarInteracao(
    interaction
) {
    if (
        !interaction.isButton() &&
        !interaction.isModalSubmit() &&
        !interaction.isChannelSelectMenu()
    ) {
        return false;
    }

    const customId =
        interaction.customId;

    if (
        !customId.startsWith("rr_")
    ) {
        return false;
    }

    // =================================================
    // 🔐 SEGURANÇA
    // =================================================

    if (
        !interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        await interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor**.",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    const partes =
        customId.split("_");

    const acao =
        partes[1];

    const configId =
        partes[partes.length - 1];

    const config =
        await buscarConfig(
            configId,
            interaction.guild.id
        );

    if (!config) {
        await interaction.reply({
            content:
                "❌ Essa configuração não existe mais.",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // =================================================
    // 📢 CANAL
    // =================================================

    if (
        interaction.isChannelSelectMenu() &&
        acao === "canal"
    ) {
        const canalId =
            interaction.values[0];

        await mysqlPool.query(
            `
            UPDATE react_role_configs
            SET
                canal_id = ?,
                atualizado_em =
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            WHERE id = ?
              AND guild_id = ?
            `,
            [
                canalId,
                config.id,
                interaction.guild.id
            ]
        );

        config.canal_id =
            canalId;

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                config.mensagem_id
            );

        const painel =
            await criarPainel(
                config,
                cargos
            );

        await interaction.update(
            painel
        );

        return true;
    }

    // =================================================
    // 📨 MENSAGEM
    // =================================================

    if (
        interaction.isButton() &&
        acao === "mensagem"
    ) {
        await interaction.showModal(
            modalMensagem(config)
        );

        return true;
    }

    // =================================================
    // 🎨 EMBED
    // =================================================

    if (
        interaction.isButton() &&
        acao === "embed"
    ) {
        await interaction.showModal(
            modalEmbed(config)
        );

        return true;
    }

    // =================================================
    // 🖼️ IMAGENS
    // =================================================

    if (
        interaction.isButton() &&
        acao === "imagens"
    ) {
        await interaction.showModal(
            modalImagens(config)
        );

        return true;
    }

    // =================================================
    // 📌 RODAPÉ
    // =================================================

    if (
        interaction.isButton() &&
        acao === "rodape"
    ) {
        await interaction.showModal(
            modalRodape(config)
        );

        return true;
    }

    // =================================================
    // 🎭 CARGOS
    // =================================================

    if (
        interaction.isButton() &&
        acao === "cargos"
    ) {
        if (!config.mensagem_id) {
            await interaction.reply({
                content:
                    "❌ Primeiro envie a mensagem pelo botão **📤 Enviar**. Depois você poderá adicionar os cargos.",
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.showModal(
            modalCargo(config)
        );

        return true;
    }

    // =================================================
    // 🟢 ATIVAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "ativar"
    ) {
        await mysqlPool.query(
            `
            UPDATE react_role_configs
            SET
                habilitado = TRUE,
                atualizado_em =
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            WHERE id = ?
              AND guild_id = ?
            `,
            [
                config.id,
                interaction.guild.id
            ]
        );

        config.habilitado = 1;

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                config.mensagem_id
            );

        const painel =
            await criarPainel(
                config,
                cargos
            );

        await interaction.update(
            painel
        );

        return true;
    }

    // =================================================
    // 🔴 DESATIVAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "desativar"
    ) {
        await mysqlPool.query(
            `
            UPDATE react_role_configs
            SET
                habilitado = FALSE,
                atualizado_em =
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            WHERE id = ?
              AND guild_id = ?
            `,
            [
                config.id,
                interaction.guild.id
            ]
        );

        config.habilitado = 0;

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                config.mensagem_id
            );

        const painel =
            await criarPainel(
                config,
                cargos
            );

        await interaction.update(
            painel
        );

        return true;
    }

    // =================================================
    // 🧪 TESTAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "testar"
    ) {
        if (!config.mensagem_id) {
            await interaction.reply({
                content:
                    "❌ Ainda não existe uma mensagem para testar.",
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        try {
            const canal =
                await interaction.guild.channels.fetch(
                    config.canal_id
                );

            const mensagem =
                await canal.messages.fetch(
                    config.mensagem_id
                );

            await aplicarMensagem(
                mensagem,
                config
            );

            await interaction.reply({
                content:
                    "🧪 **Reaction Role testado com sucesso!**",
                flags:
                    MessageFlags.Ephemeral
            });

        } catch (erro) {
            console.error(
                "❌ Erro ao testar Reaction Role:",
                erro
            );

            await interaction.reply({
                content:
                    "❌ Não consegui testar o Reaction Role.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    // =================================================
    // 📤 ENVIAR / 💾 SALVAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "enviar"
    ) {
        try {
            const resultado =
                await enviarOuEditar(
                    interaction,
                    config
                );

            if (resultado.erro) {
                await interaction.reply({
                    content:
                        resultado.erro,
                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const novaConfig =
                await buscarConfig(
                    config.id,
                    interaction.guild.id
                );

            const cargos =
                await buscarCargos(
                    interaction.guild.id,
                    novaConfig.mensagem_id
                );

            const painel =
                await criarPainel(
                    novaConfig,
                    cargos,
                    novaConfig.mensagem_id
                        ? "editar"
                        : "configurar"
                );

            await interaction.update(
                painel
            );

        } catch (erro) {
            console.error(
                "❌ Erro ao enviar/editar Reaction Role:",
                erro
            );

            await interaction.reply({
                content:
                    "❌ Não consegui salvar o Reaction Role.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    // =================================================
    // ❌ FECHAR
    // =================================================

    if (
        interaction.isButton() &&
        acao === "fechar"
    ) {
        await interaction.update({
            content:
                "✅ Painel fechado.",
            embeds: [],
            components: []
        });

        return true;
    }

    // =================================================
    // 📝 MODAL MENSAGEM
    // =================================================

    if (
        interaction.isModalSubmit() &&
        acao === "modal"
    ) {
        const tipo =
            partes[2];

        // =============================================
        // 📨 MENSAGEM
        // =============================================

        if (tipo === "mensagem") {
            const content =
                interaction.fields.getTextInputValue(
                    "content"
                );

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    content = ?,
                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    content || null,
                    config.id,
                    interaction.guild.id
                ]
            );
        }

        // =============================================
        // 🎨 EMBED
        // =============================================

        if (tipo === "embed") {
            const titulo =
                interaction.fields.getTextInputValue(
                    "titulo"
                );

            const descricao =
                interaction.fields.getTextInputValue(
                    "descricao"
                );

            const corInformada =
                interaction.fields.getTextInputValue(
                    "cor"
                );

            const cor =
                normalizarCor(
                    corInformada
                );

            if (
                corInformada &&
                !cor
            ) {
                await interaction.reply({
                    content:
                        "❌ Cor inválida. Use algo como `#00A8FF`.",
                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    embed_titulo = ?,
                    embed_descricao = ?,
                    embed_cor = ?,
                    embed_habilitado = TRUE,
                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    titulo || null,
                    descricao || null,
                    cor,
                    config.id,
                    interaction.guild.id
                ]
            );
        }

        // =============================================
        // 🖼️ IMAGENS
        // =============================================

        if (tipo === "imagens") {
            const imagem =
                interaction.fields.getTextInputValue(
                    "imagem"
                );

            const thumbnail =
                interaction.fields.getTextInputValue(
                    "thumbnail"
                );

            if (
                !urlValida(imagem) ||
                !urlValida(thumbnail)
            ) {
                await interaction.reply({
                    content:
                        "❌ Uma das URLs informadas é inválida.",
                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    imagem = ?,
                    thumbnail = ?,
                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    imagem || null,
                    thumbnail || null,
                    config.id,
                    interaction.guild.id
                ]
            );
        }

        // =============================================
        // 📌 RODAPÉ
        // =============================================

        if (tipo === "rodape") {
            const rodape =
                interaction.fields.getTextInputValue(
                    "rodape"
                );

            await mysqlPool.query(
                `
                UPDATE react_role_configs
                SET
                    footer_texto = ?,
                    footer_habilitado = ?,
                    atualizado_em =
                        UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                WHERE id = ?
                  AND guild_id = ?
                `,
                [
                    rodape || null,
                    rodape ? true : false,
                    config.id,
                    interaction.guild.id
                ]
            );
        }

        // =============================================
        // 🎭 CARGO
        // =============================================

        if (tipo === "cargo") {
            if (!config.mensagem_id) {
                await interaction.reply({
                    content:
                        "❌ Envie a mensagem primeiro.",
                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const emoji =
                interaction.fields.getTextInputValue(
                    "emoji"
                );

            const cargoId =
                interaction.fields.getTextInputValue(
                    "cargo"
                );

            const cargo =
                await interaction.guild.roles.fetch(
                    cargoId
                );

            if (!cargo) {
                await interaction.reply({
                    content:
                        "❌ Não encontrei esse cargo.",
                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (!cargo.editable) {
                await interaction.reply({
                    content:
                        "❌ Não consigo gerenciar esse cargo. Coloque meu cargo acima dele.",
                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            try {
                const canal =
                    await interaction.guild.channels.fetch(
                        config.canal_id
                    );

                const mensagem =
                    await canal.messages.fetch(
                        config.mensagem_id
                    );

                await mensagem.react(
                    emoji
                );

                await salvarCargo({
                    guildId:
                        interaction.guild.id,
                    mensagemId:
                        config.mensagem_id,
                    emoji,
                    cargoId:
                        cargo.id,
                    config
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao adicionar cargo:",
                    erro
                );

                await interaction.reply({
                    content:
                        "❌ Não consegui adicionar essa reação à mensagem.",
                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }
        }

        const novaConfig =
            await buscarConfig(
                config.id,
                interaction.guild.id
            );

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                novaConfig.mensagem_id
            );

        const painel =
            await criarPainel(
                novaConfig,
                cargos
            );

        await interaction.reply({
            ...painel,
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    return true;
}

// =====================================================
// ▶️ EXECUTE
// =====================================================

async function execute(interaction) {
    if (
        !interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const subcomando =
        interaction.options.getSubcommand();

    // =================================================
    // ⚙️ CONFIGURAR
    // =================================================

    if (
        subcomando === "configurar"
    ) {
        try {
            const configId =
                await criarConfig(
                    interaction.guild.id
                );

            const config =
                await buscarConfig(
                    configId,
                    interaction.guild.id
                );

            const painel =
                await criarPainel(
                    config,
                    []
                );

            return interaction.reply({
                ...painel,
                flags:
                    MessageFlags.Ephemeral
            });

        } catch (erro) {
            console.error(
                "❌ Erro ao abrir configuração:",
                erro
            );

            return interaction.reply({
                content:
                    "❌ Não consegui abrir a configuração do Reaction Role.",
                flags:
                    MessageFlags.Ephemeral
            });
        }
    }

    // =================================================
    // ✏️ EDITAR
    // =================================================

    if (
        subcomando === "editar"
    ) {
        const modal =
            new ModalBuilder()
                .setCustomId(
                    "rr_modal_editar"
                )
                .setTitle(
                    "✏️ Editar Reaction Role"
                );

        const mensagem =
            new TextInputBuilder()
                .setCustomId(
                    "mensagem"
                )
                .setLabel(
                    "ID da mensagem"
                )
                .setStyle(
                    TextInputStyle.Short
                )
                .setRequired(true)
                .setPlaceholder(
                    "123456789012345678"
                );

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                mensagem
            )
        );

        return interaction.showModal(
            modal
        );
    }

    // =================================================
    // 📋 STATUS
    // =================================================

    if (
        subcomando === "status"
    ) {
        const mensagemId =
            interaction.options.getString(
                "mensagem"
            );

        const config =
            await buscarConfigMensagem(
                interaction.guild.id,
                mensagemId
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Não encontrei esse Reaction Role.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const cargos =
            await buscarCargos(
                interaction.guild.id,
                mensagemId
            );

        return interaction.reply({
            content:
                [
                    "📋 **STATUS DO REACTION ROLE**",
                    "",
                    `📢 Canal: ${
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "Não configurado"
                    }`,
                    `📨 Mensagem: \`${mensagemId}\``,
                    `🎭 Cargos: **${cargos.length}**`,
                    `🎨 Embed: ${
                        config.embed_habilitado
                            ? "Ativado"
                            : "Desativado"
                    }`,
                    `🟢 Sistema: ${
                        config.habilitado
                            ? "Ativado"
                            : "Desativado"
                    }`
                ].join("\n"),
            flags:
                MessageFlags.Ephemeral
        });
    }

    // =================================================
    // 🧪 TESTE
    // =================================================

    if (
        subcomando === "teste"
    ) {
        return interaction.reply({
            content:
                "🧪 Use **/reactrole editar** para abrir a configuração de uma mensagem existente e testar pelo painel.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    // =================================================
    // 🟢 ATIVAR / 🔴 DESATIVAR
    // =================================================

    if (
        subcomando === "ativar" ||
        subcomando === "desativar"
    ) {
        return interaction.reply({
            content:
                `ℹ️ Use **/reactrole editar** para abrir o painel e ativar/desativar o sistema.`,
            flags:
                MessageFlags.Ephemeral
        });
    }
}

// =====================================================
// 📝 MODAL ESPECIAL: EDITAR
// =====================================================

async function tratarModalEditar(
    interaction
) {
    if (
        interaction.customId !==
        "rr_modal_editar"
    ) {
        return false;
    }

    if (
        !interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        await interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor**.",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    const mensagemId =
        interaction.fields.getTextInputValue(
            "mensagem"
        ).trim();

    const config =
        await buscarConfigMensagem(
            interaction.guild.id,
            mensagemId
        );

    if (!config) {
        await interaction.reply({
            content:
                "❌ Não encontrei nenhum Reaction Role configurado para essa mensagem.",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    const cargos =
        await buscarCargos(
            interaction.guild.id,
            mensagemId
        );

    const painel =
        await criarPainel(
            config,
            cargos,
            "editar"
        );

    await interaction.reply({
        ...painel,
        flags:
            MessageFlags.Ephemeral
    });

    return true;
}

// =====================================================
// 📦 EXPORT
// =====================================================

module.exports = {
    data,
    execute,
    handleReaction,
    tratarInteracao,
    tratarModalEditar
};
