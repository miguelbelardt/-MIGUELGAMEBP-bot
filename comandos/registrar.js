const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const crypto = require("crypto");

const {
    pool,
    getRegistroConfig,
    salvarRegistroConfig,
    salvarMensagemRegistro,
    criarRegistroPagina,
    getRegistroPagina,
    getRegistroPaginas,
    atualizarRegistroPagina,
    criarRegistroBotao,
    getRegistroBotoes,
    atualizarRegistroBotao,
    excluirRegistroBotao,
    usuarioJaRegistrado,
    registrarUsuario
} = require("../database/database");

const MAX_PAGINAS = 6;
const MAX_BOTOES = 5;

const ESTILOS_BOTOES = {
    PRIMARY: ButtonStyle.Primary,
    SECONDARY: ButtonStyle.Secondary,
    SUCCESS: ButtonStyle.Success,
    DANGER: ButtonStyle.Danger
};

const EPHEMERAL = MessageFlags.Ephemeral;

// =====================================================
// 🔐 PERMISSÃO
// =====================================================

function podeConfigurar(interaction) {
    return Boolean(
        interaction.guild &&
        interaction.memberPermissions &&
        interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    );
}

// =====================================================
// 🔐 SERVIDOR
// =====================================================

function pertenceAoServidor(interaction, guildId) {
    return Boolean(
        interaction.guild &&
        guildId &&
        String(interaction.guild.id) === String(guildId)
    );
}

// =====================================================
// 🔎 CONFIGURAÇÃO
// =====================================================

async function buscarConfiguracao(guildId) {
    return await getRegistroConfig(guildId);
}

// =====================================================
// 📄 PÁGINAS
// =====================================================

async function buscarPaginas(guildId) {
    const paginas = await getRegistroPaginas(guildId);

    return Array.isArray(paginas)
        ? paginas
        : [];
}

async function buscarPagina(guildId, numeroPagina) {
    const numero = Number(numeroPagina);

    if (!Number.isInteger(numero) || numero < 1) {
        return null;
    }

    return await getRegistroPagina(
        guildId,
        numero
    );
}

// =====================================================
// 🔘 BOTÕES
// =====================================================

async function buscarBotoes(paginaId) {
    const botoes = await getRegistroBotoes(paginaId);

    return Array.isArray(botoes)
        ? botoes
        : [];
}

// =====================================================
// 🆕 GARANTIR CONFIGURAÇÃO
// =====================================================

async function garantirConfiguracao(guildId) {
    let config = await buscarConfiguracao(guildId);

    if (!config) {
        await salvarRegistroConfig(
            guildId,
            null,
            null,
            1,
            false
        );

        config = await buscarConfiguracao(guildId);
    }

    if (!config) {
        throw new Error(
            "Não foi possível criar a configuração do sistema de registro."
        );
    }

    const paginas = await buscarPaginas(guildId);

    if (!paginas.length) {
        await criarRegistroPagina(
            guildId,
            1,
            {
                titulo: "Registro",
                descricao:
                    "Configure esta página do sistema de registro.",
                rodape: null,
                rodape_icone: null
            }
        );
    }

    return config;
}

// =====================================================
// 🧹 URL VÁLIDA
// =====================================================

function urlValida(valor) {
    if (!valor) {
        return false;
    }

    try {
        const url = new URL(String(valor).trim());

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );
    } catch {
        return false;
    }
}

// =====================================================
// 🎨 EMBED DA PÁGINA
// =====================================================

function criarEmbedPagina(pagina) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2);

    if (pagina.titulo) {
        embed.setTitle(
            String(pagina.titulo).substring(0, 256)
        );
    }

    if (pagina.descricao) {
        embed.setDescription(
            String(pagina.descricao).substring(0, 4096)
        );
    }

    if (pagina.rodape) {
        const textoRodape =
            String(pagina.rodape).substring(0, 2048);

        if (
            pagina.rodape_icone &&
            urlValida(pagina.rodape_icone)
        ) {
            embed.setFooter({
                text: textoRodape,
                iconURL: String(pagina.rodape_icone)
            });
        } else {
            embed.setFooter({
                text: textoRodape
            });
        }
    }

    return embed;
}

// =====================================================
// 🎨 PAINEL INICIAL
// =====================================================

function criarEmbedPainelInicial(config) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2);

    const titulo =
        config?.painel_titulo ||
        "📝 Registro";

    const descricao =
        config?.painel_descricao ||
        "Clique no botão abaixo para começar seu registro.";

    embed.setTitle(
        String(titulo).substring(0, 256)
    );

    embed.setDescription(
        String(descricao).substring(0, 4096)
    );

    if (
        config?.painel_imagem &&
        urlValida(config.painel_imagem)
    ) {
        embed.setImage(
            String(config.painel_imagem)
        );
    }

    if (
        config?.painel_thumbnail &&
        urlValida(config.painel_thumbnail)
    ) {
        embed.setThumbnail(
            String(config.painel_thumbnail)
        );
    }

    if (config?.painel_rodape) {
        embed.setFooter({
            text: String(config.painel_rodape)
                .substring(0, 2048)
        });
    }

    return embed;
}

// =====================================================
// 🔘 BOTÃO DO PAINEL INICIAL
// =====================================================

function criarComponentesPainelInicial(
    guildId,
    config
) {
    const texto =
        config?.painel_botao_texto ||
        "Registrar";

    const botao =
        new ButtonBuilder()
            .setCustomId(
                `registro_iniciar_${guildId}`
            )
            .setLabel(
                String(texto).substring(0, 80)
            )
            .setEmoji("📝")
            .setStyle(ButtonStyle.Primary);

    return [
        new ActionRowBuilder()
            .addComponents(botao)
    ];
}

// =====================================================
// 🔘 COMPONENTES DA PÁGINA
// =====================================================

