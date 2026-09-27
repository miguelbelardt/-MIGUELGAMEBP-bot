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
    PermissionFlagsBits
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
    getRegistroBotaoPorId,
    getRegistroBotoes,
    atualizarRegistroBotao,
    excluirRegistroBotao,
    usuarioJaRegistrado,
    registrarUsuario
} = require("../database/database");

// =====================================================
// 📝 SISTEMA DE REGISTRO
// =====================================================
//
// Máximo de páginas: 6
// Máximo de botões por página: 5
//
// Cada página possui:
// - Título
// - Descrição
// - Rodapé
// - Ícone do rodapé
//
// Cada botão possui:
// - Texto
// - Emoji
// - Estilo
// - Cargo opcional
// - Custom ID
//
// Dados persistidos no MySQL:
// - registro_config
// - registro_paginas
// - registro_botoes
// - registro_usuarios
// =====================================================

const MAX_PAGINAS = 6;
const MAX_BOTOES = 5;

// =====================================================
// 🎨 ESTILOS DOS BOTÕES
// =====================================================

const ESTILOS_BOTOES = {
    PRIMARY: ButtonStyle.Primary,
    SECONDARY: ButtonStyle.Secondary,
    SUCCESS: ButtonStyle.Success,
    DANGER: ButtonStyle.Danger
};

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
// 🔐 VERIFICAR SERVIDOR DO ID
// =====================================================

