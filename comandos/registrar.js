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
//
// Cada página possui:
// - Título
// - Descrição
// - Rodapé
// - Ícone do rodapé
// - Botões
//
// Cada botão pode:
// - Ter texto
// - Ter emoji
// - Ter estilo
// - Dar um cargo
// - Não dar cargo
//
// O sistema também salva:
// - Canal da mensagem
// - ID da mensagem
// - Usuários registrados
// - Botão utilizado
// - Cargo recebido
// =====================================================

const MAX_PAGINAS = 6;
const MAX_BOTOES = 5;

// =====================================================
// 🎨 ESTILOS
// =====================================================

const ESTILOS_BOTOES = {
    PRIMARY: ButtonStyle.Primary,
    SECONDARY: ButtonStyle.Secondary,
    SUCCESS: ButtonStyle.Success,
    DANGER: ButtonStyle.Danger
};

// =====================================================
// 🔐 VERIFICAR PERMISSÃO
// =====================================================

function podeConfigurar(interaction) {
    return (
        interaction.guild &&
        interaction.memberPermissions &&
        interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
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
    return await getRegistroPaginas(guildId);
}

async function buscarPagina(guildId, numero) {
    return await getRegistroPagina(
        guildId,
        numero
    );
}

// =====================================================
// 🔘 BOTÕES
// =====================================================

async function buscarBotoes(paginaId) {
    return await getRegistroBotoes(
        paginaId
    );
}

// =====================================================
// 🆕 CRIAR CONFIGURAÇÃO
// =====================================================

async function garantirConfiguracao(
    guildId
) {
    let config =
        await buscarConfiguracao(
            guildId
        );

    if (config) {
        return config;
    }

    await salvarRegistroConfig(
        guildId,
        null,
        null,
        1,
        false
    );

    config =
        await buscarConfiguracao(
            guildId
        );

    if (!config) {
        throw new Error(
            "Não foi possível criar a configuração do sistema de registro."
        );
    }

    // ============================================
    // 📄 CRIAR PRIMEIRA PÁGINA
    // ============================================

    const paginas =
        await buscarPaginas(
            guildId
        );

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

function criarEmbedPagina(
    pagina
) {
    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2);

    if (pagina.titulo) {
        embed.setTitle(
            pagina.titulo
        );
    }

    if (pagina.descricao) {
        embed.setDescription(
            pagina.descricao
        );
    }

    if (pagina.rodape) {
        if (pagina.rodape_icone) {
            embed.setFooter({
                text: pagina.rodape,
                iconURL:
                    pagina.rodape_icone
            });
        } else {
            embed.setFooter({
                text: pagina.rodape
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
    const botoes =
        await buscarBotoes(
            pagina.id
        );

    const rows = [];
    let row =
        new ActionRowBuilder();

    for (
        const botao of botoes
    ) {
        const button =
            new ButtonBuilder()
                .setCustomId(
                    botao.custom_id ||
                    `registro_botao_${botao.id}`
                )
                .setLabel(
                    botao.texto
                )
                .setStyle(
                    ESTILOS_BOTOES[
                        String(
                            botao.estilo ||
                            "PRIMARY"
                        ).toUpperCase()
                    ] ||
                    ButtonStyle.Primary
                );

        if (botao.emoji) {
            try {
                button.setEmoji(
                    botao.emoji
                );
            } catch (erro) {
                console.warn(
                    "⚠️ Emoji inválido no botão:",
                    botao.id
                );
            }
        }

        row.addComponents(
            button
        );

        if (
            row.components.length >= 5
        ) {
            rows.push(row);
            row =
                new ActionRowBuilder();
        }
    }

    if (
        row.components.length > 0
    ) {
        rows.push(row);
    }

    // ============================================
    // 📄 NAVEGAÇÃO
    // ============================================

    const paginas =
        await buscarPaginas(
            guildId
        );

    if (
        paginas.length > 1
    ) {
        const navegacao =
            new ActionRowBuilder();

        const anterior =
            new ButtonBuilder()
                .setCustomId(
                    `registro_pagina_${guildId}_${numeroPagina - 1}`
                )
                .setLabel(
                    "Anterior"
                )
                .setEmoji("◀️")
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setDisabled(
                    numeroPagina <= 1
                );

        const proxima =
            new ButtonBuilder()
                .setCustomId(
                    `registro_pagina_${guildId}_${numeroPagina + 1}`
                )
                .setLabel(
                    "Próxima"
                )
                .setEmoji("▶️")
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setDisabled(
                    numeroPagina >= paginas.length
                );

        navegacao.addComponents(
            anterior,
            proxima
        );

        rows.push(
            navegacao
        );
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

        const pagina =
            await buscarPagina(
                guild.id,
                numeroPagina
            );

        if (!pagina) {
            return false;
        }

        const embed =
            criarEmbedPagina(
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
// 📝 PAINEL PRINCIPAL
// =====================================================

async function mostrarPainel(
    interaction
) {
    const config =
        await garantirConfiguracao(
            interaction.guild.id
        );

    const paginas =
        await buscarPaginas(
            interaction.guild.id
        );

    const configurado =
        Boolean(
            config.configurado
        );

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

    for (
        const pagina of paginas
    ) {
        menu.addOptions({
            label:
                `Página ${pagina.pagina}`,
            description:
                (
                    pagina.titulo ||
                    "Sem título"
                ).substring(
                    0,
                    100
                ),
            value:
                String(
                    pagina.pagina
                )
        });
    }

    const rowMenu =
        new ActionRowBuilder()
            .addComponents(
                menu
            );

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
                        paginas.length >=
                            MAX_PAGINAS
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
            .setColor(
                0x5865F2
            );

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
                    .setLabel(
                        "Rodapé"
                    )
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
                        botoes.length >=
                            MAX_BOTOES
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
                    .setLabel(
                        "Voltar"
                    )
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
            .setMaxLength(256)
            .setValue(
                pagina.titulo || ""
            );

    const descricao =
        new TextInputBuilder()
            .setCustomId("descricao")
            .setLabel("Descrição")
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setMaxLength(4000)
            .setValue(
                pagina.descricao || ""
            );

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
            .setMaxLength(2048)
            .setValue(
                pagina.rodape || ""
            );

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
            .setValue(
                pagina.rodape_icone || ""
            );

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
        botoes.length >=
        MAX_BOTOES
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
// ⚙️ EDITAR BOTÕES
// =====================================================

async function mostrarBotoes(
    interaction,
    guildId,
    numeroPagina
) {
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
            .setColor(
                0x5865F2
            );

    const components = [];

    for (
        const botao of botoes
    ) {
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `registro_editar_botao_${guildId}_${botao.id}_${numeroPagina}`
                        )
                        .setLabel(
                            `Editar: ${botao.texto}`
                                .substring(
                                    0,
                                    80
                                )
                        )
                        .setStyle(
                            ButtonStyle.Primary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `registro_excluir_botao_${guildId}_${botao.id}_${numeroPagina}`
                        )
                        .setLabel("Excluir")
                        .setEmoji("🗑️")
                        .setStyle(
                            ButtonStyle.Danger
                        )
                )
        );
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
                botao.texto || ""
            );

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setMaxLength(100)
            .setValue(
                botao.emoji || ""
            );

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
            .setMaxLength(30)
            .setValue(
                botao.cargo_id || ""
            );

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
                botao.estilo ||
                "PRIMARY"
            );

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
// 📢 PUBLICAR / ATUALIZAR
// =====================================================

async function publicarRegistro(
    interaction,
    guildId
) {
    let config =
        await buscarConfiguracao(
            guildId
        );

    if (!config) {
        await garantirConfiguracao(
            guildId
        );

        config =
            await buscarConfiguracao(
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

    // ============================================
    // 🔄 SE JÁ EXISTIR MENSAGEM, ATUALIZA
    // ============================================

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
            return interaction.reply({
                content:
                    "✅ Mensagem do registro atualizada com sucesso!",
                ephemeral: true
            });
        }
    }

    // ============================================
    // 📢 PUBLICAR NOVA MENSAGEM
    // ============================================

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

    await salvarRegistroConfig(
        guildId,
        interaction.channel.id,
        mensagem.id,
        Math.max(
            1,
            (
                await buscarPaginas(
                    guildId
                )
            ).length
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
    const paginas =
        await buscarPaginas(
            guildId
        );

    if (
        paginas.length >=
        MAX_PAGINAS
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

    // ============================================
    // 🗑️ APAGAR MENSAGEM PUBLICADA
    // ============================================

    if (
        config.canal_id &&
        config.mensagem_id
    ) {
        try {
            const canal =
                await interaction.guild.channels.fetch(
                    config.canal_id
                );

            if (canal) {
                const mensagem =
                    await canal.messages.fetch(
                        config.mensagem_id
                    ).catch(
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

    // ============================================
    // 🗑️ APAGAR DADOS
    // ============================================

    await pool.query(
        `
        DELETE FROM registro_usuarios
        WHERE guild_id = $1
        `,
        [guildId]
    );

    await pool.query(
        `
        DELETE FROM registro_botoes
        WHERE pagina_id IN (
            SELECT id
            FROM registro_paginas
            WHERE guild_id = $1
        )
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
                p.pagina
            FROM registro_botoes b
            INNER JOIN registro_paginas p
                ON p.id = b.pagina_id
            WHERE b.custom_id = $1
            LIMIT 1
            `,
            [customId]
        );

    const botao =
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

    // ============================================
    // 👤 VERIFICAR REGISTRO
    // ============================================

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

    // ============================================
    // 🎭 DAR CARGO
    // ============================================

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

        try {
            await interaction.member.roles.add(
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
                    "❌ Não consegui adicionar o cargo configurado para este botão. Verifique as permissões e a posição do cargo do bot.",
                ephemeral: true
            });
        }
    }

    // ============================================
    // 💾 SALVAR USUÁRIO
    // ============================================

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
// 🖱️ INTERAÇÕES
// =====================================================

async function handleInteraction(
    interaction
) {
    try {
        if (
            !interaction.guild
        ) {
            return;
        }

        // =================================================
        // 🔘 BOTÃO DE REGISTRO
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_botao_"
            )
        ) {
            return processarBotaoRegistro(
                interaction
            );
        }

        // =================================================
        // 📄 NAVEGAÇÃO ENTRE PÁGINAS
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_pagina_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            const guildId =
                partes[2];

            const numeroPagina =
                Number(
                    partes[3]
                );

            if (
                String(guildId) !==
                String(interaction.guild.id)
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
                    numeroPagina
                );

            return interaction.update({
                embeds: [embed],
                components
            });
        }

        // =================================================
        // ➕ ADICIONAR PÁGINA
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_adicionar_pagina_"
            )
        ) {
            const guildId =
                interaction.customId.replace(
                    "registro_adicionar_pagina_",
                    ""
                );

            return adicionarPagina(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📢 PUBLICAR
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_publicar_"
            )
        ) {
            const guildId =
                interaction.customId.replace(
                    "registro_publicar_",
                    ""
                );

            return publicarRegistro(
                interaction,
                guildId
            );
        }

        // =================================================
        // 🗑️ EXCLUIR
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_excluir_"
            )
        ) {
            const guildId =
                interaction.customId.replace(
                    "registro_excluir_",
                    ""
                );

            return excluirRegistro(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📋 SELECIONAR PÁGINA
        // =================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId.startsWith(
                "registro_selecionar_pagina_"
            )
        ) {
            const guildId =
                interaction.customId.replace(
                    "registro_selecionar_pagina_",
                    ""
                );

            const numeroPagina =
                Number(
                    interaction.values[0]
                );

            return mostrarConfiguracaoPagina(
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
            interaction.customId.startsWith(
                "registro_editar_texto_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            return abrirModalTexto(
                interaction,
                partes[3],
                Number(
                    partes[4]
                )
            );
        }

        // =================================================
        // 🔻 EDITAR RODAPÉ
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_editar_rodape_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            return abrirModalRodape(
                interaction,
                partes[3],
                Number(
                    partes[4]
                )
            );
        }

        // =================================================
        // ➕ ADICIONAR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_adicionar_botao_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            return abrirModalBotao(
                interaction,
                partes[3],
                Number(
                    partes[4]
                )
            );
        }

        // =================================================
        // ⚙️ EDITAR BOTÕES
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_botoes_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            return mostrarBotoes(
                interaction,
                partes[2],
                Number(
                    partes[3]
                )
            );
        }

        // =================================================
        // ✏️ EDITAR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_editar_botao_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            return abrirModalEditarBotao(
                interaction,
                partes[3],
                partes[4],
                Number(
                    partes[5]
                )
            );
        }

        // =================================================
        // 🗑️ EXCLUIR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_excluir_botao_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            const guildId =
                partes[3];

            const botaoId =
                partes[4];

            const numeroPagina =
                Number(
                    partes[5]
                );

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

            return mostrarBotoes(
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
            interaction.customId.startsWith(
                "registro_voltar_pagina_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            return mostrarConfiguracaoPagina(
                interaction,
                partes[3],
                Number(
                    partes[4]
                )
            );
        }

        // =================================================
        // ◀️ VOLTAR PARA PAINEL
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                "registro_voltar_"
            )
        ) {
            const guildId =
                interaction.customId.replace(
                    "registro_voltar_",
                    ""
                );

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
                            "",
                            "Selecione uma página para editar."
                        ].join("\n")
                    )
                    .setColor(
                        0x5865F2
                    );

            const menu =
                new StringSelectMenuBuilder()
                    .setCustomId(
                        `registro_selecionar_pagina_${guildId}`
                    )
                    .setPlaceholder(
                        "📄 Escolha uma página"
                    );

            for (
                const pagina of paginas
            ) {
                menu.addOptions({
                    label:
                        `Página ${pagina.pagina}`,
                    description:
                        (
                            pagina.titulo ||
                            "Sem título"
                        ).substring(
                            0,
                            100
                        ),
                    value:
                        String(
                            pagina.pagina
                        )
                });
            }

            const rowMenu =
                new ActionRowBuilder()
                    .addComponents(
                        menu
                    );

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
                                paginas.length >=
                                    MAX_PAGINAS
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

        // =================================================
        // 📝 MODAL TEXTO
        // =================================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId.startsWith(
                "registro_modal_texto_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(
                    partes[4]
                );

            const titulo =
                interaction.fields.getTextInputValue(
                    "titulo"
                );

            const descricao =
                interaction.fields.getTextInputValue(
                    "descricao"
                );

            await atualizarRegistroPagina(
                await buscarPagina(
                    guildId,
                    numeroPagina
                ).then(
                    pagina =>
                        pagina.id
                ),
                guildId,
                {
                    titulo:
                        titulo || null,
                    descricao:
                        descricao || null
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
                await atualizarMensagemRegistro(
                    interaction.guild,
                    config,
                    numeroPagina
                );
            }

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
            interaction.customId.startsWith(
                "registro_modal_rodape_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(
                    partes[4]
                );

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

            const config =
                await buscarConfiguracao(
                    guildId
                );

            if (
                config &&
                config.canal_id &&
                config.mensagem_id
            ) {
                await atualizarMensagemRegistro(
                    interaction.guild,
                    config,
                    numeroPagina
                );
            }

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
            interaction.customId.startsWith(
                "registro_modal_botao_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(
                    partes[4]
                );

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
                botoes.length >=
                MAX_BOTOES
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
                );

            const emoji =
                interaction.fields.getTextInputValue(
                    "emoji"
                );

            const cargo =
                interaction.fields.getTextInputValue(
                    "cargo"
                );

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

            let cargoId = null;

            if (
                cargo &&
                /^\d{15,25}$/.test(
                    cargo.trim()
                )
            ) {
                const cargoDiscord =
                    interaction.guild.roles.cache.get(
                        cargo.trim()
                    );

                if (
                    cargoDiscord
                ) {
                    cargoId =
                        cargo.trim();
                }
            }

            // ========================================
            // 🔑 CUSTOM ID ÚNICO
            // ========================================

            const customId =
                `registro_botao_${guildId}_${Date.now()}_${Math.floor(
                    Math.random() * 100000
                )}`;

            await criarRegistroBotao(
                pagina.id,
                {
                    texto,
                    emoji:
                        emoji || null,
                    estilo,
                    cargo_id:
                        cargoId,
                    custom_id:
                        customId,
                    ordem:
                        botoes.length + 1
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
                await atualizarMensagemRegistro(
                    interaction.guild,
                    config,
                    numeroPagina
                );
            }

            await interaction.reply({
                content:
                    cargoId
                        ? `✅ Botão criado e configurado para dar <@&${cargoId}>.`
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
            interaction.customId.startsWith(
                "registro_modal_editar_botao_"
            )
        ) {
            const partes =
                interaction.customId.split("_");

            const guildId =
                partes[4];

            const botaoId =
                partes[5];

            const numeroPagina =
                Number(
                    partes[6]
                );

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
                );

            const emoji =
                interaction.fields.getTextInputValue(
                    "emoji"
                );

            const cargo =
                interaction.fields.getTextInputValue(
                    "cargo"
                );

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

            let cargoId = null;

            if (
                cargo &&
                /^\d{15,25}$/.test(
                    cargo.trim()
                )
            ) {
                const cargoDiscord =
                    interaction.guild.roles.cache.get(
                        cargo.trim()
                    );

                if (
                    cargoDiscord
                ) {
                    cargoId =
                        cargo.trim();
                }
            }

            await atualizarRegistroBotao(
                botaoId,
                {
                    texto,
                    emoji:
                        emoji || null,
                    estilo,
                    cargo_id:
                        cargoId
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
                await atualizarMensagemRegistro(
                    interaction.guild,
                    config,
                    numeroPagina
                );
            }

            await interaction.reply({
                content:
                    "✅ Botão atualizado!",
                ephemeral: true
            });

            return;
        }

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
        .setName(
            "registrar"
        )
        .setDescription(
            "Cria e configura o sistema de registro do servidor."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        );

// =====================================================
// ▶️ EXECUTAR
// =====================================================

async function execute(
    interaction
) {
    if (
        !interaction.guild
    ) {
        return interaction.reply({
            content:
                "❌ Este comando só pode ser usado em um servidor.",
            ephemeral: true
        });
    }

    if (
        !podeConfigurar(
            interaction
        )
    ) {
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