async function criarComponentesPagina(
    pagina,
    guildId,
    numeroPagina
) {
    const botoes = await buscarBotoes(pagina.id);

    const rows = [];

    let row = new ActionRowBuilder();

    for (
        const botao of botoes.slice(0, MAX_BOTOES)
    ) {
        const estilo =
            String(
                botao.estilo || "PRIMARY"
            ).toUpperCase();

        const button =
            new ButtonBuilder()
                .setCustomId(
                    botao.custom_id ||
                    `registro_botao_${botao.id}`
                )
                .setLabel(
                    String(
                        botao.texto || "Registrar"
                    ).substring(0, 80)
                )
                .setStyle(
                    ESTILOS_BOTOES[estilo] ||
                    ButtonStyle.Primary
                );

        if (botao.emoji) {
            try {
                button.setEmoji(
                    String(botao.emoji)
                );
            } catch {
                console.warn(
                    `⚠️ Emoji inválido no botão ${botao.id}.`
                );
            }
        }

        row.addComponents(button);

        if (row.components.length >= 5) {
            rows.push(row);
            row = new ActionRowBuilder();
        }
    }

    if (row.components.length > 0) {
        rows.push(row);
    }

    const paginas = await buscarPaginas(guildId);

    if (paginas.length > 1) {
        const navegacao =
            new ActionRowBuilder();

        const paginaAtual =
            Number(numeroPagina);

        const anterior =
            new ButtonBuilder()
                .setCustomId(
                    `registro_pagina_${guildId}_${Math.max(
                        1,
                        paginaAtual - 1
                    )}`
                )
                .setLabel("Anterior")
                .setEmoji("◀️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(paginaAtual <= 1);

        const proxima =
            new ButtonBuilder()
                .setCustomId(
                    `registro_pagina_${guildId}_${Math.min(
                        paginas.length,
                        paginaAtual + 1
                    )}`
                )
                .setLabel("Próxima")
                .setEmoji("▶️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(
                    paginaAtual >= paginas.length
                );

        navegacao.addComponents(
            anterior,
            proxima
        );

        rows.push(navegacao);
    }

    return rows;
}

// =====================================================
// 📤 ATUALIZAR PAINEL PÚBLICO
// =====================================================

async function atualizarMensagemRegistro(
    guild,
    config
) {
    if (
        !config ||
        !config.canal_id ||
        !config.mensagem_id
    ) {
        return false;
    }

    try {
        const canal =
            await guild.channels.fetch(
                config.canal_id
            );

        if (
            !canal ||
            !canal.isTextBased()
        ) {
            return false;
        }

        const mensagem =
            await canal.messages.fetch(
                config.mensagem_id
            );

        const embed =
            criarEmbedPainelInicial(config);

        const components =
            criarComponentesPainelInicial(
                guild.id,
                config
            );

        await mensagem.edit({
            embeds: [embed],
            components
        });

        return true;
    } catch (erro) {
        console.error(
            "❌ Erro ao atualizar painel de registro:",
            erro
        );

        return false;
    }
}

// =====================================================
// 🔄 ATUALIZAR PUBLICAÇÃO
// =====================================================

async function atualizarPublicacaoSeExistir(
    interaction,
    guildId
) {
    const config =
        await buscarConfiguracao(guildId);

    if (
        !config ||
        !config.canal_id ||
        !config.mensagem_id
    ) {
        return false;
    }

    return await atualizarMensagemRegistro(
        interaction.guild,
        config
    );
}

// =====================================================
// 📝 PAINEL PRINCIPAL
// =====================================================

async function mostrarPainel(interaction) {
    const config =
        await garantirConfiguracao(
            interaction.guild.id
        );

    const paginas =
        await buscarPaginas(
            interaction.guild.id
        );

    const configurado =
        Boolean(config.configurado);

    const embed =
        new EmbedBuilder()
            .setTitle("📝 Sistema de Registro")
            .setDescription(
                [
                    "Configure o sistema de registro do servidor.",
                    "",
                    `📄 Páginas: **${paginas.length}/${MAX_PAGINAS}**`,
                    `📢 Status: **${
                        configurado
                            ? "Configurado"
                            : "Não publicado"
                    }**`,
                    `📺 Canal: ${
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "Não definido"
                    }`,
                    "",
                    `🎨 Painel inicial: **${
                        config.painel_titulo
                            ? "Configurado"
                            : "Padrão"
                    }**`,
                    "",
                    "Configure primeiro o painel inicial e o canal onde ele será publicado."
                ].join("\n")
            )
            .setColor(
                configurado
                    ? 0x57F287
                    : 0x5865F2
            );

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `registro_selecionar_pagina_${interaction.guild.id}`
            )
            .setPlaceholder("📄 Escolha uma página");

    for (const pagina of paginas) {
        menu.addOptions({
            label:
                `Página ${pagina.pagina}`,
            description:
                String(
                    pagina.titulo ||
                    "Sem título"
                ).substring(0, 100),
            value:
                String(pagina.pagina)
        });
    }

    const rowMenu =
        new ActionRowBuilder()
            .addComponents(menu);

    const rowBotoes =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_painel_inicial_${interaction.guild.id}`
                    )
                    .setLabel("Painel inicial")
                    .setEmoji("🎨")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_canal_${interaction.guild.id}`
                    )
                    .setLabel("Selecionar canal")
                    .setEmoji("📺")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_botao_painel_${interaction.guild.id}`
                    )
                    .setLabel("Botão Registrar")
                    .setEmoji("🔘")
                    .setStyle(ButtonStyle.Secondary)
            );

    const rowPaginas =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_adicionar_pagina_${interaction.guild.id}`
                    )
                    .setLabel("Adicionar página")
                    .setEmoji("➕")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(
                        paginas.length >= MAX_PAGINAS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_publicar_${interaction.guild.id}`
                    )
                    .setLabel("Publicar / Atualizar")
                    .setEmoji("📢")
                    .setStyle(ButtonStyle.Primary)
            );

    const rowExcluir =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_excluir_${interaction.guild.id}`
                    )
                    .setLabel("Excluir configuração")
                    .setEmoji("🗑️")
                    .setStyle(ButtonStyle.Danger)
            );

    await interaction.reply({
        embeds: [embed],
        components: [
            rowMenu,
            rowBotoes,
            rowPaginas,
            rowExcluir
        ],
        flags: EPHEMERAL
    });
}

// =====================================================
// 🎨 MODAL PAINEL INICIAL
// =====================================================

