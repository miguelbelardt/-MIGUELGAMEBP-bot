const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const { pool } = require("../database/database.js");

// ================================
// 🎫 BANCO DE TICKETS
// ================================

async function inicializarTickets() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ticket_modelos (
            id BIGSERIAL PRIMARY KEY,
            guild_id VARCHAR(30) NOT NULL,
            nome VARCHAR(100) NOT NULL,

            autor_nome VARCHAR(256),
            autor_icone TEXT,

            titulo VARCHAR(256),
            descricao TEXT,

            cor VARCHAR(20),

            imagem TEXT,
            thumbnail TEXT,

            rodape VARCHAR(2048),
            rodape_icone TEXT,

            botao_texto VARCHAR(80) NOT NULL DEFAULT 'Fazer Ticket',
            botao_emoji VARCHAR(100),
            botao_estilo VARCHAR(20) NOT NULL DEFAULT 'Primary',

            criado_em BIGINT NOT NULL DEFAULT (
                EXTRACT(EPOCH FROM NOW()) * 1000
            )
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ticket_config (
            guild_id VARCHAR(30) PRIMARY KEY,
            modelo_id BIGINT,

            canal_painel_id VARCHAR(30),

            configurado BOOLEAN NOT NULL DEFAULT FALSE,

            FOREIGN KEY (modelo_id)
            REFERENCES ticket_modelos(id)
            ON DELETE SET NULL
        )
    `);
}

// ================================
// 🎨 EMBED
// ================================

function criarEmbedTicket(modelo) {

    const embed = new EmbedBuilder();

    if (modelo.cor) {
        embed.setColor(modelo.cor);
    } else {
        embed.setColor(0x5865F2);
    }

    if (modelo.titulo) {
        embed.setTitle(modelo.titulo);
    }

    if (modelo.descricao) {
        embed.setDescription(modelo.descricao);
    }

    if (modelo.autor_nome) {

        embed.setAuthor({
            name: modelo.autor_nome,
            ...(modelo.autor_icone
                ? {
                    iconURL: modelo.autor_icone
                }
                : {})
        });
    }

    if (modelo.imagem) {
        embed.setImage(modelo.imagem);
    }

    if (modelo.thumbnail) {
        embed.setThumbnail(modelo.thumbnail);
    }

    if (modelo.rodape) {

        embed.setFooter({
            text: modelo.rodape,
            ...(modelo.rodape_icone
                ? {
                    iconURL: modelo.rodape_icone
                }
                : {})
        });
    }

    return embed;
}

// ================================
// 🔘 BOTÃO DO TICKET
// ================================

function criarBotaoTicket(
    modelo,
    disabled = false
) {

    let estilo = ButtonStyle.Primary;

    if (modelo.botao_estilo === "Secondary") {
        estilo = ButtonStyle.Secondary;
    }

    if (modelo.botao_estilo === "Success") {
        estilo = ButtonStyle.Success;
    }

    if (modelo.botao_estilo === "Danger") {
        estilo = ButtonStyle.Danger;
    }

    if (modelo.botao_estilo === "Link") {
        estilo = ButtonStyle.Link;
    }

    const botao = new ButtonBuilder()
        .setLabel(
            modelo.botao_texto ||
            "Fazer Ticket"
        )
        .setStyle(estilo)
        .setDisabled(disabled);

    // Botões Link não usam customId
    if (estilo !== ButtonStyle.Link) {
        botao.setCustomId(
            `ticket_abrir_${modelo.id}`
        );
    }

    if (
        modelo.botao_emoji &&
        estilo !== ButtonStyle.Link
    ) {
        botao.setEmoji(
            modelo.botao_emoji
        );
    }

    return botao;
}

// ================================
// ⚙️ PAINEL PRINCIPAL
// ================================

function criarPainel(
    modelos,
    modeloSelecionado = null
) {

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎫 Configuração de Tickets")
        .setDescription(
            "Escolha uma opção abaixo para continuar."
        );

    if (modeloSelecionado) {

        embed.addFields({
            name: "🎯 Ticket selecionado",
            value:
                `**${modeloSelecionado.nome}**`
        });
    }

    const componentes = [];

    // ================================
    // 🎫 MENU PRINCIPAL
    // ================================

    const opcoes = [
        {
            label: "Criar ticket",
            value: "criar",
            description:
                "Criar um novo modelo de ticket",
            emoji: "➕"
        },
        {
            label: "Configurar ticket",
            value: "configurar",
            description:
                modelos.length > 0
                    ? "Escolher um modelo para configurar"
                    : "Nenhum modelo criado ainda",
            emoji: "⚙️"
        }
    ];

    // ================================
    // 🎫 MODELOS EXISTENTES
    // ================================

    if (modelos.length > 0) {

        modelos
            .slice(0, 23)
            .forEach(modelo => {

                opcoes.push({
                    label:
                        modelo.nome
                            .slice(0, 100),

                    value:
                        `modelo_${modelo.id}`,

                    description:
                        (
                            modelo.titulo ||
                            "Abrir este modelo"
                        ).slice(0, 100),

                    emoji: "🎫"
                });
            });
    }

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                "ticket_menu_principal"
            )
            .setPlaceholder(
                "🎫 Escolha uma opção"
            )
            .addOptions(opcoes);

    componentes.push(
        new ActionRowBuilder()
            .addComponents(menu)
    );

    // ================================
    // 🔄 ATUALIZAR
    // ================================

    componentes.push(
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "ticket_atualizar"
                    )
                    .setLabel("Atualizar")
                    .setEmoji("🔄")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    );

    return {
        embeds: [embed],
        components: componentes,
        ephemeral: true
    };
}

// ================================
// 📋 PAINEL DE CONFIGURAÇÃO
// ================================

function criarPainelConfiguracao(
    modelos
) {

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(
                "⚙️ Configurar ticket"
            )
            .setDescription(
                modelos.length > 0
                    ? "Escolha o modelo que deseja configurar."
                    : "❌ Você ainda não possui nenhum modelo de ticket."
            );

    const componentes = [];

    if (modelos.length > 0) {

        const menu =
            new StringSelectMenuBuilder()
                .setCustomId(
                    "ticket_configurar_modelo"
                )
                .setPlaceholder(
                    "⚙️ Escolha o modelo"
                )
                .addOptions(
                    modelos
                        .slice(0, 25)
                        .map(modelo => ({
                            label:
                                modelo.nome
                                    .slice(0, 100),

                            value:
                                String(
                                    modelo.id
                                ),

                            description:
                                (
                                    modelo.titulo ||
                                    "Sem título definido"
                                ).slice(0, 100),

                            emoji: "🎫"
                        }))
                );

        componentes.push(
            new ActionRowBuilder()
                .addComponents(menu)
        );
    }

    return {
        embeds: [embed],
        components: componentes,
        ephemeral: true
    };
}

// ================================
// 📝 MODAL DE CRIAÇÃO
// ================================

function criarModalTicket() {

    const modal =
        new ModalBuilder()
            .setCustomId(
                "ticket_modal_criar"
            )
            .setTitle(
                "🎫 Criar ticket"
            );

    const nome =
        new TextInputBuilder()
            .setCustomId("nome")
            .setLabel("Nome do ticket")
            .setPlaceholder(
                "Ex: Suporte"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(100);

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título do embed")
            .setPlaceholder(
                "Ex: 🎫 Atendimento"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(256);

    const descricao =
        new TextInputBuilder()
            .setCustomId("descricao")
            .setLabel("Descrição")
            .setPlaceholder(
                "Explique para que serve este ticket."
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setMaxLength(4000);

    const autor =
        new TextInputBuilder()
            .setCustomId("autor")
            .setLabel("Autor do embed")
            .setPlaceholder(
                "Ex: MIGUELGAMEBP"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(256);

    const cor =
        new TextInputBuilder()
            .setCustomId("cor")
            .setLabel("Cor hexadecimal")
            .setPlaceholder(
                "Ex: #5865F2"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(nome),

        new ActionRowBuilder()
            .addComponents(titulo),

        new ActionRowBuilder()
            .addComponents(descricao),

        new ActionRowBuilder()
            .addComponents(autor),

        new ActionRowBuilder()
            .addComponents(cor)
    );

    return modal;
}

// ================================
// 🎨 MODAL DE PERSONALIZAÇÃO
// ================================

function criarModalPersonalizacao(
    modelo
) {

    const modal =
        new ModalBuilder()
            .setCustomId(
                `ticket_modal_editar_${modelo.id}`
            )
            .setTitle(
                "🎨 Personalizar ticket"
            );

    const imagem =
        new TextInputBuilder()
            .setCustomId("imagem")
            .setLabel("URL da imagem")
            .setPlaceholder(
                "https://..."
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                modelo.imagem || ""
            )
            .setMaxLength(1000);

    const thumbnail =
        new TextInputBuilder()
            .setCustomId("thumbnail")
            .setLabel("URL da thumbnail")
            .setPlaceholder(
                "https://..."
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                modelo.thumbnail || ""
            )
            .setMaxLength(1000);

    const rodape =
        new TextInputBuilder()
            .setCustomId("rodape")
            .setLabel("Rodapé")
            .setPlaceholder(
                "Texto do rodapé"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                modelo.rodape || ""
            )
            .setMaxLength(2048);

    const botao =
        new TextInputBuilder()
            .setCustomId("botao")
            .setLabel("Texto do botão")
            .setPlaceholder(
                "Ex: Fazer Ticket"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
                modelo.botao_texto ||
                "Fazer Ticket"
            )
            .setMaxLength(80);

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji do botão")
            .setPlaceholder("🎫")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                modelo.botao_emoji || ""
            )
            .setMaxLength(100);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(imagem),

        new ActionRowBuilder()
            .addComponents(thumbnail),

        new ActionRowBuilder()
            .addComponents(rodape),

        new ActionRowBuilder()
            .addComponents(botao),

        new ActionRowBuilder()
            .addComponents(emoji)
    );

    return modal;
}

// ================================
// 🎯 PAINEL DO MODELO
// ================================

function criarPainelModelo(
    modelo
) {

    const embed =
        criarEmbedTicket(modelo)
            .setTitle(
                modelo.titulo ||
                "🎫 Prévia do Ticket"
            );

    const botoes =
        new ActionRowBuilder()
            .addComponents(

                criarBotaoTicket(
                    modelo,
                    true
                ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_personalizar_${modelo.id}`
                    )
                    .setLabel("Editar")
                    .setEmoji("✏️")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_confirmar_${modelo.id}`
                    )
                    .setLabel(
                        "Confirmar configuração"
                    )
                    .setEmoji("✅")
                    .setStyle(
                        ButtonStyle.Success
                    )
            );

    return {
        embeds: [embed],
        components: [
            botoes
        ],
        ephemeral: true
    };
}

// ================================
// 📋 COMANDO
// ================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("ticket")
            .setDescription(
                "Configura o sistema de tickets"
            ),

    async execute(
        interaction
    ) {

        try {

            await inicializarTickets();

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_modelos
                    WHERE guild_id = $1
                    ORDER BY id ASC
                    `,
                    [
                        interaction.guildId
                    ]
                );

            const modelos =
                resultado.rows;

            await interaction.reply(
                criarPainel(modelos)
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando /ticket:",
                erro
            );

            if (interaction.replied) {

                await interaction.editReply({
                    content:
                        "❌ Ocorreu um erro ao abrir a configuração de tickets.",
                    embeds: [],
                    components: []
                });

            } else {

                await interaction.reply({
                    content:
                        "❌ Ocorreu um erro ao abrir a configuração de tickets.",
                    ephemeral: true
                });
            }
        }
    },

    // ================================
    // 🔘 BOTÕES
    // ================================

    async handleButton(
        interaction
    ) {

        if (
            !interaction.customId
                .startsWith("ticket_")
        ) {
            return false;
        }

        await inicializarTickets();

        // ================================
        // 🔄 ATUALIZAR
        // ================================

        if (
            interaction.customId ===
            "ticket_atualizar"
        ) {

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_modelos
                    WHERE guild_id = $1
                    ORDER BY id ASC
                    `,
                    [
                        interaction.guildId
                    ]
                );

            await interaction.update(
                criarPainel(
                    resultado.rows
                )
            );

            return true;
        }

        // ================================
        // ✏️ PERSONALIZAR
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_personalizar_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_personalizar_",
                    ""
                );

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_modelos
                    WHERE id = $1
                    AND guild_id = $2
                    `,
                    [
                        id,
                        interaction.guildId
                    ]
                );

            if (
                !resultado.rows.length
            ) {

                await interaction.reply({
                    content:
                        "❌ Esse modelo de ticket não existe.",
                    ephemeral: true
                });

                return true;
            }

            await interaction.showModal(
                criarModalPersonalizacao(
                    resultado.rows[0]
                )
            );

            return true;
        }

        // ================================
        // ✅ CONFIRMAR
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_confirmar_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_confirmar_",
                    ""
                );

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_modelos
                    WHERE id = $1
                    AND guild_id = $2
                    `,
                    [
                        id,
                        interaction.guildId
                    ]
                );

            if (
                !resultado.rows.length
            ) {

                await interaction.reply({
                    content:
                        "❌ Esse modelo não existe.",
                    ephemeral: true
                });

                return true;
            }

            await pool.query(
                `
                INSERT INTO ticket_config (
                    guild_id,
                    modelo_id,
                    configurado
                )
                VALUES ($1, $2, TRUE)

                ON CONFLICT (guild_id)
                DO UPDATE SET
                    modelo_id = EXCLUDED.modelo_id,
                    configurado = TRUE
                `,
                [
                    interaction.guildId,
                    id
                ]
            );

            await interaction.update({
                content:
                    `✅ O ticket **${resultado.rows[0].nome}** foi definido como o ticket ativo!`,
                embeds: [],
                components: []
            });

            return true;
        }

        return false;
    },

    // ================================
    // 🔽 SELECT MENUS
    // ================================

    async handleSelectMenu(
        interaction
    ) {

        if (
            !interaction.customId.startsWith(
                "ticket_"
            )
        ) {
            return false;
        }

        await inicializarTickets();

        // ================================
        // 🎫 MENU PRINCIPAL
        // ================================

        if (
            interaction.customId ===
            "ticket_menu_principal"
        ) {

            const valor =
                interaction.values[0];

            // ================================
            // ➕ CRIAR
            // ================================

            if (valor === "criar") {

                await interaction.showModal(
                    criarModalTicket()
                );

                return true;
            }

            // ================================
            // ⚙️ CONFIGURAR
            // ================================

            if (
                valor === "configurar"
            ) {

                const resultado =
                    await pool.query(
                        `
                        SELECT *
                        FROM ticket_modelos
                        WHERE guild_id = $1
                        ORDER BY id ASC
                        `,
                        [
                            interaction.guildId
                        ]
                    );

                if (
                    !resultado.rows.length
                ) {

                    return interaction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    0xED4245
                                )
                                .setTitle(
                                    "⚙️ Configurar ticket"
                                )
                                .setDescription(
                                    "❌ Você ainda não criou nenhum modelo de ticket."
                                )
                        ],
                        components: []
                    });
                }

                return interaction.update(
                    criarPainelConfiguracao(
                        resultado.rows
                    )
                );
            }

            // ================================
            // 🎫 MODELO
            // ================================

            if (
                valor.startsWith(
                    "modelo_"
                )
            ) {

                const id =
                    valor.replace(
                        "modelo_",
                        ""
                    );

                const resultado =
                    await pool.query(
                        `
                        SELECT *
                        FROM ticket_modelos
                        WHERE id = $1
                        AND guild_id = $2
                        `,
                        [
                            id,
                            interaction.guildId
                        ]
                    );

                if (
                    !resultado.rows.length
                ) {

                    await interaction.reply({
                        content:
                            "❌ Esse modelo de ticket não existe.",
                        ephemeral: true
                    });

                    return true;
                }

                return interaction.update(
                    criarPainelModelo(
                        resultado.rows[0]
                    )
                );
            }
        }

        // ================================
        // ⚙️ ESCOLHER MODELO PARA CONFIGURAR
        // ================================

        if (
            interaction.customId ===
            "ticket_configurar_modelo"
        ) {

            const id =
                interaction.values[0];

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_modelos
                    WHERE id = $1
                    AND guild_id = $2
                    `,
                    [
                        id,
                        interaction.guildId
                    ]
                );

            if (
                !resultado.rows.length
            ) {

                await interaction.reply({
                    content:
                        "❌ Esse modelo de ticket não existe.",
                    ephemeral: true
                });

                return true;
            }

            return interaction.update(
                criarPainelModelo(
                    resultado.rows[0]
                )
            );
        }

        return false;
    },

    // ================================
    // 📝 MODAIS
    // ================================

    async handleModal(
        interaction
    ) {

        if (
            !interaction.customId.startsWith(
                "ticket_modal_"
            )
        ) {
            return false;
        }

        await inicializarTickets();

        // ================================
        // ➕ CRIAR MODELO
        // ================================

        if (
            interaction.customId ===
            "ticket_modal_criar"
        ) {

            let cor =
                interaction.fields
                    .getTextInputValue(
                        "cor"
                    )
                    .trim();

            if (
                cor &&
                !/^#[0-9A-Fa-f]{6}$/.test(
                    cor
                )
            ) {
                cor = "#5865F2";
            }

            if (!cor) {
                cor = "#5865F2";
            }

            const resultado =
                await pool.query(
                    `
                    INSERT INTO ticket_modelos (
                        guild_id,
                        nome,
                        autor_nome,
                        titulo,
                        descricao,
                        cor
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6
                    )
                    RETURNING *
                    `,
                    [
                        interaction.guildId,

                        interaction.fields
                            .getTextInputValue(
                                "nome"
                            )
                            .trim(),

                        interaction.fields
                            .getTextInputValue(
                                "autor"
                            )
                            .trim() ||
                            null,

                        interaction.fields
                            .getTextInputValue(
                                "titulo"
                            )
                            .trim() ||
                            null,

                        interaction.fields
                            .getTextInputValue(
                                "descricao"
                            )
                            .trim() ||
                            null,

                        cor
                    ]
                );

            const modelo =
                resultado.rows[0];

            await interaction.reply(
                criarPainelModelo(
                    modelo
                )
            );

            return true;
        }

        // ================================
        // ✏️ EDITAR PERSONALIZAÇÃO
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_modal_editar_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_modal_editar_",
                    ""
                );

            await pool.query(
                `
                UPDATE ticket_modelos
                SET
                    imagem = $1,
                    thumbnail = $2,
                    rodape = $3,
                    botao_texto = $4,
                    botao_emoji = $5
                WHERE id = $6
                AND guild_id = $7
                `,
                [
                    interaction.fields
                        .getTextInputValue(
                            "imagem"
                        )
                        .trim() ||
                        null,

                    interaction.fields
                        .getTextInputValue(
                            "thumbnail"
                        )
                        .trim() ||
                        null,

                    interaction.fields
                        .getTextInputValue(
                            "rodape"
                        )
                        .trim() ||
                        null,

                    interaction.fields
                        .getTextInputValue(
                            "botao"
                        )
                        .trim() ||
                        "Fazer Ticket",

                    interaction.fields
                        .getTextInputValue(
                            "emoji"
                        )
                        .trim() ||
                        null,

                    id,
                    interaction.guildId
                ]
            );

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_modelos
                    WHERE id = $1
                    AND guild_id = $2
                    `,
                    [
                        id,
                        interaction.guildId
                    ]
                );

            await interaction.reply(
                criarPainelModelo(
                    resultado.rows[0]
                )
            );

            return true;
        }

        return false;
    }
};
