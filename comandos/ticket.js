const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
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
// 🎫 CONFIGURAÇÕES TEMPORÁRIAS
// ================================

const configuracoesPendentes = new Map();

function criarChavePendente(
    guildId,
    userId,
    modeloId
) {
    return `${guildId}:${userId}:${modeloId}`;
}

function obterConfiguracaoPendente(
    guildId,
    userId,
    modeloId,
    configBanco = null
) {
    const chave =
        criarChavePendente(
            guildId,
            userId,
            modeloId
        );

    const pendente =
        configuracoesPendentes.get(chave);

    if (!pendente) {
        return configBanco;
    }

    return {
        ...(configBanco || {}),

        canal_painel_id:
            pendente.canal_painel_id !== undefined
                ? pendente.canal_painel_id
                : configBanco?.canal_painel_id || null,

        categoria_id:
            pendente.categoria_id !== undefined
                ? pendente.categoria_id
                : configBanco?.categoria_id || null,

        cargo_mencao_id:
            pendente.cargo_mencao_id !== undefined
                ? pendente.cargo_mencao_id
                : configBanco?.cargo_mencao_id || null,

        contador_nome:
            pendente.contador_nome !== undefined
                ? pendente.contador_nome
                : configBanco?.contador_nome || false,

        mensagem_painel_id:
            configBanco?.mensagem_painel_id || null,

        modelo_id:
            configBanco?.modelo_id || modeloId
    };
}

function salvarConfiguracaoPendente(
    guildId,
    userId,
    modeloId,
    dados
) {
    const chave =
        criarChavePendente(
            guildId,
            userId,
            modeloId
        );

    const atual =
        configuracoesPendentes.get(chave) || {};

    configuracoesPendentes.set(
        chave,
        {
            ...atual,
            ...dados
        }
    );
}

function limparConfiguracaoPendente(
    guildId,
    userId,
    modeloId
) {
    configuracoesPendentes.delete(
        criarChavePendente(
            guildId,
            userId,
            modeloId
        )
    );
}

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

            cargo_mencao_id VARCHAR(30),

            contador_nome BOOLEAN NOT NULL DEFAULT FALSE,

            contador_tickets BIGINT NOT NULL DEFAULT 0,

            configurado BOOLEAN NOT NULL DEFAULT FALSE,

            FOREIGN KEY (modelo_id)
            REFERENCES ticket_modelos(id)
            ON DELETE SET NULL
        )
    `);

    await pool.query(`
        ALTER TABLE ticket_config
        ADD COLUMN IF NOT EXISTS categoria_id VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE ticket_config
        ADD COLUMN IF NOT EXISTS mensagem_painel_id VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE ticket_config
        ADD COLUMN IF NOT EXISTS cargo_mencao_id VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE ticket_config
        ADD COLUMN IF NOT EXISTS contador_nome BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE ticket_config
        ADD COLUMN IF NOT EXISTS contador_tickets BIGINT NOT NULL DEFAULT 0
    `);

    await pool.query(`
        UPDATE ticket_config
        SET contador_tickets = 0
        WHERE contador_tickets IS NULL
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

        const resultado =
            new URL(url);

        return (
            resultado.protocol === "http:" ||
            resultado.protocol === "https:"
        );

    } catch {

        return false;
    }
}

// ================================
// 🇧🇷 DATA/HORA BRASIL
// ================================