async function abrirModalPainelInicial(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    if (!config) {
        return interaction.reply({
            content:
                "❌ Configuração não encontrada.",
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_painel_inicial_${guildId}`
            )
            .setTitle("Painel inicial");

    const titulo =
        new TextInputBuilder()
            .setCustomId("painel_titulo")
            .setLabel("Título")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256);

    if (config.painel_titulo) {
        titulo.setValue(
            String(config.painel_titulo)
        );
    }

    const descricao =
        new TextInputBuilder()
            .setCustomId("painel_descricao")
            .setLabel("Descrição / explicação")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000);

    if (config.painel_descricao) {
        descricao.setValue(
            String(config.painel_descricao)
        );
    }

    const imagem =
        new TextInputBuilder()
            .setCustomId("painel_imagem")
            .setLabel("URL da imagem")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (config.painel_imagem) {
        imagem.setValue(
            String(config.painel_imagem)
        );
    }

    const thumbnail =
        new TextInputBuilder()
            .setCustomId("painel_thumbnail")
            .setLabel("URL da thumbnail")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (config.painel_thumbnail) {
        thumbnail.setValue(
            String(config.painel_thumbnail)
        );
    }

    const rodape =
        new TextInputBuilder()
            .setCustomId("painel_rodape")
            .setLabel("Rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (config.painel_rodape) {
        rodape.setValue(
            String(config.painel_rodape)
        );
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(titulo),
        new ActionRowBuilder().addComponents(descricao),
        new ActionRowBuilder().addComponents(imagem),
        new ActionRowBuilder().addComponents(thumbnail),
        new ActionRowBuilder().addComponents(rodape)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🔘 MODAL TEXTO DO BOTÃO
// =====================================================

async function abrirModalTextoBotaoPainel(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_botao_painel_${guildId}`
            )
            .setTitle("Botão do painel");

    const texto =
        new TextInputBuilder()
            .setCustomId("painel_botao_texto")
            .setLabel("Texto do botão")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(80)
            .setValue(
                String(
                    config?.painel_botao_texto ||
                    "Registrar"
                )
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(texto)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 📺 SELECIONAR CANAL
// =====================================================

async function mostrarSelecaoCanal(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    const embed =
        new EmbedBuilder()
            .setTitle(
                "📺 Canal do painel de registro"
            )
            .setDescription(
                [
                    "Selecione abaixo o canal onde o painel inicial será publicado.",
                    "",
                    `Canal atual: ${
                        config?.canal_id
                            ? `<#${config.canal_id}>`
                            : "Nenhum"
                    }`
                ].join("\n")
            )
            .setColor(0x5865F2);

    const menu =
        new ChannelSelectMenuBuilder()
            .setCustomId(
                `registro_selecionar_canal_${guildId}`
            )
            .setPlaceholder("📺 Escolha o canal")
            .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
            )
            .setMinValues(1)
            .setMaxValues(1);

    const row =
        new ActionRowBuilder()
            .addComponents(menu);

    await interaction.update({
        embeds: [embed],
        components: [row]
    });
}

// =====================================================
// 📄 CONFIGURAÇÃO DA PÁGINA
// =====================================================

async function mostrarConfiguracaoPagina(
    interaction,
    guildId,
    numeroPagina
) {
    if (!pertenceAoServidor(interaction, guildId)) {
        return interaction.reply({
            content:
                "❌ Essa interação não pertence a este servidor.",
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                "❌ Essa página não existe.",
            flags: EPHEMERAL
        });
    }

    const botoes =
        await buscarBotoes(pagina.id);

    const embed =
        new EmbedBuilder()
            .setTitle(
                `📄 Configuração — Página ${numeroPagina}`
            )
            .setDescription(
                [
                    `**Título:** ${
                        pagina.titulo ||
                        "Não definido"
                    }`,
                    `**Descrição:** ${
                        pagina.descricao ||
                        "Não definida"
                    }`,
                    `**Rodapé:** ${
                        pagina.rodape ||
                        "Não definido"
                    }`,
                    `**Ícone do rodapé:** ${
                        pagina.rodape_icone ||
                        "Não definido"
                    }`,
                    "",
                    `🔘 Botões: **${botoes.length}/${MAX_BOTOES}**`
                ].join("\n")
            )
            .setColor(0x5865F2);

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_editar_texto_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Título / Descrição")
                    .setEmoji("📝")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_editar_rodape_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Rodapé")
                    .setEmoji("🔻")
                    .setStyle(ButtonStyle.Secondary)
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_adicionar_botao_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Adicionar botão")
                    .setEmoji("🔘")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(
                        botoes.length >= MAX_BOTOES
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_botoes_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Editar botões")
                    .setEmoji("⚙️")
                    .setStyle(ButtonStyle.Primary)
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_voltar_${guildId}`
                    )
                    .setLabel("Voltar")
                    .setEmoji("◀️")
                    .setStyle(ButtonStyle.Secondary)
            );

    await interaction.update({
        embeds: [embed],
        components: [
            row1,
            row2,
            row3
        ]
    });
}

// =====================================================
// 📝 MODAL TÍTULO / DESCRIÇÃO
// =====================================================

async function abrirModalTexto(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                "❌ Página não encontrada.",
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_texto_${guildId}_${numeroPagina}`
            )
            .setTitle(
                `Editar página ${numeroPagina}`
            );

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256);

    if (pagina.titulo) {
        titulo.setValue(
            String(pagina.titulo)
        );
    }

    const descricao =
        new TextInputBuilder()
            .setCustomId("descricao")
            .setLabel("Descrição")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000);

    if (pagina.descricao) {
        descricao.setValue(
            String(pagina.descricao)
        );
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(titulo),
        new ActionRowBuilder().addComponents(descricao)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🔻 MODAL RODAPÉ
// =====================================================

async function abrirModalRodape(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                "❌ Página não encontrada.",
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_rodape_${guildId}_${numeroPagina}`
            )
            .setTitle(
                `Rodapé — Página ${numeroPagina}`
            );

    const rodape =
        new TextInputBuilder()
            .setCustomId("rodape")
            .setLabel("Texto do rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (pagina.rodape) {
        rodape.setValue(
            String(pagina.rodape)
        );
    }

    const icone =
        new TextInputBuilder()
            .setCustomId("rodape_icone")
            .setLabel("URL do ícone do rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (pagina.rodape_icone) {
        icone.setValue(
            String(pagina.rodape_icone)
        );
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(rodape),
        new ActionRowBuilder().addComponents(icone)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🔘 MODAL NOVO BOTÃO
// =====================================================

async function abrirModalBotao(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                "❌ Página não encontrada.",
            flags: EPHEMERAL
        });
    }

    const botoes =
        await buscarBotoes(pagina.id);

    if (botoes.length >= MAX_BOTOES) {
        return interaction.reply({
            content:
                `❌ Cada página pode ter no máximo ${MAX_BOTOES} botões.`,
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_botao_${guildId}_${numeroPagina}`
            )
            .setTitle(
                `Novo botão — Página ${numeroPagina}`
            );

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto do botão")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(80);

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji (opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100);

    const cargo =
        new TextInputBuilder()
            .setCustomId("cargo")
            .setLabel("ID do cargo (opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(30);

    const estilo =
        new TextInputBuilder()
            .setCustomId("estilo")
            .setLabel(
                "PRIMARY / SECONDARY / SUCCESS / DANGER"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue("PRIMARY")
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder().addComponents(texto),
        new ActionRowBuilder().addComponents(emoji),
        new ActionRowBuilder().addComponents(cargo),
        new ActionRowBuilder().addComponents(estilo)
    );

    await interaction.showModal(modal);
}

// =====================================================
// ⚙️ PAINEL DE BOTÕES
// =====================================================

async function mostrarBotoes(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                "❌ Página não encontrada.",
            flags: EPHEMERAL
        });
    }

    const botoes =
        await buscarBotoes(pagina.id);

    const embed =
        new EmbedBuilder()
            .setTitle(
                `🔘 Botões — Página ${numeroPagina}`
            )
            .setDescription(
                botoes.length
                    ? botoes
                        .map(
                            (botao, index) =>
                                [
                                    `**${index + 1}. ${botao.texto}**`,
                                    `🎭 Cargo: ${
                                        botao.cargo_id
                                            ? `<@&${botao.cargo_id}>`
                                            : "Nenhum"
                                    }`,
                                    `🎨 Estilo: ${
                                        botao.estilo ||
                                        "PRIMARY"
                                    }`
                                ].join("\n")
                        )
                        .join("\n\n")
                    : "Nenhum botão configurado."
            )
            .setColor(0x5865F2);

    const components = [];

    const linhaEditar =
        new ActionRowBuilder();

    for (
        const botao of botoes.slice(0, MAX_BOTOES)
    ) {
        linhaEditar.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `registro_editar_botao_${guildId}_${botao.id}_${numeroPagina}`
                )
                .setLabel(
                    `✏️ ${String(
                        botao.texto ||
                        "Botão"
                    ).substring(0, 70)}`
                )
                .setStyle(ButtonStyle.Primary)
        );
    }

    if (linhaEditar.components.length) {
        components.push(linhaEditar);
    }

    const linhaExcluir =
        new ActionRowBuilder();

    for (
        const botao of botoes.slice(0, MAX_BOTOES)
    ) {
        linhaExcluir.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `registro_excluir_botao_${guildId}_${botao.id}_${numeroPagina}`
                )
                .setLabel(
                    `🗑️ ${String(
                        botao.texto ||
                        "Botão"
                    ).substring(0, 70)}`
                )
                .setStyle(ButtonStyle.Danger)
        );
    }

    if (linhaExcluir.components.length) {
        components.push(linhaExcluir);
    }

    components.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_voltar_pagina_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Voltar")
                    .setEmoji("◀️")
                    .setStyle(ButtonStyle.Secondary)
            )
    );

    await interaction.update({
        embeds: [embed],
        components
    });
}

// =====================================================
// ✏️ MODAL EDITAR BOTÃO
// =====================================================

async function abrirModalEditarBotao(
    interaction,
    guildId,
    botaoId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                "❌ Página não encontrada.",
            flags: EPHEMERAL
        });
    }

    const botoes =
        await buscarBotoes(pagina.id);

    const botao =
        botoes.find(
            item =>
                String(item.id) ===
                String(botaoId)
        );

    if (!botao) {
        return interaction.reply({
            content:
                "❌ Esse botão não existe nesta página.",
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_editar_botao_${guildId}_${botaoId}_${numeroPagina}`
            )
            .setTitle("Editar botão");

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(80)
            .setValue(
                String(botao.texto || "")
            );

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100);

    if (botao.emoji) {
        emoji.setValue(
            String(botao.emoji)
        );
    }

    const cargo =
        new TextInputBuilder()
            .setCustomId("cargo")
            .setLabel(
                "ID do cargo — deixe vazio para nenhum"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(30);

    if (botao.cargo_id) {
        cargo.setValue(
            String(botao.cargo_id)
        );
    }

    const estilo =
        new TextInputBuilder()
            .setCustomId("estilo")
            .setLabel(
                "PRIMARY / SECONDARY / SUCCESS / DANGER"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    botao.estilo ||
                    "PRIMARY"
                ).toUpperCase()
            )
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder().addComponents(texto),
        new ActionRowBuilder().addComponents(emoji),
        new ActionRowBuilder().addComponents(cargo),
        new ActionRowBuilder().addComponents(estilo)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🎭 VALIDAR CARGO
// =====================================================

function obterCargoConfigurado(
    interaction,
    cargoTexto
) {
    if (!cargoTexto) {
        return {
            id: null,
            erro: null
        };
    }

    const cargoId =
        String(cargoTexto).trim();

    if (!/^\d{15,25}$/.test(cargoId)) {
        return {
            id: null,
            erro:
                "❌ O ID do cargo informado é inválido."
        };
    }

    const cargo =
        interaction.guild.roles.cache.get(
            cargoId
        );

    if (!cargo) {
        return {
            id: null,
            erro:
                "❌ Não encontrei esse cargo no servidor."
        };
    }

    if (cargo.managed) {
        return {
            id: null,
            erro:
                "❌ Esse cargo é gerenciado por uma integração e não pode ser atribuído pelo bot."
        };
    }

    return {
        id: cargo.id,
        erro: null
    };
}

// =====================================================
// 📢 PUBLICAR
// =====================================================

async function publicarRegistro(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    let config =
        await buscarConfiguracao(guildId);

    if (!config) {
        config =
            await garantirConfiguracao(guildId);
    }

    if (!config.canal_id) {
        return interaction.reply({
            content:
                "❌ Primeiro selecione o canal onde o painel de registro será publicado.",
            flags: EPHEMERAL
        });
    }

    const canal =
        await interaction.guild.channels
            .fetch(config.canal_id)
            .catch(() => null);

    if (
        !canal ||
        !canal.isTextBased()
    ) {
        return interaction.reply({
            content:
                "❌ O canal configurado não existe ou não é um canal de texto.",
            flags: EPHEMERAL
        });
    }

    if (config.mensagem_id) {
        const atualizado =
            await atualizarMensagemRegistro(
                interaction.guild,
                config
            );

        if (atualizado) {
            await pool.query(
                `
                UPDATE registro_config
                SET configurado = TRUE,
                    atualizado_em = $1
                WHERE guild_id = $2
                `,
                [
                    Date.now(),
                    guildId
                ]
            );

            return interaction.reply({
                content:
                    "✅ Painel de registro atualizado com sucesso!",
                flags: EPHEMERAL
            });
        }
    }

    const embed =
        criarEmbedPainelInicial(config);

    const components =
        criarComponentesPainelInicial(
            guildId,
            config
        );

    const mensagem =
        await canal.send({
            embeds: [embed],
            components
        });

    const paginas =
        await buscarPaginas(guildId);

    await salvarRegistroConfig(
        guildId,
        canal.id,
        mensagem.id,
        Math.max(1, paginas.length),
        true
    );

    await salvarMensagemRegistro(
        guildId,
        mensagem.id
    );

    await interaction.reply({
        content:
            `✅ Painel de registro publicado em <#${canal.id}>!`,
        flags: EPHEMERAL
    });
}

// =====================================================
// 🆕 ADICIONAR PÁGINA
// =====================================================

async function adicionarPagina(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para configurar o registro.",
            flags: EPHEMERAL
        });
    }

    await garantirConfiguracao(guildId);

    const paginas =
        await buscarPaginas(guildId);

    if (paginas.length >= MAX_PAGINAS) {
        return interaction.reply({
            content:
                `❌ O limite máximo é de ${MAX_PAGINAS} páginas.`,
            flags: EPHEMERAL
        });
    }

    const numero =
        paginas.length + 1;

    await criarRegistroPagina(
        guildId,
        numero,
        {
            titulo: `Página ${numero}`,
            descricao: "Configure esta página.",
            rodape: null,
            rodape_icone: null
        }
    );

    await pool.query(
        `
        UPDATE registro_config
        SET paginas = $1,
            atualizado_em = $2
        WHERE guild_id = $3
        `,
        [
            numero,
            Date.now(),
            guildId
        ]
    );

    await atualizarPublicacaoSeExistir(
        interaction,
        guildId
    );

    await interaction.reply({
        content:
            `✅ Página ${numero} criada!`,
        flags: EPHEMERAL
    });
}