function pertenceAoServidor(interaction, guildId) {
    return (
        interaction.guild &&
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
    return await getRegistroPagina(
        guildId,
        Number(numeroPagina)
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
        if (pagina.rodape_icone) {
            try {
                embed.setFooter({
                    text: String(pagina.rodape).substring(0, 2048),
                    iconURL: String(pagina.rodape_icone)
                });
            } catch {
                embed.setFooter({
                    text: String(pagina.rodape).substring(0, 2048)
                });
            }
        } else {
            embed.setFooter({
                text: String(pagina.rodape).substring(0, 2048)
            });
        }
    }

    return embed;
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

    for (const botao of botoes.slice(0, MAX_BOTOES)) {
        const estilo =
            String(
                botao.estilo || "PRIMARY"
            ).toUpperCase();

        const button = new ButtonBuilder()
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
            } catch (erro) {
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

    // =================================================
    // 📄 NAVEGAÇÃO
    // =================================================

    const paginas = await buscarPaginas(guildId);

    if (paginas.length > 1) {
        const navegacao = new ActionRowBuilder();

        const anterior = new ButtonBuilder()
            .setCustomId(
                `registro_pagina_${guildId}_${Math.max(
                    1,
                    Number(numeroPagina) - 1
                )}`
            )
            .setLabel("Anterior")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
                Number(numeroPagina) <= 1
            );

        const proxima = new ButtonBuilder()
            .setCustomId(
                `registro_pagina_${guildId}_${Math.min(
                    paginas.length,
                    Number(numeroPagina) + 1
                )}`
            )
            .setLabel("Próxima")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
                Number(numeroPagina) >= paginas.length
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
// 📤 ATUALIZAR MENSAGEM PUBLICADA
// =====================================================

async function atualizarMensagemRegistro(
    guild,
    config,
    numeroPagina = 1
) {
    if (
        !config ||
        !config.canal_id ||
        !config.mensagem_id
    ) {
        return false;
    }

    try {
        const canal = await guild.channels.fetch(
            config.canal_id
        );

        if (
            !canal ||
            !canal.isTextBased()
        ) {
            return false;
        }

        const mensagem = await canal.messages.fetch(
            config.mensagem_id
        );

        const pagina = await buscarPagina(
            guild.id,
            numeroPagina
        );

        if (!pagina) {
            return false;
        }

        const embed = criarEmbedPagina(
            pagina
        );

        const components =
            await criarComponentesPagina(
                pagina,
                guild.id,
                numeroPagina
            );

        await mensagem.edit({
            embeds: [embed],
            components
        });

        return true;
    } catch (erro) {
        console.error(
            "❌ Erro ao atualizar mensagem do registro:",
            erro
        );

        return false;
    }
}

// =====================================================
// 🔄 ATUALIZAR PUBLICAÇÃO APÓS EDIÇÃO
// =====================================================

async function atualizarPublicacaoSeExistir(
    interaction,
    guildId,
    numeroPagina = 1
) {
    const config = await buscarConfiguracao(
        guildId
    );

    if (
        !config ||
        !config.canal_id ||
        !config.mensagem_id
    ) {
        return false;
    }

    return await atualizarMensagemRegistro(
        interaction.guild,
        config,
        numeroPagina
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
            .setTitle(
                "📝 Sistema de Registro"
            )
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
                    "Selecione uma página abaixo para editar."
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
            .setPlaceholder(
                "📄 Escolha uma página"
            );

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
                        `registro_adicionar_pagina_${interaction.guild.id}`
                    )
                    .setLabel(
                        "Adicionar página"
                    )
                    .setEmoji("➕")
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        paginas.length >= MAX_PAGINAS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_publicar_${interaction.guild.id}`
                    )
                    .setLabel(
                        "Publicar / Atualizar"
                    )
                    .setEmoji("📢")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const rowExtra =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_excluir_${interaction.guild.id}`
                    )
                    .setLabel(
                        "Excluir configuração"
                    )
                    .setEmoji("🗑️")
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    await interaction.reply({
        embeds: [embed],
        components: [
            rowMenu,
            rowBotoes,
            rowExtra
        ],
        ephemeral: true
    });
}

// =====================================================
// 📄 PAINEL DA PÁGINA
// =====================================================

async function mostrarConfiguracaoPagina(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !pertenceAoServidor(
            interaction,
            guildId
        )
    ) {
        return interaction.reply({
            content:
                "❌ Essa interação não pertence a este servidor.",
            ephemeral: true
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
            ephemeral: true
        });
    }

    const botoes =
        await buscarBotoes(
            pagina.id
        );

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
                    .setLabel(
                        "Título / Descrição"
                    )
                    .setEmoji("📝")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_editar_rodape_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Rodapé")
                    .setEmoji("🔻")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_adicionar_botao_${guildId}_${numeroPagina}`
                    )
                    .setLabel(
                        "Adicionar botão"
                    )
                    .setEmoji("🔘")
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        botoes.length >= MAX_BOTOES
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_botoes_${guildId}_${numeroPagina}`
                    )
                    .setLabel(
                        "Editar botões"
                    )
                    .setEmoji("⚙️")
                    .setStyle(
                        ButtonStyle.Primary
                    )
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
                    .setStyle(
                        ButtonStyle.Secondary
                    )
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
            ephemeral: true
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
            ephemeral: true
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
            .setStyle(
                TextInputStyle.Short
            )
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
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setMaxLength(4000);

    if (pagina.descricao) {
        descricao.setValue(
            String(pagina.descricao)
        );
    }

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(titulo),

        new ActionRowBuilder()
            .addComponents(descricao)
    );

    await interaction.showModal(
        modal
    );
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
            ephemeral: true
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
            ephemeral: true
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
            .setLabel(
                "Texto do rodapé"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(2048);

    if (pagina.rodape) {
        rodape.setValue(
            String(pagina.rodape)
        );
    }

    const icone =
        new TextInputBuilder()
            .setCustomId(
                "rodape_icone"
            )
            .setLabel(
                "URL do ícone do rodapé"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(2048);

    if (pagina.rodape_icone) {
        icone.setValue(
            String(pagina.rodape_icone)
        );
    }

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(rodape),

        new ActionRowBuilder()
            .addComponents(icone)
    );

    await interaction.showModal(
        modal
    );
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
            ephemeral: true
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
            ephemeral: true
        });
    }

    const botoes =
        await buscarBotoes(
            pagina.id
        );

    if (
        botoes.length >= MAX_BOTOES
    ) {
        return interaction.reply({
            content:
                `❌ Cada página pode ter no máximo ${MAX_BOTOES} botões.`,
            ephemeral: true
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
            .setLabel(
                "Texto do botão"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(80);

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel(
                "Emoji (opcional)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(100);

    const cargo =
        new TextInputBuilder()
            .setCustomId("cargo")
            .setLabel(
                "ID do cargo (opcional)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(30);

    const estilo =
        new TextInputBuilder()
            .setCustomId("estilo")
            .setLabel(
                "PRIMARY / SECONDARY / SUCCESS / DANGER"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue("PRIMARY")
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(texto),

        new ActionRowBuilder()
            .addComponents(emoji),

        new ActionRowBuilder()
            .addComponents(cargo),

        new ActionRowBuilder()
            .addComponents(estilo)
    );

    await interaction.showModal(
        modal
    );
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
            ephemeral: true
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
            ephemeral: true
        });
    }

    const botoes =
        await buscarBotoes(
            pagina.id
        );

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

    // =================================================
    // ✏️ LINHA DE EDIÇÃO
    // =================================================

    const linhaEditar =
        new ActionRowBuilder();

    for (const botao of botoes.slice(0, MAX_BOTOES)) {
        linhaEditar.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `registro_editar_botao_${guildId}_${botao.id}_${numeroPagina}`
                )
                .setLabel(
                    `✏️ ${String(
                        botao.texto || "Botão"
                    ).substring(0, 70)}`
                )
                .setStyle(
                    ButtonStyle.Primary
                )
        );
    }

    if (linhaEditar.components.length) {
        components.push(linhaEditar);
    }

    // =================================================
    // 🗑️ LINHA DE EXCLUSÃO
    // =================================================

    const linhaExcluir =
        new ActionRowBuilder();

    for (const botao of botoes.slice(0, MAX_BOTOES)) {
        linhaExcluir.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `registro_excluir_botao_${guildId}_${botao.id}_${numeroPagina}`
                )
                .setLabel(
                    `🗑️ ${String(
                        botao.texto || "Botão"
                    ).substring(0, 70)}`
                )
                .setStyle(
                    ButtonStyle.Danger
                )
        );
    }

    if (linhaExcluir.components.length) {
        components.push(linhaExcluir);
    }

    // =================================================
    // ◀️ VOLTAR
    // =================================================

    components.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_voltar_pagina_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Voltar")
                    .setEmoji("◀️")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
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
            ephemeral: true
        });
    }

    const botao =
        await getRegistroBotaoPorId(
            botaoId
        );

    if (!botao) {
        return interaction.reply({
            content:
                "❌ Esse botão não existe.",
            ephemeral: true
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_editar_botao_${guildId}_${botaoId}_${numeroPagina}`
            )
            .setTitle(
                "Editar botão"
            );

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(80)
            .setValue(
                String(
                    botao.texto || ""
                )
            );

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji")
            .setStyle(
                TextInputStyle.Short
            )
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
            .setStyle(
                TextInputStyle.Short
            )
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
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    botao.estilo ||
                    "PRIMARY"
                ).toUpperCase()
            )
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(texto),

        new ActionRowBuilder()
            .addComponents(emoji),

        new ActionRowBuilder()
            .addComponents(cargo),

        new ActionRowBuilder()
            .addComponents(estilo)
    );

    await interaction.showModal(
        modal
    );
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

    if (
        !/^\d{15,25}$/.test(cargoId)
    ) {
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
// 📢 PUBLICAR / ATUALIZAR
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
            ephemeral: true
        });
    }

    let config =
        await buscarConfiguracao(
            guildId
        );

    if (!config) {
        config =
            await garantirConfiguracao(
                guildId
            );
    }

    const pagina =
        await buscarPagina(
            guildId,
            1
        );

    if (!pagina) {
        return interaction.reply({
            content:
                "❌ O registro não possui uma página.",
            ephemeral: true
        });
    }

    // =================================================
    // 🔄 TENTAR ATUALIZAR MENSAGEM EXISTENTE
    // =================================================

    if (
        config.canal_id &&
        config.mensagem_id
    ) {
        const atualizado =
            await atualizarMensagemRegistro(
                interaction.guild,
                config,
                1
            );

        if (atualizado) {
            await pool.query(
                `
                UPDATE registro_config
                SET configurado = TRUE,
                    atualizado_em = ?
                WHERE guild_id = ?
                `,
                [
                    Date.now(),
                    guildId
                ]
            );

            return interaction.reply({
                content:
                    "✅ Mensagem do registro atualizada com sucesso!",
                ephemeral: true
            });
        }
    }

    // =================================================
    // 📢 PUBLICAR NOVA MENSAGEM
    // =================================================

    if (
        !interaction.channel ||
        !interaction.channel.isTextBased()
    ) {
        return interaction.reply({
            content:
                "❌ Não é possível publicar o registro neste canal.",
            ephemeral: true
        });
    }

    const embed =
        criarEmbedPagina(
            pagina
        );

    const components =
        await criarComponentesPagina(
            pagina,
            guildId,
            1
        );

    const mensagem =
        await interaction.channel.send({
            embeds: [embed],
            components
        });

    const paginas =
        await buscarPaginas(
            guildId
        );

    await salvarRegistroConfig(
        guildId,
        interaction.channel.id,
        mensagem.id,
        Math.max(
            1,
            paginas.length
        ),
        true
    );

    await salvarMensagemRegistro(
        guildId,
        mensagem.id
    );

    await interaction.reply({
        content:
            "✅ Sistema de registro publicado com sucesso!",
        ephemeral: true
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
            ephemeral: true
        });
    }

    await garantirConfiguracao(
        guildId
    );

    const paginas =
        await buscarPaginas(
            guildId
        );

    if (
        paginas.length >= MAX_PAGINAS
    ) {
        return interaction.reply({
            content:
                `❌ O limite máximo é de ${MAX_PAGINAS} páginas.`,
            ephemeral: true
        });
    }

    const numero =
        paginas.length + 1;

    await criarRegistroPagina(
        guildId,
        numero,
        {
            titulo:
                `Página ${numero}`,
            descricao:
                "Configure esta página.",
            rodape: null,
            rodape_icone: null
        }
    );

    const config =
        await buscarConfiguracao(
            guildId
        );

    if (
        config &&
        config.canal_id &&
        config.mensagem_id
    ) {
        await pool.query(
            `
            UPDATE registro_config
            SET paginas = ?,
                atualizado_em = ?
            WHERE guild_id = ?
            `,
            [
                numero,
                Date.now(),
                guildId
            ]
        );

        await atualizarMensagemRegistro(
            interaction.guild,
            config,
            1
        );
    }

    await interaction.reply({
        content:
            `✅ Página ${numero} criada!`,
        ephemeral: true
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
            ephemeral: true
        });
    }

    const config =
        await buscarConfiguracao(
            guildId
        );

    if (!config) {
        return interaction.reply({
            content:
                "❌ Nenhum sistema de registro encontrado.",
            ephemeral: true
        });
    }

    // =================================================
    // 🗑️ APAGAR MENSAGEM PUBLICADA
    // =================================================

    if (
        config.canal_id &&
        config.mensagem_id
    ) {
        try {
            const canal =
                await interaction.guild.channels.fetch(
                    config.canal_id
                );

            if (canal && canal.isTextBased()) {
                const mensagem =
                    await canal.messages
                        .fetch(config.mensagem_id)
                        .catch(
                            () => null
                        );

                if (mensagem) {
                    await mensagem.delete()
                        .catch(
                            () => {}
                        );
                }
            }
        } catch {}
    }

    // =================================================
    // 🗑️ APAGAR USUÁRIOS
    // =================================================

    await pool.query(
        `
        DELETE FROM registro_usuarios
        WHERE guild_id = ?
        `,
        [guildId]
    );

    // =================================================
    // 🗑️ APAGAR BOTÕES
    // =================================================

    await pool.query(
        `
        DELETE b
        FROM registro_botoes b
        INNER JOIN registro_paginas p
            ON p.id = b.pagina_id
        WHERE p.guild_id = ?
        `,
        [guildId]
    );

    // =================================================
    // 🗑️ APAGAR PÁGINAS
    // =================================================

    await pool.query(
        `
        DELETE FROM registro_paginas
        WHERE guild_id = ?
        `,
        [guildId]
    );

    // =================================================
    // 🗑️ APAGAR CONFIGURAÇÃO
    // =================================================

    await pool.query(
        `
        DELETE FROM registro_config
        WHERE guild_id = ?
        `,
        [guildId]
    );

    await interaction.reply({
        content:
            "🗑️ Sistema de registro excluído com sucesso.",
        ephemeral: true
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
            WHERE b.custom_id = ?
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
            ephemeral: true
        });
    }

    if (
        String(botao.guild_id) !==
        String(interaction.guild.id)
    ) {
        return interaction.reply({
            content:
                "❌ Esse botão não pertence a este servidor.",
            ephemeral: true
        });
    }

    // =================================================
    // 👤 VERIFICAR SE JÁ ESTÁ REGISTRADO
    // =================================================

    const jaRegistrado =
        await usuarioJaRegistrado(
            interaction.guild.id,
            interaction.user.id
        );

    if (jaRegistrado) {
        return interaction.reply({
            content:
                "ℹ️ Você já fez este registro.",
            ephemeral: true
        });
    }

    // =================================================
    // 🎭 DAR CARGO
    // =================================================

    let cargoRecebido = null;

    if (botao.cargo_id) {
        const cargo =
            interaction.guild.roles.cache.get(
                botao.cargo_id
            );

        if (!cargo) {
            return interaction.reply({
                content:
                    "❌ O cargo configurado para este botão não existe mais.",
                ephemeral: true
            });
        }

        const membro =
            await interaction.guild.members
                .fetch(interaction.user.id);

        const botMember =
            interaction.guild.members.me;

        if (!botMember) {
            return interaction.reply({
                content:
                    "❌ Não consegui verificar as permissões do bot.",
                ephemeral: true
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
                ephemeral: true
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
                ephemeral: true
            });
        }

        try {
            await membro.roles.add(
                cargo
            );

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
                ephemeral: true
            });
        }
    }

    // =================================================
    // 💾 SALVAR USUÁRIO
    // =================================================

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

        // Se outro clique registrou antes,
        // não considera como erro grave.
        const agoraRegistrado =
            await usuarioJaRegistrado(
                interaction.guild.id,
                interaction.user.id
            ).catch(
                () => false
            );

        if (agoraRegistrado) {
            return interaction.reply({
                content:
                    "ℹ️ Você já fez este registro.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content:
                "❌ Ocorreu um erro ao salvar seu registro.",
            ephemeral: true
        });
    }

    await interaction.reply({
        content:
            cargoRecebido
                ? "✅ Registro concluído! Seu cargo foi adicionado."
                : "✅ Registro concluído com sucesso!",
        ephemeral: true
    });
}

// =====================================================
// 🧰 ABRIR PAINEL PRINCIPAL NOVAMENTE
// =====================================================

async function atualizarPainelPrincipal(
    interaction,
    guildId
) {
    const paginas =
        await buscarPaginas(
            guildId
        );

    const config =
        await buscarConfiguracao(
            guildId
        );

    const embed =
        new EmbedBuilder()
            .setTitle(
                "📝 Sistema de Registro"
            )
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
            .setPlaceholder(
                "📄 Escolha uma página"
            );

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
                        `registro_adicionar_pagina_${guildId}`
                    )
                    .setLabel(
                        "Adicionar página"
                    )
                    .setEmoji("➕")
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        paginas.length >= MAX_PAGINAS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_publicar_${guildId}`
                    )
                    .setLabel(
                        "Publicar / Atualizar"
                    )
                    .setEmoji("📢")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const rowExcluir =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_excluir_${guildId}`
                    )
                    .setLabel(
                        "Excluir configuração"
                    )
                    .setEmoji("🗑️")
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    return interaction.update({
        embeds: [embed],
        components: [
            rowMenu,
            rowBotoes,
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
        // 🔘 BOTÃO PÚBLICO DE REGISTRO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_botao_"
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
                    ephemeral: true
                });
            }

            const paginas =
                await buscarPaginas(
                    guildId
                );

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
                    ephemeral: true
                });
            }

            const embed =
                criarEmbedPagina(
                    pagina
                );

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
        // 🔐 A PARTIR DAQUI SÃO INTERAÇÕES ADMINISTRATIVAS
        // =================================================

        const idsAdministrativos = [
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
                ephemeral: true
            });
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
                    ephemeral: true
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
        // ⚙️ EDITAR BOTÕES
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
                    ephemeral: true
                });
            }

            const botao =
                await getRegistroBotaoPorId(
                    botaoId
                );

            if (!botao) {
                return interaction.reply({
                    content:
                        "❌ Esse botão não existe.",
                    ephemeral: true
                });
            }

            await excluirRegistroBotao(
                botaoId
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId,
                numeroPagina
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
        // ◀️ VOLTAR PARA PAINEL
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

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Essa interação não pertence a este servidor.",
                    ephemeral: true
                });
            }

            return await atualizarPainelPrincipal(
                interaction,
                guildId
            );
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

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Página não encontrada.",
                    ephemeral: true
                });
            }

            const titulo =
                interaction.fields.getTextInputValue(
                    "titulo"
                );

            const descricao =
                interaction.fields.getTextInputValue(
                    "descricao"
                );

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
                guildId,
                numeroPagina
            );

            await interaction.reply({
                content:
                    "✅ Título e descrição atualizados!",
                ephemeral: true
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

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Página não encontrada.",
                    ephemeral: true
                });
            }

            const rodape =
                interaction.fields.getTextInputValue(
                    "rodape"
                );

            const icone =
                interaction.fields.getTextInputValue(
                    "rodape_icone"
                );

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
                guildId,
                numeroPagina
            );

            await interaction.reply({
                content:
                    "✅ Rodapé atualizado!",
                ephemeral: true
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
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(partes[4]);

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        "❌ Página não encontrada.",
                    ephemeral: true
                });
            }

            const botoes =
                await buscarBotoes(
                    pagina.id
                );

            if (
                botoes.length >= MAX_BOTOES
            ) {
                return interaction.reply({
                    content:
                        `❌ O limite é de ${MAX_BOTOES} botões por página.`,
                    ephemeral: true
                });
            }

            const texto =
                interaction.fields.getTextInputValue(
                    "texto"
                ).trim();

            if (!texto) {
                return interaction.reply({
                    content:
                        "❌ O texto do botão não pode ficar vazio.",
                    ephemeral: true
                });
            }

            const emoji =
                interaction.fields.getTextInputValue(
                    "emoji"
                ).trim();

            const cargo =
                interaction.fields.getTextInputValue(
                    "cargo"
                ).trim();

            let estilo =
                interaction.fields.getTextInputValue(
                    "estilo"
                );

            estilo =
                String(
                    estilo || "PRIMARY"
                )
                    .toUpperCase()
                    .trim();

            if (
                !ESTILOS_BOTOES[
                    estilo
                ]
            ) {
                estilo =
                    "PRIMARY";
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
                    ephemeral: true
                });
            }

            // =========================================
            // 🔑 CUSTOM ID ÚNICO
            // =========================================

            const customId =
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
                        customId,
                    ordem:
                        botoes.length + 1
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId,
                numeroPagina
            );

            await interaction.reply({
                content:
                    cargoResultado.id
                        ? `✅ Botão criado e configurado para dar <@&${cargoResultado.id}>.`
                        : "✅ Botão criado sem cargo.",
                ephemeral: true
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

            const botao =
                await getRegistroBotaoPorId(
                    botaoId
                );

            if (!botao) {
                return interaction.reply({
                    content:
                        "❌ Esse botão não existe.",
                    ephemeral: true
                });
            }

            const texto =
                interaction.fields.getTextInputValue(
                    "texto"
                ).trim();

            if (!texto) {
                return interaction.reply({
                    content:
                        "❌ O texto do botão não pode ficar vazio.",
                    ephemeral: true
                });
            }

            const emoji =
                interaction.fields.getTextInputValue(
                    "emoji"
                ).trim();

            const cargo =
                interaction.fields.getTextInputValue(
                    "cargo"
                ).trim();

            let estilo =
                interaction.fields.getTextInputValue(
                    "estilo"
                );

            estilo =
                String(
                    estilo || "PRIMARY"
                )
                    .toUpperCase()
                    .trim();

            if (
                !ESTILOS_BOTOES[
                    estilo
                ]
            ) {
                estilo =
                    "PRIMARY";
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
                    ephemeral: true
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
                guildId,
                numeroPagina
            );

            await interaction.reply({
                content:
                    "✅ Botão atualizado!",
                ephemeral: true
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
                ephemeral: true
            }).catch(
                () => {}
            );
        }

        return interaction.reply({
            content:
                "❌ Ocorreu um erro no sistema de registro. Verifique o console do bot.",
            ephemeral: true
        }).catch(
            () => {}
        );
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
            ephemeral: true
        });
    }

    if (!podeConfigurar(interaction)) {
        return interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",
            ephemeral: true
        });
    }

    try {
        await mostrarPainel(
            interaction
        );
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
            ephemeral: true
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