function formatarDataHora(timestamp) {

    return new Intl.DateTimeFormat(
        "pt-BR",
        {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    ).format(
        new Date(
            Number(timestamp)
        )
    );
}

// ================================
// 🎨 EMBED DO TICKET
// ================================

function criarEmbedTicket(modelo) {

    const embed =
        new EmbedBuilder();

    if (
        modelo.cor &&
        /^#[0-9A-Fa-f]{6}$/.test(
            modelo.cor
        )
    ) {

        embed.setColor(
            modelo.cor
        );

    } else {

        embed.setColor(
            0x5865F2
        );
    }

    if (modelo.titulo) {

        embed.setTitle(
            modelo.titulo
        );
    }

    if (modelo.descricao) {

        embed.setDescription(
            modelo.descricao
        );
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

        embed.setAuthor(
            autor
        );
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

        embed.setFooter(
            rodape
        );
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

    let estilo =
        ButtonStyle.Primary;

    if (
        modelo.botao_estilo ===
        "Secondary"
    ) {

        estilo =
            ButtonStyle.Secondary;
    }

    if (
        modelo.botao_estilo ===
        "Success"
    ) {

        estilo =
            ButtonStyle.Success;
    }

    if (
        modelo.botao_estilo ===
        "Danger"
    ) {

        estilo =
            ButtonStyle.Danger;
    }

    const botao =
        new ButtonBuilder()
            .setLabel(
                modelo.botao_texto ||
                "Fazer Ticket"
            )
            .setStyle(
                estilo
            )
            .setDisabled(
                disabled
            )
            .setCustomId(
                `ticket_abrir_${modelo.id}`
            );

    if (
        modelo.botao_emoji
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
        .setLabel(
            "Fechar Ticket"
        )
        .setEmoji(
            "🔒"
        )
        .setStyle(
            ButtonStyle.Danger
        );
}

// ================================
// ⚙️ PAINEL PRINCIPAL
// ================================

function criarPainel(
    modelos
) {

    const embed =
        new EmbedBuilder()
            .setColor(
                0x5865F2
            )
            .setTitle(
                "🎫 Configuração de Tickets"
            )
            .setDescription(
                "Escolha uma opção abaixo para continuar."
            );

    const componentes = [];

    const opcoes = [
        {
            label:
                "Criar ticket",

            value:
                "criar",

            description:
                "Criar um novo modelo de ticket",

            emoji:
                "➕"
        },

        {
            label:
                "Configurar ticket",

            value:
                "configurar",

            description:
                modelos.length > 0
                    ? "Escolher um modelo para configurar"
                    : "Nenhum modelo criado ainda",

            emoji:
                "⚙️"
        }
    ];

    modelos
        .slice(0, 23)
        .forEach(
            modelo => {

                opcoes.push({
                    label:
                        modelo.nome
                            .slice(
                                0,
                                100
                            ),

                    value:
                        `modelo_${modelo.id}`,

                    description:
                        (
                            modelo.titulo ||
                            "Abrir este modelo"
                        ).slice(
                            0,
                            100
                        ),

                    emoji:
                        "🎫"
                });
            }
        );

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                "ticket_menu_principal"
            )
            .setPlaceholder(
                "🎫 Escolha uma opção"
            )
            .addOptions(
                opcoes
            );

    componentes.push(
        new ActionRowBuilder()
            .addComponents(
                menu
            )
    );

    componentes.push(
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "ticket_atualizar"
                    )
                    .setLabel(
                        "Atualizar"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    );

    return {
        embeds: [
            embed
        ],

        components:
            componentes,

        ephemeral:
            true
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
            .setColor(
                0x5865F2
            )
            .setTitle(
                "⚙️ Configurar ticket"
            )
            .setDescription(
                modelos.length > 0
                    ? "Escolha o modelo que deseja configurar."
                    : "❌ Você ainda não possui nenhum modelo de ticket."
            );

    const componentes = [];

    if (
        modelos.length > 0
    ) {

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
                        .slice(
                            0,
                            25
                        )
                        .map(
                            modelo => ({
                                label:
                                    modelo.nome
                                        .slice(
                                            0,
                                            100
                                        ),

                                value:
                                    String(
                                        modelo.id
                                    ),

                                description:
                                    (
                                        modelo.titulo ||
                                        "Sem título definido"
                                    ).slice(
                                        0,
                                        100
                                    ),

                                emoji:
                                    "🎫"
                            })
                        )
                );

        componentes.push(
            new ActionRowBuilder()
                .addComponents(
                    menu
                )
        );
    }

    return {
        embeds: [
            embed
        ],

        components:
            componentes,

        ephemeral:
            true
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
            .setCustomId(
                "nome"
            )
            .setLabel(
                "Nome do ticket"
            )
            .setPlaceholder(
                "Ex: Suporte"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                true
            )
            .setMaxLength(
                100
            );

    const titulo =
        new TextInputBuilder()
            .setCustomId(
                "titulo"
            )
            .setLabel(
                "Título do embed"
            )
            .setPlaceholder(
                "Ex: 🎫 Atendimento"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setMaxLength(
                256
            );

    const descricao =
        new TextInputBuilder()
            .setCustomId(
                "descricao"
            )
            .setLabel(
                "Descrição"
            )
            .setPlaceholder(
                "Explique para que serve este ticket."
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(
                false
            )
            .setMaxLength(
                4000
            );

    const autor =
        new TextInputBuilder()
            .setCustomId(
                "autor"
            )
            .setLabel(
                "Autor do embed"
            )
            .setPlaceholder(
                "Ex: MIGUELGAMEBP"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setMaxLength(
                256
            );

    const cor =
        new TextInputBuilder()
            .setCustomId(
                "cor"
            )
            .setLabel(
                "Cor hexadecimal"
            )
            .setPlaceholder(
                "Ex: #5865F2"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            )
            .setMaxLength(
                20
            );

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
// 📝 MODAL MOTIVO DO TICKET
// ================================

function criarModalMotivoTicket(
    modeloId
) {

    const modal =
        new ModalBuilder()
            .setCustomId(
                `ticket_modal_motivo_${modeloId}`
            )
            .setTitle(
                "🎫 Criar ticket"
            );

    const motivo =
        new TextInputBuilder()
            .setCustomId(
                "motivo"
            )
            .setLabel(
                "Motivo do ticket"
            )
            .setPlaceholder(
                "Explique brevemente o motivo do ticket. Opcional."
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(
                false
            )
            .setMaxLength(
                1000
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                motivo
            )
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
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(modelo.nome || "")
            .setMaxLength(100);

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título do embed")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(modelo.titulo || "")
            .setMaxLength(256);

    const descricao =
        new TextInputBuilder()
            .setCustomId("descricao")
            .setLabel("Descrição")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue(modelo.descricao || "")
            .setMaxLength(4000);

    const autor =
        new TextInputBuilder()
            .setCustomId("autor")
            .setLabel("Autor do embed")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(modelo.autor_nome || "")
            .setMaxLength(256);

    const cor =
        new TextInputBuilder()
            .setCustomId("cor")
            .setLabel("Cor hexadecimal")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(modelo.cor || "#5865F2")
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
// 🎨 MODAL PERSONALIZAÇÃO
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
            .setPlaceholder("https://...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(modelo.imagem || "")
            .setMaxLength(1000);

    const thumbnail =
        new TextInputBuilder()
            .setCustomId("thumbnail")
            .setLabel("URL da thumbnail")
            .setPlaceholder("https://...")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(modelo.thumbnail || "")
            .setMaxLength(1000);

    const rodape =
        new TextInputBuilder()
            .setCustomId("rodape")
            .setLabel("Rodapé")
            .setPlaceholder("Texto do rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(modelo.rodape || "")
            .setMaxLength(2048);

    const botao =
        new TextInputBuilder()
            .setCustomId("botao")
            .setLabel("Texto do botão")
            .setPlaceholder("Ex: Fazer Ticket")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(modelo.botao_texto || "Fazer Ticket")
            .setMaxLength(80);

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji do botão")
            .setPlaceholder("ex: 🎫")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(modelo.botao_emoji || "")
            .setMaxLength(100);

    modal.addComponents(
        new ActionRowBuilder().addComponents(imagem),
        new ActionRowBuilder().addComponents(thumbnail),
        new ActionRowBuilder().addComponents(rodape),
        new ActionRowBuilder().addComponents(botao),
        new ActionRowBuilder().addComponents(emoji)
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

    const contadorAtivo =
        Boolean(
            config?.contador_nome
        );

    const embed =
        criarEmbedTicket(modelo)
            .setTitle(
                modelo.titulo ||
                "🎫 Prévia do Ticket"
            );

    if (config) {

        embed.addFields(
            {
                name:
                    "📢 Canal do painel",

                value:
                    config.canal_painel_id
                        ? `<#${config.canal_painel_id}>`
                        : "❌ Não definido",

                inline:
                    true
            },

            {
                name:
                    "📁 Categoria",

                value:
                    config.categoria_id
                        ? `<#${config.categoria_id}>`
                        : "❌ Não definida",

                inline:
                    true
            },

            {
                name:
                    "👥 Cargo para mencionar",

                value:
                    config.cargo_mencao_id
                        ? `<@&${config.cargo_mencao_id}>`
                        : "❌ Nenhum",

                inline:
                    true
            },

            {
                name:
                    "🔢 Contador no nome",

                value:
                    contadorAtivo
                        ? "✅ Ativado"
                        : "❌ Desativado",

                inline:
                    true
            },

            {
                name:
                    "🎫 Tickets criados",

                value:
                    String(
                        config.contador_tickets || 0
                    ),

                inline:
                    true
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
                    .setLabel(
                        "Editar informações"
                    )
                    .setEmoji(
                        "✏️"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_personalizar_${modelo.id}`
                    )
                    .setLabel(
                        "Personalizar"
                    )
                    .setEmoji(
                        "🎨"
                    )
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
                    .setLabel(
                        "Escolher canal"
                    )
                    .setEmoji(
                        "📢"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_categoria_${modelo.id}`
                    )
                    .setLabel(
                        "Escolher categoria"
                    )
                    .setEmoji(
                        "📁"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_cargo_${modelo.id}`
                    )
                    .setLabel(
                        "Escolher cargo"
                    )
                    .setEmoji(
                        "👥"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const botoes3 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_contador_${modelo.id}`
                    )
                    .setLabel(
                        contadorAtivo
                            ? "Contador: Ativado"
                            : "Contador: Desativado"
                    )
                    .setEmoji(
                        "🔢"
                    )
                    .setStyle(
                        contadorAtivo
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `ticket_confirmar_${modelo.id}`
                    )
                    .setLabel(
                        "Salvar"
                    )
                    .setEmoji(
                        "✅"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
            );

    return {
        embeds: [
            embed
        ],

        components: [
            botoes,
            botoes2,
            botoes3
        ],

        ephemeral:
            true
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

        ephemeral:
            true
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

        ephemeral:
            true
    };
}

// ================================
// 👥 MENU DE CARGO
// ================================

function criarMenuCargo(
    modeloId
) {

    const menu =
        new RoleSelectMenuBuilder()
            .setCustomId(
                `ticket_escolher_cargo_${modeloId}`
            )
            .setPlaceholder(
                "👥 Escolha o cargo para mencionar"
            )
            .setMinValues(1)
            .setMaxValues(1);

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("👥 Cargo da staff")
                .setDescription(
                    "Escolha o cargo que será mencionado quando um novo ticket for criado."
                )
        ],

        components: [
            new ActionRowBuilder()
                .addComponents(menu)
        ],

        ephemeral:
            true
    };
}

// ================================
// 🗑️ APAGAR PAINEL ANTIGO
// ================================

async function apagarPainelAntigo(
    guild,
    canalAntigoId,
    mensagemAntigaId
) {

    if (
        !canalAntigoId ||
        !mensagemAntigaId
    ) {
        return;
    }

    try {

        const canalAntigo =
            await guild.channels.fetch(
                canalAntigoId
            );

        if (
            !canalAntigo ||
            !canalAntigo.isTextBased()
        ) {
            return;
        }

        try {

            const mensagem =
                await canalAntigo.messages.fetch(
                    mensagemAntigaId
                );

            await mensagem.delete();

        } catch (erro) {

            if (
                erro?.code !== 10008
            ) {

                console.error(
                    "❌ Erro ao apagar painel antigo:",
                    erro
                );
            }
        }

    } catch (erro) {

        console.error(
            "❌ Erro ao acessar canal antigo:",
            erro
        );
    }
}

// ================================
// 🎫 ATUALIZAR PAINEL PUBLICADO
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

        const embed =
            criarEmbedTicket(modelo)
                .setTitle(
                    modelo.titulo ||
                    "🎫 Abra um Ticket"
                );

        const componentes = [
            new ActionRowBuilder()
                .addComponents(
                    criarBotaoTicket(modelo)
                )
        ];

        if (
            config.mensagem_painel_id
        ) {

            try {

                const mensagem =
                    await canal.messages.fetch(
                        config.mensagem_painel_id
                    );

                await mensagem.edit({
                    embeds: [embed],
                    components: componentes
                });

                return mensagem;

            } catch (erro) {

                if (
                    erro?.code !== 10008
                ) {

                    console.log(
                        "ℹ️ Não foi possível editar o painel antigo."
                    );
                }
            }
        }

        const mensagem =
            await canal.send({
                embeds: [embed],
                components: componentes
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
            "❌ Erro ao atualizar painel:",
            erro
        );

        return null;
    }
}

// ================================
// 🔎 PROCURAR TICKET
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
            canal.topic &&
            canal.topic.startsWith(
                `ticket:${userId}`
            )
    );
}

// ================================
// 🎫 ABRIR TICKET
// ================================

async function abrirTicket(
    interaction,
    modelo,
    motivo
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
                "❌ O sistema de tickets ainda não foi configurado corretamente.",

            ephemeral:
                true
        });

        return true;
    }

    const categoria =
        await interaction.guild.channels.fetch(
            config.categoria_id
        );

    if (
        !categoria ||
        categoria.type !==
            ChannelType.GuildCategory
    ) {

        await interaction.reply({
            content:
                "❌ A categoria configurada não existe mais.",

            ephemeral:
                true
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

            ephemeral:
                true
        });

        return true;
    }

    // ================================
    // 🔢 GERAR NÚMERO DO TICKET
    // ================================

    const contadorResult =
        await pool.query(
            `
            UPDATE ticket_config
            SET contador_tickets = contador_tickets + 1
            WHERE guild_id = $1
            RETURNING contador_tickets
            `,
            [
                interaction.guildId
            ]
        );

    const numeroTicket =
        Number(
            contadorResult.rows[0]?.contador_tickets ||
            1
        );

    const numeroFormatado =
        String(
            numeroTicket
        ).padStart(
            3,
            "0"
        );

    const nomeUsuario =
        interaction.user.username
            .toLowerCase()
            .replace(
                /[^a-z0-9-]/g,
                "-"
            )
            .slice(
                0,
                20
            );

    const nomeCanal =
        config.contador_nome
            ? `ticket-${numeroFormatado}-${nomeUsuario}`
            : `ticket-${nomeUsuario}`;

    const motivoFinal =
        motivo &&
        motivo.trim()
            ? motivo.trim()
            : "Nenhum";

    const criadoEm =
        Date.now();

    const overwrites = [

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
    ];

    // ================================
    // 👥 DAR ACESSO AO CARGO DA STAFF
    // ================================

    if (
        config.cargo_mencao_id
    ) {

        const cargo =
            interaction.guild.roles.cache.get(
                config.cargo_mencao_id
            );

        if (cargo) {

            overwrites.push({
                id:
                    cargo.id,

                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            });
        }
    }

    const canal =
        await interaction.guild.channels.create({

            name:
                nomeCanal,

            type:
                ChannelType.GuildText,

            parent:
                categoria.id,

            topic:
                `ticket:${interaction.user.id}:${criadoEm}`,

            permissionOverwrites:
                overwrites
        });

    const embed =
        criarEmbedTicket(
            modelo
        )
            .setTitle(
                modelo.titulo ||
                `🎫 Ticket de ${interaction.user.username}`
            )
            .addFields(

                {
                    name:
                        "📝 Motivo",

                    value:
                        motivoFinal,

                    inline:
                        false
                },

                {
                    name:
                        "👤 Criado por",

                    value:
                        `${interaction.user}`,

                    inline:
                        true
                },

                {
                    name:
                        "🕐 Criado em",

                    value:
                        formatarDataHora(
                            criadoEm
                        ),

                    inline:
                        true
                }
            );

    const botoes =
        new ActionRowBuilder()
            .addComponents(
                criarBotaoFechar()
            );

    let conteudo =
        `${interaction.user}`;

    if (
        config.cargo_mencao_id
    ) {

        const cargo =
            interaction.guild.roles.cache.get(
                config.cargo_mencao_id
            );

        if (cargo) {

            conteudo =
                `${cargo} ${interaction.user}`;
        }
    }

    await canal.send({
        content:
            conteudo,

        embeds: [
            embed
        ],

        components: [
            botoes
        ],

        allowedMentions: {
            users: [
                interaction.user.id
            ],

            roles:
                config.cargo_mencao_id
                    ? [config.cargo_mencao_id]
                    : []
        }
    });

    await interaction.reply({
        content:
            `✅ Seu ticket foi criado com sucesso: ${canal}`,

        ephemeral:
            true
    });

    console.log(
        `🎫 Ticket criado: ${canal.name} | Usuário: ${interaction.user.tag} | Número: ${numeroFormatado} | Motivo: ${motivoFinal}`
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
        canal.type !==
            ChannelType.GuildText
    ) {

        await interaction.reply({
            content:
                "❌ Este botão só pode ser usado dentro de um ticket.",

            ephemeral:
                true
        });

        return true;
    }

    if (
        !canal.topic ||
        !canal.topic.startsWith(
            "ticket:"
        )
    ) {

        await interaction.reply({
            content:
                "❌ Este canal não é um ticket.",

            ephemeral:
                true
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

                ephemeral:
                    true
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

            await interaction.reply(
                criarPainel(
                    resultado.rows
                )
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando /ticket:",
                erro
            );

            if (
                interaction.replied
            ) {

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

                    ephemeral:
                        true
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

                    ephemeral:
                        true
                });

                return true;
            }

            // Agora abre a tela do motivo.
            await interaction.showModal(
                criarModalMotivoTicket(
                    id
                )
            );

            return true;
        }

        // ================================
        // 🔒 FECHAR
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

                    ephemeral:
                        true
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

                    ephemeral:
                        true
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
                criarMenuCanal(
                    id
                )
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
                criarMenuCategoria(
                    id
                )
            );

            return true;
        }

        // ================================
        // 👥 ESCOLHER CARGO
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_cargo_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_cargo_",
                    ""
                );

            await interaction.update(
                criarMenuCargo(
                    id
                )
            );

            return true;
        }

        // ================================
        // 🔢 ALTERNAR CONTADOR
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_contador_"
            )
        ) {

            const id =
                interaction.customId.replace(
                    "ticket_contador_",
                    ""
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

            const configBanco =
                configResult.rows[0] || null;

            const configAtual =
                obterConfiguracaoPendente(
                    interaction.guildId,
                    interaction.user.id,
                    id,
                    configBanco
                );

            const novoEstado =
                !Boolean(
                    configAtual?.contador_nome
                );

            salvarConfiguracaoPendente(
                interaction.guildId,
                interaction.user.id,
                id,
                {
                    contador_nome:
                        novoEstado
                }
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

            const config =
                obterConfiguracaoPendente(
                    interaction.guildId,
                    interaction.user.id,
                    id,
                    configBanco
                );

            await interaction.update(
                criarPainelModelo(
                    modeloResult.rows[0],
                    config
                )
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

                    ephemeral:
                        true
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

            const configBanco =
                configResult.rows[0] || null;

            const config =
                obterConfiguracaoPendente(
                    interaction.guildId,
                    interaction.user.id,
                    id,
                    configBanco
                );

            if (
                !config ||
                !config.canal_painel_id ||
                !config.categoria_id
            ) {

                await interaction.reply({
                    content:
                        "❌ Antes de salvar, escolha o **canal do painel** e a **categoria dos tickets**.",

                    ephemeral:
                        true
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

                    ephemeral:
                        true
                });

                return true;
            }

            if (
                !categoria ||
                categoria.type !==
                    ChannelType.GuildCategory
            ) {

                await interaction.reply({
                    content:
                        "❌ A categoria escolhida não existe mais.",

                    ephemeral:
                        true
                });

                return true;
            }

            const canalAntigoId =
                configBanco?.canal_painel_id || null;

            const mensagemAntigaId =
                configBanco?.mensagem_painel_id || null;

            const mudouCanal =
                canalAntigoId &&
                canalAntigoId !==
                    config.canal_painel_id;

            if (mudouCanal) {

                await apagarPainelAntigo(
                    interaction.guild,
                    canalAntigoId,
                    mensagemAntigaId
                );
            }

            await pool.query(
                `
                INSERT INTO ticket_config (
                    guild_id,
                    modelo_id,
                    canal_painel_id,
                    categoria_id,
                    mensagem_painel_id,
                    cargo_mencao_id,
                    contador_nome,
                    contador_tickets,
                    configurado
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    TRUE
                )

                ON CONFLICT (guild_id)
                DO UPDATE SET
                    modelo_id = EXCLUDED.modelo_id,
                    canal_painel_id = EXCLUDED.canal_painel_id,
                    categoria_id = EXCLUDED.categoria_id,
                    mensagem_painel_id = EXCLUDED.mensagem_painel_id,
                    cargo_mencao_id = EXCLUDED.cargo_mencao_id,
                    contador_nome = EXCLUDED.contador_nome,
                    configurado = TRUE
                `,
                [
                    interaction.guildId,
                    id,
                    config.canal_painel_id,
                    config.categoria_id,

                    mudouCanal
                        ? null
                        : (
                            configBanco?.mensagem_painel_id ||
                            null
                        ),

                    config.cargo_mencao_id ||
                        null,

                    Boolean(
                        config.contador_nome
                    ),

                    Number(
                        configBanco?.contador_tickets ||
                        0
                    )
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
                        "❌ Não consegui enviar/atualizar o painel. Verifique as permissões do bot.",

                    ephemeral:
                        true
                });

                return true;
            }

            limparConfiguracaoPendente(
                interaction.guildId,
                interaction.user.id,
                id
            );

            await interaction.update({
                content:
                    `✅ Configuração salva!\n\n📢 Canal: ${canalPainel}\n📁 Categoria: ${categoria}\n👥 Cargo: ${
                        config.cargo_mencao_id
                            ? `<@&${config.cargo_mencao_id}>`
                            : "Nenhum"
                    }\n🔢 Contador no nome: ${
                        config.contador_nome
                            ? "Ativado"
                            : "Desativado"
                    }\n🎫 Modelo: **${modelo.nome}**`,

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

            if (
                valor ===
                "criar"
            ) {

                await interaction.showModal(
                    criarModalTicket()
                );

                return true;
            }

            if (
                valor ===
                "configurar"
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
                            "❌ Esse modelo não existe.",

                        ephemeral:
                            true
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

                const config =
                    obterConfiguracaoPendente(
                        interaction.guildId,
                        interaction.user.id,
                        id,
                        configResult.rows[0] || null
                    );

                return interaction.update(
                    criarPainelModelo(
                        resultado.rows[0],
                        config
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
                        "❌ Esse modelo não existe.",

                    ephemeral:
                        true
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

            const config =
                obterConfiguracaoPendente(
                    interaction.guildId,
                    interaction.user.id,
                    id,
                    configResult.rows[0] || null
                );

            return interaction.update(
                criarPainelModelo(
                    resultado.rows[0],
                    config
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

            salvarConfiguracaoPendente(
                interaction.guildId,
                interaction.user.id,
                modeloId,
                {
                    canal_painel_id:
                        canalId
                }
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

            const config =
                obterConfiguracaoPendente(
                    interaction.guildId,
                    interaction.user.id,
                    modeloId,
                    configResult.rows[0] || null
                );

            return interaction.update(
                criarPainelModelo(
                    modeloResult.rows[0],
                    config
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

            salvarConfiguracaoPendente(
                interaction.guildId,
                interaction.user.id,
                modeloId,
                {
                    categoria_id:
                        categoriaId
                }
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

            const config =
                obterConfiguracaoPendente(
                    interaction.guildId,
                    interaction.user.id,
                    modeloId,
                    configResult.rows[0] || null
                );

            return interaction.update(
                criarPainelModelo(
                    modeloResult.rows[0],
                    config
                )
            );
        }

        // ================================
        // 👥 ESCOLHER CARGO
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_escolher_cargo_"
            )
        ) {

            const modeloId =
                interaction.customId.replace(
                    "ticket_escolher_cargo_",
                    ""
                );

            const cargoId =
                interaction.values[0];

            salvarConfiguracaoPendente(
                interaction.guildId,
                interaction.user.id,
                modeloId,
                {
                    cargo_mencao_id:
                        cargoId
                }
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

            const config =
                obterConfiguracaoPendente(
                    interaction.guildId,
                    interaction.user.id,
                    modeloId,
                    configResult.rows[0] || null
                );

            return interaction.update(
                criarPainelModelo(
                    modeloResult.rows[0],
                    config
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
        // 🎫 MOTIVO DO TICKET
        // ================================

        if (
            interaction.customId.startsWith(
                "ticket_modal_motivo_"
            )
        ) {

            const modeloId =
                interaction.customId.replace(
                    "ticket_modal_motivo_",
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
                        modeloId,
                        interaction.guildId
                    ]
                );

            if (
                !resultado.rows.length
            ) {

                await interaction.reply({
                    content:
                        "❌ Esse modelo de ticket não existe mais.",

                    ephemeral:
                        true
                });

                return true;
            }

            const motivo =
                interaction.fields
                    .getTextInputValue(
                        "motivo"
                    )
                    .trim();

            return await abrirTicket(
                interaction,
                resultado.rows[0],
                motivo
            );
        }

        // ================================
        // ➕ CRIAR MODELO
        // ================================

        if (
            interaction.customId ===
            "ticket_modal_criar"
        ) {

            let cor =
                interaction.fields
                    .getTextInputValue("cor")
                    .trim();

            if (
                !cor ||
                !/^#[0-9A-Fa-f]{6}$/.test(cor)
            ) {
                cor =
                    "#5865F2";
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
                            .getTextInputValue("nome")
                            .trim(),

                        interaction.fields
                            .getTextInputValue("autor")
                            .trim() ||
                            null,

                        interaction.fields
                            .getTextInputValue("titulo")
                            .trim() ||
                            null,

                        interaction.fields
                            .getTextInputValue("descricao")
                            .trim() ||
                            null,

                        cor
                    ]
                );

            await interaction.reply(
                criarPainelModelo(
                    resultado.rows[0]
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
                    .getTextInputValue("cor")
                    .trim();

            if (
                !cor ||
                !/^#[0-9A-Fa-f]{6}$/.test(cor)
            ) {
                cor =
                    "#5865F2";
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
                        .getTextInputValue("nome")
                        .trim(),

                    interaction.fields
                        .getTextInputValue("titulo")
                        .trim() ||
                        null,

                    interaction.fields
                        .getTextInputValue("descricao")
                        .trim() ||
                        null,

                    interaction.fields
                        .getTextInputValue("autor")
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

            const config =
                configResult.rows[0];

            if (
                config &&
                String(config.modelo_id) ===
                    String(id)
            ) {

                await atualizarPainelPublicado(
                    interaction.guild,
                    resultado.rows[0],
                    config
                );
            }

            await interaction.reply(
                criarPainelModelo(
                    resultado.rows[0],
                    obterConfiguracaoPendente(
                        interaction.guildId,
                        interaction.user.id,
                        id,
                        config || null
                    )
                )
            );

            return true;
        }

        // ================================
        // 🎨 PERSONALIZAÇÃO
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
                        .getTextInputValue("imagem")
                        .trim() ||
                        null,

                    interaction.fields
                        .getTextInputValue("thumbnail")
                        .trim() ||
                        null,

                    interaction.fields
                        .getTextInputValue("rodape")
                        .trim() ||
                        null,

                    interaction.fields
                        .getTextInputValue("botao")
                        .trim() ||
                        "Fazer Ticket",

                    interaction.fields
                        .getTextInputValue("emoji")
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

            const config =
                configResult.rows[0];

            if (
                config &&
                String(config.modelo_id) ===
                    String(id)
            ) {

                await atualizarPainelPublicado(
                    interaction.guild,
                    resultado.rows[0],
                    config
                );
            }

            await interaction.reply(
                criarPainelModelo(
                    resultado.rows[0],
                    obterConfiguracaoPendente(
                        interaction.guildId,
                        interaction.user.id,
                        id,
                        config || null
                    )
                )
            );

            return true;
        }

        return false;
    }
};