// =====================================================
// 🗑️ EXCLUIR CONFIGURAÇÃO
// =====================================================

async function excluirRegistro(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                "❌ Você não tem permissão para excluir o registro.",
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    if (!config) {
        return interaction.reply({
            content:
                "❌ Nenhum sistema de registro encontrado.",
            flags: EPHEMERAL
        });
    }

    if (
        config.canal_id &&
        config.mensagem_id
    ) {
        try {
            const canal =
                await interaction.guild.channels.fetch(
                    config.canal_id
                );

            if (
                canal &&
                canal.isTextBased()
            ) {
                const mensagem =
                    await canal.messages
                        .fetch(config.mensagem_id)
                        .catch(() => null);

                if (mensagem) {
                    await mensagem.delete()
                        .catch(() => {});
                }
            }
        } catch {}
    }

    await pool.query(
        `
        DELETE FROM registro_usuarios
        WHERE guild_id = $1
        `,
        [guildId]
    );

    await pool.query(
        `
        DELETE b
        FROM registro_botoes b
        INNER JOIN registro_paginas p
            ON p.id = b.pagina_id
        WHERE p.guild_id = $1
        `,
        [guildId]
    );

    await pool.query(
        `
        DELETE FROM registro_paginas
        WHERE guild_id = $1
        `,
        [guildId]
    );

    await pool.query(
        `
        DELETE FROM registro_config
        WHERE guild_id = $1
        `,
        [guildId]
    );

    await interaction.reply({
        content:
            "🗑️ Sistema de registro excluído com sucesso.",
        flags: EPHEMERAL
    });
}

