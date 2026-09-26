const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits
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
            categoria_id VARCHAR(30),
            mensagem_painel_id VARCHAR(30),

            configurado BOOLEAN NOT NULL DEFAULT FALSE,

            FOREIGN KEY (modelo_id)
            REFERENCES ticket_modelos(id)
            ON DELETE SET NULL
        )
    `);

    // ================================
    // 🔧 GARANTIR COLUNAS NOVAS
    // ================================

    await pool.query(`
        ALTER TABLE ticket_config
        ADD COLUMN IF NOT EXISTS categoria_id VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE ticket_config
        ADD COLUMN IF NOT EXISTS mensagem_painel_id VARCHAR(30)
    `);
}

// ================================
// 🔗 VALIDAR URL
// ================================

function urlValida(url) {

    if (!url || typeof url !== "string") {
        return false;
    }

    try {

        const resultado = new URL(url);

        return (
            resultado.protocol === "http:" ||
            resultado.protocol === "https:"
        );

    } catch {

        return false;
    }
}

// ================================
// 🎨 EMBED DO TICKET
// ================================

function criarEmbedTicket(modelo) {

    const embed = new EmbedBuilder();

    if (
        modelo.cor &&
        /^#[0-9A-Fa-f]{6}$/.test(modelo.cor)
    ) {

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

        const autor = {
            name: modelo.autor_nome
        };

        if (
            modelo.autor_icone &&
            urlValida(modelo.autor_icone)
        ) {

            autor.iconURL =
                modelo.autor_icone;
        }

        embed.setAuthor(autor);
    }

    if (
        modelo.imagem &&
        urlValida(modelo.imagem)
    ) {

        embed.setImage(
            modelo.imagem
        );
    }

    if (
        modelo.thumbnail &&
        urlValida(modelo.thumbnail)
    ) {

        embed.setThumbnail(
            modelo.thumbnail
        );
    }

    if (modelo.rodape) {

        const rodape = {
            text: modelo.rodape
        };

        if (
            modelo.rodape_icone &&
            urlValida(modelo.rodape_icone)
        ) {

            rodape.iconURL =
                modelo.rodape_icone;
        }

        embed.setFooter(rodape);
    }

    return embed;
}

// ================================
// 🔘 BOTÃO DO PAINEL
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
// 🔒 BOTÃO FECHAR
// ================================

function criarBotaoFechar() {

    return new ButtonBuilder()
        .setCustomId(
            "ticket_fechar"
        )
        .setLabel("Fechar Ticket")
        .setEmoji("🔒")
        .setStyle(
            ButtonStyle.Danger
        );
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
// ✏️ MODAL EDITAR INFORMAÇÕES
// ================================

function criarModalEditarInformacoes(
    modelo
) {

    const modal =
        new ModalBuilder()
            .setCustomId(
                `ticket_modal_info_${modelo.id}`
            )
            .setTitle(
                "✏️ Editar ticket"
            );

    const nome =
        new TextInputBuilder()
            .setCustomId("nome")
            .setLabel("Nome do modelo")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
                modelo.nome || ""
            )
            .setMaxLength(100);

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título do embed")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                modelo.titulo || ""
            )
            .setMaxLength(256);

    const descricao =
        new TextInputBuilder()
            .setCustomId("descricao")
            .setLabel("Descrição")
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setValue(
                modelo.descricao || ""
            )
            .setMaxLength(4000);

    const autor =
        new TextInputBuilder()
            .setCustomId("autor")
            .setLabel("Autor do embed")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                modelo.autor_nome || ""
            )
            .setMaxLength(256);

    const cor =
        new TextInputBuilder()
            .setCustomId("cor")
            .setLabel("Cor hexadecimal")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                modelo.cor || "#5865F2"
            )
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(titulo),
        new ActionRowBuilder().addComponents(descricao),
        new ActionRowBuilder().addComponents(autor),
        new ActionRowBuilder().addComponents(cor)
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
    modelo,
    config = null
) {

    const embed =
        criarEmbedTicket(modelo)
            .setTitle(
                modelo.titulo ||
                "🎫 Prévia do Ticket"
            );

    if (config) {

        embed.addFields(
            {
                name: "📢 Canal do painel",
                value: config.canal_painel_id
                    ? `<#${config.canal_painel_id}>`
                    : "❌ Não definido",
                inline: true
            },
            {
                name: "📁 Categoria",
                value: config.categoria_id
                    ? `<#${config.categoria_id}>`
                    : "❌ Não definida",
                inline: true
            }
        );
    }

    const botoes =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_info_${modelo.id}`
                    )
                    .setLabel("Editar informações")
                    .setEmoji("✏️")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_personalizar_${modelo.id}`
                    )
                    .setLabel("Personalizar")
                    .setEmoji("🎨")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const botoes2 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_canal_${modelo.id}`
                    )
                    .setLabel("Escolher canal")
                    .setEmoji("📢")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_categoria_${modelo.id}`
                    )
                    .setLabel("Escolher categoria")
                    .setEmoji("📁")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_confirmar_${modelo.id}`
                    )
                    .setLabel("Salvar")
                    .setEmoji("✅")
                    .setStyle(
                        ButtonStyle.Success
                    )
            );

    return {
        embeds: [embed],
        components: [
            botoes,
            botoes2
        ],
        ephemeral: true
    };
}

// ================================
// 📢 MENU DE CANAL
// ================================

function criarMenuCanal(
    modeloId
) {

    const menu =
        new ChannelSelectMenuBuilder()
            .setCustomId(
                `ticket_escolher_canal_${modeloId}`
            )
            .setPlaceholder(
                "📢 Escolha o canal do painel"
            )
            .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
            )
            .setMinValues(1)
            .setMaxValues(1);

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("📢 Canal do painel")
                .setDescription(
                    "Escolha o canal onde o painel de tickets será enviado."
                )
        ],
        components: [
            new ActionRowBuilder()
                .addComponents(menu)
        ],
        ephemeral: true
    };
}

// ================================
// 📁 MENU DE CATEGORIA
// ================================

function criarMenuCategoria(
    modeloId
) {

    const menu =
        new ChannelSelectMenuBuilder()
            .setCustomId(
                `ticket_escolher_categoria_${modeloId}`
            )
            .setPlaceholder(
                "📁 Escolha a categoria dos tickets"
            )
            .setChannelTypes(
                ChannelType.GuildCategory
            )
            .setMinValues(1)
            .setMaxValues(1);

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("📁 Categoria dos tickets")
                .setDescription(
                    "Escolha a categoria onde os tickets serão criados."
                )
        ],
        components: [
            new ActionRowBuilder()
                .addComponents(menu)
        ],
        ephemeral: true
    };
}

// ================================
// 🎫 ATUALIZAR PAINEL EXISTENTE
// ================================

async function atualizarPainelPublicado(
    guild,
    modelo,
    config
) {

    if (
        !config ||
        !config.canal_painel_id
    ) {
        return null;
    }

    try {

        const canal =
            await guild.channels.fetch(
                config.canal_painel_id
            );

        if (
            !canal ||
            !canal.isTextBased()
        ) {
            return null;
        }

        // Se já temos uma mensagem salva,
        // tenta editar ela.
        if (config.mensagem_painel_id) {

            try {

                const mensagem =
                    await canal.messages.fetch(
                        config.mensagem_painel_id
                    );

                const embed =
                    criarEmbedTicket(modelo)
                        .setTitle(
                            modelo.titulo ||
                            "🎫 Abra um Ticket"
                        );

                await mensagem.edit({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                criarBotaoTicket(modelo)
                            )
                    ]
                });

                return mensagem;

            } catch {
                // Mensagem antiga não existe mais.
            }
        }

        // Se não existe mensagem salva,
        // cria uma nova.
        const embed =
            criarEmbedTicket(modelo)
                .setTitle(
                    modelo.titulo ||
                    "🎫 Abra um Ticket"
                );

        const mensagem =
            await canal.send({
                embeds: [embed],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            criarBotaoTicket(modelo)
                        )
                ]
            });

        await pool.query(
            `
            UPDATE ticket_config
            SET mensagem_painel_id = $1
            WHERE guild_id = $2
            `,
            [
                mensagem.id,
                guild.id
            ]
        );

        return mensagem;

    } catch (erro) {

        console.error(
            "❌ Erro ao atualizar painel de ticket:",
            erro
        );

        return null;
    }
}

// ================================
// 🔎 PROCURAR TICKET DO USUÁRIO
// ================================

function encontrarTicketDoUsuario(
    guild,
    userId,
    categoriaId
) {

    return guild.channels.cache.find(
        canal =>
            canal.type === ChannelType.GuildText &&
            canal.parentId === categoriaId &&
            canal.topic === `ticket:${userId}`
    );
}

// ================================
// 🎫 ABRIR TICKET
// ================================

async function abrirTicket(
    interaction,
    modelo
) {

    const configResult =
        await pool.query(
            `
            SELECT *
            FROM ticket_config
            WHERE guild_id = $1
            `,
            [
                interaction.guildId
            ]
        );

    const config =
        configResult.rows[0];

    if (
        !config ||
        !config.configurado ||
        !config.categoria_id
    ) {

        await interaction.reply({
            content:
                "❌ O sistema de tickets ainda não foi configurado corretamente. Um administrador precisa escolher a categoria dos tickets.",
            ephemeral: true
        });

        return true;
    }

    const categoria =
        await interaction.guild.channels.fetch(
            config.categoria_id
        );

    if (
        !categoria ||
        categoria.type !== ChannelType.GuildCategory
    ) {

        await interaction.reply({
            content:
                "❌ A categoria configurada não existe mais. Configure o ticket novamente.",
            ephemeral: true
        });

        return true;
    }

    const ticketExistente =
        encontrarTicketDoUsuario(
            interaction.guild,
            interaction.user.id,
            categoria.id
        );

    if (ticketExistente) {

        await interaction.reply({
            content:
                `❌ Você já possui um ticket aberto: ${ticketExistente}`,
            ephemeral: true
        });

        return true;
    }

    const nomeUsuario =
        interaction.user.username
            .toLowerCase()
            .replace(
                /[^a-z0-9-]/g,
                "-"
            )
            .slice(0, 20);

    const nomeCanal =
        `ticket-${nomeUsuario}`;

    const canal =
        await interaction.guild.channels.create({

            name: nomeCanal,

            type:
                ChannelType.GuildText,

            parent:
                categoria.id,

            topic:
                `ticket:${interaction.user.id}`,

            permissionOverwrites: [

                {
                    id:
                        interaction.guild.roles.everyone.id,

                    deny: [
                        PermissionFlagsBits.ViewChannel
                    ]
                },

                {
                    id:
                        interaction.user.id,

                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                },

                {
                    id:
                        interaction.client.user.id,

                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ManageMessages
                    ]
                }
            ]
        });

    const embed =
        criarEmbedTicket(modelo)
            .setTitle(
                modelo.titulo ||
                `🎫 Ticket de ${interaction.user.username}`
            );

    const botoes =
        new ActionRowBuilder()
            .addComponents(
                criarBotaoFechar()
            );

    await canal.send({
        content:
            `${interaction.user}`,

        embeds: [
            embed
        ],

        components: [
            botoes
        ]
    });

    await interaction.reply({
        content:
            `✅ Seu ticket foi criado com sucesso: ${canal}`,
        ephemeral: true
    });

    console.log(
        `🎫 Ticket criado: ${canal.name} | Usuário: ${interaction.user.tag}`
    );

    return true;
}

// ================================
// 🔒 FECHAR TICKET
// ================================

async function fecharTicket(
    interaction
) {

    const canal =
        interaction.channel;

    if (
        !canal ||
        canal.type !== ChannelType.GuildText
    ) {

        await interaction.reply({
            content:
                "❌ Este botão só pode ser usado dentro de um ticket.",
            ephemeral: true
        });

        return true;
    }

    if (
        !canal.topic ||
        !canal.topic.startsWith("ticket:")
    ) {

        await interaction.reply({
            content:
                "❌ Este canal não é um ticket.",
            ephemeral: true
        });

        return true;
    }

    await interaction.reply({
        content:
            "🔒 Este ticket será fechado em 5 segundos..."
    });

    console.log(
        `🔒 Ticket fechado: ${canal.name} | Por: ${interaction.user.tag}`
    );

    setTimeout(
        async () => {

            try {

                await canal.delete(
                    "Ticket fechado"
                );

            } catch (erro) {

                console.error(
                    "❌ Erro ao apagar ticket:",
                    erro
                );
            }

        },
        5000
    );

    return true;
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

        if (!interaction.guild) {

            return interaction.reply({
                content:
                    "❌ O comando `/ticket` só pode ser usado dentro de um servidor.",
                ephemeral: true
            });
        }

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

        if (!interaction.guild) {

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({
                    content:
                        "❌ O sistema de tickets só pode ser usado dentro de um servidor.",
                    ephemeral: true
                });
            }

            return true;
        }

        if (
            !interaction.customId
                .startsWith("ticket_")
        ) {
            return false;
        }

        await inicializarTickets();

        // ================================
        // 🎫 ABRIR TICKET
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_abrir_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_abrir_",
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
                        "❌ Esse modelo de ticket não existe mais.",
                    ephemeral: true
                });

                return true;
            }

            return await abrirTicket(
                interaction,
                resultado.rows[0]
            );
        }

        // ================================
        // 🔒 FECHAR TICKET
        // ================================

        if (
            interaction.customId ===
            "ticket_fechar"
        ) {

            return await fecharTicket(
                interaction
            );
        }

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
        // ✏️ EDITAR INFORMAÇÕES
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_info_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_info_",
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
                criarModalEditarInformacoes(
                    resultado.rows[0]
                )
            );

            return true;
        }

        // ================================
        // 🎨 PERSONALIZAR
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
        // 📢 ESCOLHER CANAL
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_canal_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_canal_",
                    ""
                );

            await interaction.update(
                criarMenuCanal(id)
            );

            return true;
        }

        // ================================
        // 📁 ESCOLHER CATEGORIA
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_categoria_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_categoria_",
                    ""
                );

            await interaction.update(
                criarMenuCategoria(id)
            );

            return true;
        }

        // ================================
        // ✅ CONFIRMAR / SALVAR
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

            const modeloResult =
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
                !modeloResult.rows.length
            ) {

                await interaction.reply({
                    content:
                        "❌ Esse modelo não existe.",
                    ephemeral: true
                });

                return true;
            }

            const modelo =
                modeloResult.rows[0];

            const configResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_config
                    WHERE guild_id = $1
                    `,
                    [
                        interaction.guildId
                    ]
                );

            const config =
                configResult.rows[0];

            if (
                !config ||
                !config.canal_painel_id ||
                !config.categoria_id
            ) {

                await interaction.reply({
                    content:
                        "❌ Antes de salvar, escolha o **canal do painel** e a **categoria dos tickets**.",
                    ephemeral: true
                });

                return true;
            }

            const canalPainel =
                await interaction.guild.channels.fetch(
                    config.canal_painel_id
                );

            const categoria =
                await interaction.guild.channels.fetch(
                    config.categoria_id
                );

            if (
                !canalPainel ||
                !canalPainel.isTextBased()
            ) {

                await interaction.reply({
                    content:
                        "❌ O canal escolhido para o painel não existe mais.",
                    ephemeral: true
                });

                return true;
            }

            if (
                !categoria ||
                categoria.type !== ChannelType.GuildCategory
            ) {

                await interaction.reply({
                    content:
                        "❌ A categoria escolhida não existe mais.",
                    ephemeral: true
                });

                return true;
            }

            await pool.query(
                `
                INSERT INTO ticket_config (
                    guild_id,
                    modelo_id,
                    canal_painel_id,
                    categoria_id,
                    configurado
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    TRUE
                )

                ON CONFLICT (guild_id)
                DO UPDATE SET
                    modelo_id = EXCLUDED.modelo_id,
                    canal_painel_id = EXCLUDED.canal_painel_id,
                    categoria_id = EXCLUDED.categoria_id,
                    configurado = TRUE
                `,
                [
                    interaction.guildId,
                    id,
                    config.canal_painel_id,
                    config.categoria_id
                ]
            );

            const novaConfigResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_config
                    WHERE guild_id = $1
                    `,
                    [
                        interaction.guildId
                    ]
                );

            const novaConfig =
                novaConfigResult.rows[0];

            const painel =
                await atualizarPainelPublicado(
                    interaction.guild,
                    modelo,
                    novaConfig
                );

            if (!painel) {

                await interaction.reply({
                    content:
                        "❌ Não consegui enviar/atualizar o painel. Verifique se o bot tem permissão para enviar mensagens no canal escolhido.",
                    ephemeral: true
                });

                return true;
            }

            await interaction.update({
                content:
                    `✅ Configuração salva!\n\n📢 Canal: ${canalPainel}\n📁 Categoria: ${categoria}\n🎫 Modelo: **${modelo.nome}**`,
                embeds: [],
                components: []
            });

            console.log(
                `🎫 Ticket configurado: ${modelo.nome} | Servidor: ${interaction.guild.name}`
            );

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

        if (!interaction.guild) {

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({
                    content:
                        "❌ O sistema de tickets só pode ser usado dentro de um servidor.",
                    ephemeral: true
                });
            }

            return true;
        }

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

            if (valor === "criar") {

                await interaction.showModal(
                    criarModalTicket()
                );

                return true;
            }

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

                const configResult =
                    await pool.query(
                        `
                        SELECT *
                        FROM ticket_config
                        WHERE guild_id = $1
                        `,
                        [
                            interaction.guildId
                        ]
                    );

                return interaction.update(
                    criarPainelModelo(
                        resultado.rows[0],
                        configResult.rows[0] || null
                    )
                );
            }
        }

        // ================================
        // ⚙️ ESCOLHER MODELO
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

            const configResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_config
                    WHERE guild_id = $1
                    `,
                    [
                        interaction.guildId
                    ]
                );

            return interaction.update(
                criarPainelModelo(
                    resultado.rows[0],
                    configResult.rows[0] || null
                )
            );
        }

        // ================================
        // 📢 ESCOLHER CANAL
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_escolher_canal_"
            )
        ) {

            const modeloId =
                interaction.customId.replace(
                    "ticket_escolher_canal_",
                    ""
                );

            const canalId =
                interaction.values[0];

            await pool.query(
                `
                INSERT INTO ticket_config (
                    guild_id,
                    canal_painel_id,
                    configurado
                )
                VALUES (
                    $1,
                    $2,
                    FALSE
                )

                ON CONFLICT (guild_id)
                DO UPDATE SET
                    canal_painel_id = EXCLUDED.canal_painel_id
                `,
                [
                    interaction.guildId,
                    canalId
                ]
            );

            const modeloResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_modelos
                    WHERE id = $1
                    AND guild_id = $2
                    `,
                    [
                        modeloId,
                        interaction.guildId
                    ]
                );

            const configResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_config
                    WHERE guild_id = $1
                    `,
                    [
                        interaction.guildId
                    ]
                );

            return interaction.update(
                criarPainelModelo(
                    modeloResult.rows[0],
                    configResult.rows[0]
                )
            );
        }

        // ================================
        // 📁 ESCOLHER CATEGORIA
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_escolher_categoria_"
            )
        ) {

            const modeloId =
                interaction.customId.replace(
                    "ticket_escolher_categoria_",
                    ""
                );

            const categoriaId =
                interaction.values[0];

            await pool.query(
                `
                INSERT INTO ticket_config (
                    guild_id,
                    categoria_id,
                    configurado
                )
                VALUES (
                    $1,
                    $2,
                    FALSE
                )

                ON CONFLICT (guild_id)
                DO UPDATE SET
                    categoria_id = EXCLUDED.categoria_id
                `,
                [
                    interaction.guildId,
                    categoriaId
                ]
            );

            const modeloResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_modelos
                    WHERE id = $1
                    AND guild_id = $2
                    `,
                    [
                        modeloId,
                        interaction.guildId
                    ]
                );

            const configResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_config
                    WHERE guild_id = $1
                    `,
                    [
                        interaction.guildId
                    ]
                );

            return interaction.update(
                criarPainelModelo(
                    modeloResult.rows[0],
                    configResult.rows[0]
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

        if (!interaction.guild) {

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({
                    content:
                        "❌ O sistema de tickets só pode ser usado dentro de um servidor.",
                    ephemeral: true
                });
            }

            return true;
        }

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
        // ✏️ EDITAR INFORMAÇÕES
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_modal_info_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_modal_info_",
                    ""
                );

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

            await pool.query(
                `
                UPDATE ticket_modelos
                SET
                    nome = $1,
                    titulo = $2,
                    descricao = $3,
                    autor_nome = $4,
                    cor = $5
                WHERE id = $6
                AND guild_id = $7
                `,
                [
                    interaction.fields
                        .getTextInputValue(
                            "nome"
                        )
                        .trim(),

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

                    interaction.fields
                        .getTextInputValue(
                            "autor"
                        )
                        .trim() ||
                        null,

                    cor,

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

            const configResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_config
                    WHERE guild_id = $1
                    `,
                    [
                        interaction.guildId
                    ]
                );

            await atualizarPainelPublicado(
                interaction.guild,
                resultado.rows[0],
                configResult.rows[0]
            );

            await interaction.reply(
                criarPainelModelo(
                    resultado.rows[0],
                    configResult.rows[0] || null
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

            const configResult =
                await pool.query(
                    `
                    SELECT *
                    FROM ticket_config
                    WHERE guild_id = $1
                    `,
                    [
                        interaction.guildId
                    ]
                );

            await atualizarPainelPublicado(
                interaction.guild,
                resultado.rows[0],
                configResult.rows[0]
            );

            await interaction.reply(
                criarPainelModelo(
                    resultado.rows[0],
                    configResult.rows[0] || null
                )
            );

            return true;
        }

        return false;
    }
};