// =====================================================
// 📝 INICIAR REGISTRO PRIVADO
// =====================================================

async function iniciarRegistroPrivado(
    interaction,
    guildId
) {
    if (!pertenceAoServidor(interaction, guildId)) {
        return interaction.reply({
            content:
                "❌ Esse registro não pertence a este servidor.",
            flags: EPHEMERAL
        });
    }

    const jaRegistrado =
        await usuarioJaRegistrado(
            interaction.guild.id,
            interaction.user.id
        );

    if (jaRegistrado) {
        return interaction.reply({
            content:
                "ℹ️ Você já fez este registro.",
            flags: EPHEMERAL
        });
    }

    const paginas =
        await buscarPaginas(guildId);

    if (!paginas.length) {
        return interaction.reply({
            content:
                "❌ Nenhuma página de registro foi configurada.",
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(guildId, 1);

    if (!pagina) {
        return interaction.reply({
            content:
                "❌ A primeira página do registro não existe.",
            flags: EPHEMERAL
        });
    }

    const embed =
        criarEmbedPagina(pagina);

    const components =
        await criarComponentesPagina(
            pagina,
            guildId,
            1
        );

    await interaction.reply({
        embeds: [embed],
        components,
        flags: EPHEMERAL
    });
}

// =====================================================
// 🎯 PROCESSAR BOTÃO DE REGISTRO
// =====================================================

async function processarBotaoRegistro(
    interaction
) {
    const customId =
        interaction.customId;

    const resultado =
        await pool.query(
            `
            SELECT
                b.*,
                p.guild_id,
                p.pagina,
                p.id AS pagina_id
            FROM registro_botoes b
            INNER JOIN registro_paginas p
                ON p.id = b.pagina_id
            WHERE b.custom_id = $1
            LIMIT 1
            `,
            [customId]
        );

    const botao =
        resultado.rows &&
        resultado.rows[0];

    if (!botao) {
        return interaction.reply({
            content:
                "❌ Esse botão não está mais disponível.",
            flags: EPHEMERAL
        });
    }

    if (
        String(botao.guild_id) !==
        String(interaction.guild.id)
    ) {
        return interaction.reply({
            content:
                "❌ Esse botão não pertence a este servidor.",
            flags: EPHEMERAL
        });
    }

    const jaRegistrado =
        await usuarioJaRegistrado(
            interaction.guild.id,
            interaction.user.id
        );

    if (jaRegistrado) {
        return interaction.reply({
            content:
                "ℹ️ Você já fez este registro.",
            flags: EPHEMERAL
        });
    }

    let cargoRecebido = null;

    if (botao.cargo_id) {
        const cargo =
            interaction.guild.roles.cache.get(
                String(botao.cargo_id)
            );

        if (!cargo) {
            return interaction.reply({
                content:
                    "❌ O cargo configurado para este botão não existe mais.",
                flags: EPHEMERAL
            });
        }

        const membro =
            await interaction.guild.members.fetch(
                interaction.user.id
            );

        const botMember =
            interaction.guild.members.me;

        if (!botMember) {
            return interaction.reply({
                content:
                    "❌ Não consegui verificar as permissões do bot.",
                flags: EPHEMERAL
            });
        }

        if (
            !botMember.permissions.has(
                PermissionFlagsBits.ManageRoles
            )
        ) {
            return interaction.reply({
                content:
                    "❌ Eu não tenho a permissão **Gerenciar Cargos**.",
                flags: EPHEMERAL
            });
        }

        if (
            cargo.managed ||
            cargo.position >=
                botMember.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    "❌ Não consigo adicionar esse cargo porque ele está acima ou no mesmo nível do meu maior cargo.",
                flags: EPHEMERAL
            });
        }

        try {
            await membro.roles.add(cargo);

            cargoRecebido =
                cargo.id;
        } catch (erro) {
            console.error(
                "❌ Erro ao dar cargo do registro:",
                erro
            );

            return interaction.reply({
                content:
                    "❌ Não consegui adicionar o cargo configurado para este botão.",
                flags: EPHEMERAL
            });
        }
    }

    try {
        await registrarUsuario(
            interaction.guild.id,
            interaction.user.id,
            botao.pagina_id,
            botao.id,
            cargoRecebido
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao salvar usuário registrado:",
            erro
        );

        const agoraRegistrado =
            await usuarioJaRegistrado(
                interaction.guild.id,
                interaction.user.id
            ).catch(() => false);

        if (agoraRegistrado) {
            return interaction.reply({
                content:
                    "ℹ️ Você já fez este registro.",
                flags: EPHEMERAL
            });
        }

        return interaction.reply({
            content:
                "❌ Ocorreu um erro ao salvar seu registro.",
            flags: EPHEMERAL
        });
    }

    await interaction.reply({
        content:
            cargoRecebido
                ? "✅ Registro concluído! Seu cargo foi adicionado."
                : "✅ Registro concluído com sucesso!",
        flags: EPHEMERAL
    });
}

// =====================================================
// 🧰 PAINEL PRINCIPAL
// =====================================================

async function atualizarPainelPrincipal(
    interaction,
    guildId
) {
    const paginas =
        await buscarPaginas(guildId);

    const config =
        await buscarConfiguracao(guildId);

    const embed =
        new EmbedBuilder()
            .setTitle("📝 Sistema de Registro")
            .setDescription(
                [
                    `📄 Páginas: **${paginas.length}/${MAX_PAGINAS}**`,
                    `📢 Status: **${
                        config &&
                        config.configurado
                            ? "Configurado"
                            : "Não publicado"
                    }**`,
                    `📺 Canal: ${
                        config &&
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "Não definido"
                    }`,
                    "",
                    `🎨 Painel inicial: **${
                        config &&
                        config.painel_titulo
                            ? "Configurado"
                            : "Padrão"
                    }**`,
                    "",
                    "Selecione uma página para editar."
                ].join("\n")
            )
            .setColor(
                config &&
                config.configurado
                    ? 0x57F287
                    : 0x5865F2
            );

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `registro_selecionar_pagina_${guildId}`
            )
            .setPlaceholder("📄 Escolha uma página");

    for (const pagina of paginas) {
        menu.addOptions({
            label:
                `Página ${pagina.pagina}`,
            description:
                String(
                    pagina.titulo ||
                    "Sem título"
                ).substring(0, 100),
            value:
                String(pagina.pagina)
        });
    }

    const rowMenu =
        new ActionRowBuilder()
            .addComponents(menu);

    const rowBotoes =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_painel_inicial_${guildId}`
                    )
                    .setLabel("Painel inicial")
                    .setEmoji("🎨")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_canal_${guildId}`
                    )
                    .setLabel("Selecionar canal")
                    .setEmoji("📺")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_botao_painel_${guildId}`
                    )
                    .setLabel("Botão Registrar")
                    .setEmoji("🔘")
                    .setStyle(ButtonStyle.Secondary)
            );

    const rowPaginas =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_adicionar_pagina_${guildId}`
                    )
                    .setLabel("Adicionar página")
                    .setEmoji("➕")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(
                        paginas.length >= MAX_PAGINAS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_publicar_${guildId}`
                    )
                    .setLabel("Publicar / Atualizar")
                    .setEmoji("📢")
                    .setStyle(ButtonStyle.Primary)
            );

    const rowExcluir =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_excluir_${guildId}`
                    )
                    .setLabel("Excluir configuração")
                    .setEmoji("🗑️")
                    .setStyle(ButtonStyle.Danger)
            );

    return interaction.update({
        embeds: [embed],
        components: [
            rowMenu,
            rowBotoes,
            rowPaginas,
            rowExcluir
        ]
    });
}

// =====================================================
// 🖱️ INTERAÇÕES
// =====================================================

async function handleInteraction(interaction) {
    try {
        if (!interaction.guild) {
            return false;
        }

        const customId =
            interaction.customId || "";

        // =================================================
        // 📝 INICIAR REGISTRO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_iniciar_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_iniciar_",
                    ""
                );

            return await iniciarRegistroPrivado(
                interaction,
                guildId
            );
        }

        // =================================================
        // 🔘 BOTÃO DE REGISTRO
        // =================================================
        // IMPORTANTE:
        // registro_botao_painel_ também começa com
        // registro_botao_, então ele precisa ser excluído
        // daqui para não ser tratado como botão de registro.

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_botao_"
            ) &&
            !customId.startsWith(
                "registro_botao_painel_"
            )
        ) {
            return await processarBotaoRegistro(
                interaction
            );
        }

        // =================================================
        // 📄 NAVEGAÇÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_pagina_"
            )
        ) {
            const partes =
                customId.split("_");

            if (partes.length < 4) {
                return interaction.reply({
                    content:
                        "❌ Botão de navegação inválido.",
                    flags: EPHEMERAL
                });
            }

            const guildId =
                partes[2];

            const numeroPagina =
                Number(partes[3]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const paginas =
                await buscarPaginas(guildId);

            if (!paginas.length) {
                return interaction.reply({
                    content:
                        "❌ Nenhuma página encontrada.",
                    flags: EPHEMERAL
                });
            }

            const paginaSegura =
                Math.max(
                    1,
                    Math.min(
                        paginas.length,
                        numeroPagina
                    )
                );

            const pagina =
                await buscarPagina(
                    guildId,
                    paginaSegura
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Página não encontrada.",
                    flags: EPHEMERAL
                });
            }

            const embed =
                criarEmbedPagina(pagina);

            const components =
                await criarComponentesPagina(
                    pagina,
                    guildId,
                    paginaSegura
                );

            return interaction.update({
                embeds: [embed],
                components
            });
        }

        // =================================================
        // 🔐 ADMINISTRATIVOS
        // =================================================

        const idsAdministrativos = [
            "registro_painel_inicial_",
            "registro_botao_painel_",
            "registro_canal_",
            "registro_selecionar_canal_",
            "registro_modal_painel_inicial_",
            "registro_modal_botao_painel_",
            "registro_adicionar_pagina_",
            "registro_publicar_",
            "registro_excluir_",
            "registro_selecionar_pagina_",
            "registro_editar_texto_",
            "registro_editar_rodape_",
            "registro_adicionar_botao_",
            "registro_botoes_",
            "registro_editar_botao_",
            "registro_excluir_botao_",
            "registro_voltar_",
            "registro_modal_texto_",
            "registro_modal_rodape_",
            "registro_modal_botao_",
            "registro_modal_editar_botao_"
        ];

        const ehAdministrativo =
            idsAdministrativos.some(
                prefixo =>
                    customId.startsWith(prefixo)
            );

        if (
            ehAdministrativo &&
            !podeConfigurar(interaction)
        ) {
            return interaction.reply({
                content:
                    "❌ Você precisa da permissão **Gerenciar Servidor** para configurar o sistema de registro.",
                flags: EPHEMERAL
            });
        }

        // =================================================
        // 🎨 PAINEL INICIAL
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_painel_inicial_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_painel_inicial_",
                    ""
                );

            return await abrirModalPainelInicial(
                interaction,
                guildId
            );
        }

        // =================================================
        // 🔘 BOTÃO DO PAINEL
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_botao_painel_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_botao_painel_",
                    ""
                );

            return await abrirModalTextoBotaoPainel(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📺 CANAL
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_canal_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_canal_",
                    ""
                );

            return await mostrarSelecaoCanal(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📺 SALVAR CANAL
        // =================================================

        if (
            interaction.isChannelSelectMenu() &&
            customId.startsWith(
                "registro_selecionar_canal_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_selecionar_canal_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const canalId =
                interaction.values[0];

            const canal =
                await interaction.guild.channels
                    .fetch(canalId)
                    .catch(() => null);

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        "❌ Esse canal não pode receber o painel.",
                    flags: EPHEMERAL
                });
            }

            await pool.query(
                `
                UPDATE registro_config
                SET canal_id = $1,
                    atualizado_em = $2
                WHERE guild_id = $3
                `,
                [
                    canalId,
                    Date.now(),
                    guildId
                ]
            );

            await interaction.update({
                content:
                    `✅ Canal selecionado: <#${canalId}>`,
                embeds: [],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `registro_voltar_${guildId}`
                                )
                                .setLabel("Voltar")
                                .setEmoji("◀️")
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        ]
                ]
            });

            return;
        }

        // =================================================
        // ➕ ADICIONAR PÁGINA
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_adicionar_pagina_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_adicionar_pagina_",
                    ""
                );

            return await adicionarPagina(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📢 PUBLICAR
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_publicar_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_publicar_",
                    ""
                );

            return await publicarRegistro(
                interaction,
                guildId
            );
        }

        // =================================================
        // 🗑️ EXCLUIR
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_excluir_"
            ) &&
            !customId.startsWith(
                "registro_excluir_botao_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_excluir_",
                    ""
                );

            return await excluirRegistro(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📋 SELECIONAR PÁGINA
        // =================================================

        if (
            interaction.isStringSelectMenu() &&
            customId.startsWith(
                "registro_selecionar_pagina_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_selecionar_pagina_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const numeroPagina =
                Number(
                    interaction.values[0]
                );

            return await mostrarConfiguracaoPagina(
                interaction,
                guildId,
                numeroPagina
            );
        }

        // =================================================
        // 📝 EDITAR TEXTO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_editar_texto_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalTexto(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // 🔻 EDITAR RODAPÉ
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_editar_rodape_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalRodape(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // ➕ ADICIONAR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_adicionar_botao_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalBotao(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // ⚙️ BOTÕES
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_botoes_"
            )
        ) {
            const partes =
                customId.split("_");

            return await mostrarBotoes(
                interaction,
                partes[2],
                Number(partes[3])
            );
        }

        // =================================================
        // ✏️ EDITAR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_editar_botao_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalEditarBotao(
                interaction,
                partes[3],
                partes[4],
                Number(partes[5])
            );
        }

        // =================================================
        // 🗑️ EXCLUIR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_excluir_botao_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const botaoId =
                partes[4];

            const numeroPagina =
                Number(partes[5]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Essa página não existe.",
                    flags: EPHEMERAL
                });
            }

            const botoes =
                await buscarBotoes(
                    pagina.id
                );

            const botao =
                botoes.find(
                    item =>
                        String(item.id) ===
                        String(botaoId)
                );

            if (!botao) {
                return interaction.reply({
                    content:
                        "❌ Esse botão não existe nesta página.",
                    flags: EPHEMERAL
                });
            }

            await excluirRegistroBotao(
                botaoId
            );

            return await mostrarBotoes(
                interaction,
                guildId,
                numeroPagina
            );
        }

        // =================================================
        // ◀️ VOLTAR PARA PÁGINA
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_voltar_pagina_"
            )
        ) {
            const partes =
                customId.split("_");

            return await mostrarConfiguracaoPagina(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // ◀️ VOLTAR
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_voltar_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_voltar_",
                    ""
                );

            return await atualizarPainelPrincipal(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📝 MODAL PAINEL INICIAL
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_painel_inicial_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_modal_painel_inicial_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const titulo =
                interaction.fields
                    .getTextInputValue(
                        "painel_titulo"
                    )
                    .trim();

            const descricao =
                interaction.fields
                    .getTextInputValue(
                        "painel_descricao"
                    )
                    .trim();

            const imagem =
                interaction.fields
                    .getTextInputValue(
                        "painel_imagem"
                    )
                    .trim();

            const thumbnail =
                interaction.fields
                    .getTextInputValue(
                        "painel_thumbnail"
                    )
                    .trim();

            const rodape =
                interaction.fields
                    .getTextInputValue(
                        "painel_rodape"
                    )
                    .trim();

            if (
                imagem &&
                !urlValida(imagem)
            ) {
                return interaction.reply({
                    content:
                        "❌ A URL da imagem é inválida.",
                    flags: EPHEMERAL
                });
            }

            if (
                thumbnail &&
                !urlValida(thumbnail)
            ) {
                return interaction.reply({
                    content:
                        "❌ A URL da thumbnail é inválida.",
                    flags: EPHEMERAL
                });
            }

            await pool.query(
                `
                UPDATE registro_config
                SET painel_titulo = $1,
                    painel_descricao = $2,
                    painel_imagem = $3,
                    painel_thumbnail = $4,
                    painel_rodape = $5,
                    atualizado_em = $6
                WHERE guild_id = $7
                `,
                [
                    titulo ||
                        "📝 Registro",
                    descricao ||
                        "Clique no botão abaixo para começar seu registro.",
                    imagem || null,
                    thumbnail || null,
                    rodape || null,
                    Date.now(),
                    guildId
                ]
            );

            const config =
                await buscarConfiguracao(
                    guildId
                );

            await atualizarMensagemRegistro(
                interaction.guild,
                config
            );

            await interaction.reply({
                content:
                    "✅ Painel inicial atualizado!",
                flags: EPHEMERAL
            });

            return;
        }

        // =================================================
        // 🔘 MODAL BOTÃO DO PAINEL
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_botao_painel_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_modal_botao_painel_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const texto =
                interaction.fields
                    .getTextInputValue(
                        "painel_botao_texto"
                    )
                    .trim();

            await pool.query(
                `
                UPDATE registro_config
                SET painel_botao_texto = $1,
                    atualizado_em = $2
                WHERE guild_id = $3
                `,
                [
                    texto || "Registrar",
                    Date.now(),
                    guildId
                ]
            );

            const config =
                await buscarConfiguracao(
                    guildId
                );

            await atualizarMensagemRegistro(
                interaction.guild,
                config
            );

            await interaction.reply({
                content:
                    "✅ Texto do botão atualizado!",
                flags: EPHEMERAL
            });

            return;
        }

        // =================================================
        // 📝 MODAL TEXTO
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_texto_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(partes[4]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Página não encontrada.",
                    flags: EPHEMERAL
                });
            }

            const titulo =
                interaction.fields
                    .getTextInputValue("titulo")
                    .trim();

            const descricao =
                interaction.fields
                    .getTextInputValue("descricao")
                    .trim();

            await atualizarRegistroPagina(
                pagina.id,
                guildId,
                {
                    titulo:
                        titulo || null,
                    descricao:
                        descricao || null
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            await interaction.reply({
                content:
                    "✅ Título e descrição atualizados!",
                flags: EPHEMERAL
            });

            return;
        }

        // =================================================
        // 🔻 MODAL RODAPÉ
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_rodape_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(partes[4]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Página não encontrada.",
                    flags: EPHEMERAL
                });
            }

            const rodape =
                interaction.fields
                    .getTextInputValue("rodape")
                    .trim();

            const icone =
                interaction.fields
                    .getTextInputValue(
                        "rodape_icone"
                    )
                    .trim();

            if (
                icone &&
                !urlValida(icone)
            ) {
                return interaction.reply({
                    content:
                        "❌ A URL do ícone do rodapé é inválida.",
                    flags: EPHEMERAL
                });
            }

            await atualizarRegistroPagina(
                pagina.id,
                guildId,
                {
                    rodape:
                        rodape || null,
                    rodape_icone:
                        icone || null
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            await interaction.reply({
                content:
                    "✅ Rodapé atualizado!",
                flags: EPHEMERAL
            });

            return;
        }

        // =================================================
        // 🔘 MODAL NOVO BOTÃO
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_botao_"
            ) &&
            !customId.startsWith(
                "registro_modal_botao_painel_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(partes[4]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Página não encontrada.",
                    flags: EPHEMERAL
                });
            }

            const botoes =
                await buscarBotoes(
                    pagina.id
                );

            if (botoes.length >= MAX_BOTOES) {
                return interaction.reply({
                    content:
                        `❌ O limite é de ${MAX_BOTOES} botões por página.`,
                    flags: EPHEMERAL
                });
            }

            const texto =
                interaction.fields
                    .getTextInputValue("texto")
                    .trim();

            if (!texto) {
                return interaction.reply({
                    content:
                        "❌ O texto do botão não pode ficar vazio.",
                    flags: EPHEMERAL
                });
            }

            const emoji =
                interaction.fields
                    .getTextInputValue("emoji")
                    .trim();

            const cargo =
                interaction.fields
                    .getTextInputValue("cargo")
                    .trim();

            let estilo =
                interaction.fields
                    .getTextInputValue("estilo");

            estilo =
                String(
                    estilo || "PRIMARY"
                )
                    .toUpperCase()
                    .trim();

            if (!ESTILOS_BOTOES[estilo]) {
                estilo = "PRIMARY";
            }

            const cargoResultado =
                obterCargoConfigurado(
                    interaction,
                    cargo
                );

            if (cargoResultado.erro) {
                return interaction.reply({
                    content:
                        cargoResultado.erro,
                    flags: EPHEMERAL
                });
            }

            const customIdBotao =
                `registro_botao_${guildId}_${Date.now()}_${crypto
                    .randomBytes(5)
                    .toString("hex")}`;

            await criarRegistroBotao(
                pagina.id,
                {
                    texto,
                    emoji:
                        emoji || null,
                    estilo,
                    cargo_id:
                        cargoResultado.id,
                    custom_id:
                        customIdBotao,
                    ordem:
                        botoes.length + 1
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            await interaction.reply({
                content:
                    cargoResultado.id
                        ? `✅ Botão criado e configurado para dar <@&${cargoResultado.id}>.`
                        : "✅ Botão criado sem cargo.",
                flags: EPHEMERAL
            });

            return;
        }

        // =================================================
        // ✏️ MODAL EDITAR BOTÃO
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_editar_botao_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[4];

            const botaoId =
                partes[5];

            const numeroPagina =
                Number(partes[6]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Página não encontrada.",
                    flags: EPHEMERAL
                });
            }

            const botoes =
                await buscarBotoes(
                    pagina.id
                );

            const botao =
                botoes.find(
                    item =>
                        String(item.id) ===
                        String(botaoId)
                );

            if (!botao) {
                return interaction.reply({
                    content:
                        "❌ Esse botão não existe nesta página.",
                    flags: EPHEMERAL
                });
            }

            const texto =
                interaction.fields
                    .getTextInputValue("texto")
                    .trim();

            if (!texto) {
                return interaction.reply({
                    content:
                        "❌ O texto do botão não pode ficar vazio.",
                    flags: EPHEMERAL
                });
            }

            const emoji =
                interaction.fields
                    .getTextInputValue("emoji")
                    .trim();

            const cargo =
                interaction.fields
                    .getTextInputValue("cargo")
                    .trim();

            let estilo =
                interaction.fields
                    .getTextInputValue("estilo");

            estilo =
                String(
                    estilo || "PRIMARY"
                )
                    .toUpperCase()
                    .trim();

            if (!ESTILOS_BOTOES[estilo]) {
                estilo = "PRIMARY";
            }

            const cargoResultado =
                obterCargoConfigurado(
                    interaction,
                    cargo
                );

            if (cargoResultado.erro) {
                return interaction.reply({
                    content:
                        cargoResultado.erro,
                    flags: EPHEMERAL
                });
            }

            await atualizarRegistroBotao(
                botaoId,
                {
                    texto,
                    emoji:
                        emoji || null,
                    estilo,
                    cargo_id:
                        cargoResultado.id
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            await interaction.reply({
                content:
                    "✅ Botão atualizado!",
                flags: EPHEMERAL
            });

            return;
        }

        return false;

    } catch (erro) {
        console.error(
            "❌ Erro no sistema /registrar:",
            erro
        );

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            return interaction.followUp({
                content:
                    "❌ Ocorreu um erro no sistema de registro. Verifique o console do bot.",
                flags: EPHEMERAL
            }).catch(() => {});
        }

        return interaction.reply({
            content:
                "❌ Ocorreu um erro no sistema de registro. Verifique o console do bot.",
            flags: EPHEMERAL
        }).catch(() => {});
    }
}

// =====================================================
// 📦 COMANDO
// =====================================================

const data =
    new SlashCommandBuilder()
        .setName("registrar")
        .setDescription(
            "Cria e configura o sistema de registro do servidor."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        );

// =====================================================
// ▶️ EXECUTAR
// =====================================================

async function execute(interaction) {
    if (!interaction.guild) {
        return interaction.reply({
            content:
                "❌ Este comando só pode ser usado em um servidor.",
            flags: EPHEMERAL
        });
    }

    if (!podeConfigurar(interaction)) {
        return interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",
            flags: EPHEMERAL
        });
    }

    try {
        await mostrarPainel(interaction);
    } catch (erro) {
        console.error(
            "❌ Erro ao executar /registrar:",
            erro
        );

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            return;
        }

        return interaction.reply({
            content:
                "❌ Não foi possível abrir o sistema de registro. Verifique o console do bot.",
            flags: EPHEMERAL
        });
    }
}

// =====================================================
// 📦 EXPORTAÇÕES
// =====================================================

module.exports = {
    data,
    execute,
    handleInteraction
};
