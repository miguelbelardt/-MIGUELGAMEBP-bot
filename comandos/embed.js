const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require("discord.js");

const {
    criarEmbedBanco,
    atualizarEmbedBanco,
    getEmbedsDoServidor,
    getEmbedPorId,
    salvarMensagemEmbed,
    atualizarCanalEmbed,
    excluirEmbedBanco
} = require("../database/database");

// =====================================================
// 💾 CONFIGURAÇÕES TEMPORÁRIAS
// =====================================================

const configuracoes = new Map();

// =====================================================
// 🛠️ FUNÇÕES AUXILIARES
// =====================================================

function chaveConfiguracao(userId, guildId) {
    return `${guildId}:${userId}`;
}

function criarConfiguracao() {
    return {
        nome: "Embed",

        titulo: "",
        descricao: "",
        imagem: "",
        thumbnail: "",
        cor: "#5865F2",
        timestamp: false,

        autor: "",
        autorIcone: "",

        footer: "",
        footerIcone: "",

        canalId: "",
        mensagemId: "",

        editandoEmbedId: null
    };
}

function validarURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// =====================================================
// 🔄 CONVERTER DADOS DO BANCO PARA CONFIGURAÇÃO
// =====================================================

function criarConfigAPartirDoBanco(dados) {
    return {
        nome: dados.nome || "Embed",

        titulo: dados.titulo || "",
        descricao: dados.descricao || "",

        imagem: dados.imagem || "",
        thumbnail: dados.thumbnail || "",

        cor: dados.cor || "#5865F2",

        timestamp: Boolean(
            dados.timestamp
        ),

        autor: dados.autor_nome || "",
        autorIcone: dados.autor_icone || "",

        footer: dados.rodape || "",
        footerIcone: dados.rodape_icone || "",

        canalId: dados.canal_id || "",
        mensagemId: dados.mensagem_id || "",

        editandoEmbedId: dados.id
    };
}

// =====================================================
// 🎨 CRIAR EMBED
// =====================================================

function criarEmbed(config, usuario) {
    if (
        !config.titulo &&
        !config.descricao &&
        !config.imagem &&
        !config.thumbnail &&
        !config.autor &&
        !config.footer
    ) {
        return {
            sucesso: false,
            erro:
                "❌ Configure pelo menos um campo antes de continuar."
        };
    }

    const embed = new EmbedBuilder()
        .setColor(
            config.cor || "#5865F2"
        );

    // =================================================
    // 📝 TÍTULO
    // =================================================

    if (config.titulo) {
        embed.setTitle(
            config.titulo
        );
    }

    // =================================================
    // 📄 DESCRIÇÃO
    // =================================================

    if (config.descricao) {
        embed.setDescription(
            config.descricao
        );
    }

    // =================================================
    // 🖼️ IMAGEM
    // =================================================

    if (config.imagem) {
        embed.setImage(
            config.imagem
        );
    }

    // =================================================
    // 🔗 THUMBNAIL
    // =================================================

    if (config.thumbnail) {
        embed.setThumbnail(
            config.thumbnail
        );
    }

    // =================================================
    // 👤 AUTOR
    // =================================================

    if (config.autor) {
        const autor = {
            name: config.autor
        };

        if (config.autorIcone) {
            autor.iconURL =
                config.autorIcone;
        }

        embed.setAuthor(
            autor
        );
    }

    // =================================================
    // 📝 RODAPÉ
    // =================================================

    if (config.footer) {
        const footer = {
            text: config.footer
        };

        if (config.footerIcone) {
            footer.iconURL =
                config.footerIcone;
        }

        embed.setFooter(
            footer
        );
    } else if (usuario) {
        embed.setFooter({
            text:
                `Enviado por ${usuario.username}`
        });
    }

    // =================================================
    // 🕐 TIMESTAMP
    // =================================================

    if (config.timestamp) {
        embed.setTimestamp();
    }

    return {
        sucesso: true,
        embed
    };
}

// =====================================================
// 📋 PAINEL PRINCIPAL DO /EMBED
// =====================================================

function criarPainelPrincipal() {
    const embed =
        new EmbedBuilder()
            .setTitle(
                "🎨 GERENCIADOR DE EMBEDS"
            )
            .setDescription(
                "Escolha uma opção abaixo.\n\n" +
                "➕ **Criar** — Cria e envia um novo embed.\n" +
                "⚙️ **Configurar** — Gerencia os embeds já criados neste servidor."
            )
            .setColor("#5865F2");

    const linha =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "embed_criar"
                    )
                    .setLabel("Criar")
                    .setEmoji("➕")
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_configurar"
                    )
                    .setLabel("Configurar")
                    .setEmoji("⚙️")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    return {
        embeds: [embed],
        components: [linha]
    };
}

// =====================================================
// ⚙️ PAINEL DE CONFIGURAÇÃO DOS EMBEDS
// =====================================================

async function criarPainelConfiguracao(
    guildId,
    pagina = 0
) {
    const embeds =
        await getEmbedsDoServidor(
            guildId
        );

    const painel =
        new EmbedBuilder()
            .setTitle(
                "⚙️ CONFIGURAR EMBEDS"
            )
            .setColor("#5865F2");

    if (
        !embeds ||
        embeds.length === 0
    ) {
        painel.setDescription(
            "📭 Nenhum embed foi criado neste servidor ainda.\n\n" +
            "Use **➕ Criar** para criar um novo embed."
        );

        const linha =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            "embed_criar"
                        )
                        .setLabel("Criar novo")
                        .setEmoji("➕")
                        .setStyle(
                            ButtonStyle.Success
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            "embed_voltar"
                        )
                        .setLabel("Voltar")
                        .setEmoji("↩️")
                        .setStyle(
                            ButtonStyle.Secondary
                        )
                );

        return {
            embeds: [painel],
            components: [linha]
        };
    }

    // =================================================
    // 📄 PAGINAÇÃO
    // =================================================

    const porPagina = 4;

    const totalPaginas =
        Math.ceil(
            embeds.length / porPagina
        );

    if (pagina < 0) {
        pagina = 0;
    }

    if (pagina >= totalPaginas) {
        pagina =
            totalPaginas - 1;
    }

    const inicio =
        pagina * porPagina;

    const fim =
        inicio + porPagina;

    const embedsExibidos =
        embeds.slice(
            inicio,
            fim
        );

    painel.setDescription(
        "Selecione um embed abaixo para configurar.\n\n" +
        `📦 **${embeds.length}** embed(s) encontrado(s).\n` +
        `📄 Página **${pagina + 1}/${totalPaginas}**`
    );

    const componentes = [];

    // =================================================
    // ⚙️ BOTÕES DOS EMBEDS
    // =================================================

    for (
        let i = 0;
        i < embedsExibidos.length;
        i++
    ) {
        const dados =
            embedsExibidos[i];

        // Número visual sequencial global.
        const numero =
            `#${inicio + i + 1}`;

        const nome =
            dados.titulo &&
            dados.titulo.trim()
                ? dados.titulo
                    .trim()
                    .substring(0, 60)
                : "Embed sem título";

        const configurar =
            new ButtonBuilder()
                .setCustomId(
                    `embed_edit_${dados.id}`
                )
                .setLabel(
                    `Configurar ${numero}`
                )
                .setEmoji("⚙️")
                .setStyle(
                    ButtonStyle.Primary
                );

        const linha =
            new ActionRowBuilder()
                .addComponents(
                    configurar
                );

        componentes.push(
            linha
        );

        painel.addFields({
            name:
                `${numero} • ${nome}`,

            value:
                dados.canal_id
                    ? `📍 Canal: <#${dados.canal_id}>`
                    : "📍 Canal não definido",

            inline: false
        });
    }

    // =================================================
    // ◀️ / ▶️ PAGINAÇÃO
    // =================================================

    const linhaNavegacao =
        new ActionRowBuilder();

    if (pagina > 0) {
        linhaNavegacao.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `embed_pagina_${pagina - 1}`
                )
                .setLabel("Anterior")
                .setEmoji("⬅️")
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
    }

    if (pagina < totalPaginas - 1) {
        linhaNavegacao.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `embed_pagina_${pagina + 1}`
                )
                .setLabel("Próxima")
                .setEmoji("➡️")
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
    }

    linhaNavegacao.addComponents(
        new ButtonBuilder()
            .setCustomId(
                "embed_criar"
            )
            .setLabel("Criar novo")
            .setEmoji("➕")
            .setStyle(
                ButtonStyle.Success
            ),

        new ButtonBuilder()
            .setCustomId(
                "embed_voltar"
            )
            .setLabel("Voltar")
            .setEmoji("↩️")
            .setStyle(
                ButtonStyle.Secondary
            )
    );

    componentes.push(
        linhaNavegacao
    );

    return {
        embeds: [painel],
        components: componentes
    };
}

// =====================================================
// 📋 PAINEL PRINCIPAL DO CONFIGURADOR
// =====================================================

function criarPainel(config) {
    const embed =
        new EmbedBuilder()
            .setTitle(
                "🎨 CONFIGURADOR DE EMBED"
            )
            .setDescription(
                "Configure seu embed usando os botões abaixo.\n\n" +
                "🔒 **Somente administradores podem utilizar este painel.**\n\n" +
                "👀 Depois de enviar, o embed ficará visível para todos no servidor.\n" +
                "⚙️ Depois você poderá voltar em `/embed` → **Configurar** para alterar este embed."
            )
            .setColor(
                config.cor || "#5865F2"
            );

    // =================================================
    // 📍 CANAL
    // =================================================

    const canalTexto =
        config.canalId
            ? `📍 Canal configurado: <#${config.canalId}>`
            : "📍 Canal: canal atual";

    embed.addFields({
        name: "📤 Destino",
        value: canalTexto
    });

    // =================================================
    // LINHA 1
    // =================================================

    const linha1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "embed_titulo"
                    )
                    .setLabel("📝 Título")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_descricao"
                    )
                    .setLabel("📄 Descrição")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_autor"
                    )
                    .setLabel("👤 Autor")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    // =================================================
    // LINHA 2
    // =================================================

    const linha2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "embed_imagem"
                    )
                    .setLabel("🖼️ Imagem")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_thumbnail"
                    )
                    .setLabel("🔗 Thumbnail")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_cor"
                    )
                    .setLabel("🎨 Cor")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_timestamp"
                    )
                    .setLabel("🕐 Timestamp")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    // =================================================
    // LINHA 3
    // =================================================

    const linha3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "embed_footer"
                    )
                    .setLabel("📝 Rodapé")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_canal"
                    )
                    .setLabel("📍 Canal")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_preview"
                    )
                    .setLabel(
                        "👀 Pré-visualizar"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_send"
                    )
                    .setLabel(
                        config.editandoEmbedId
                            ? "💾 Atualizar"
                            : "📤 Enviar"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
            );

    const componentes = [
        linha1,
        linha2,
        linha3
    ];

    // =================================================
    // 🗑️ EXCLUIR EMBED
    // =================================================

    if (config.editandoEmbedId) {
        const linhaExcluir =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            "embed_delete_current"
                        )
                        .setLabel(
                            "Excluir Embed"
                        )
                        .setEmoji("🗑️")
                        .setStyle(
                            ButtonStyle.Danger
                        )
                );

        componentes.push(
            linhaExcluir
        );
    }

    return {
        embeds: [embed],
        components: componentes
    };
}

// =====================================================
// 🔐 VERIFICAR ADMIN
// =====================================================

function isAdmin(interaction) {
    return (
        interaction.member &&
        interaction.member.permissions &&
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    );
}

// =====================================================
// 📦 EXPORTAÇÃO
// =====================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName("embed")
            .setDescription(
                "Abre o painel para criar e gerenciar embeds."
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ),

    // =================================================
    // 🚀 /EMBED
    // =================================================

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Este comando só pode ser usado dentro de um servidor.",
                ephemeral: true
            });
        }

        if (!isAdmin(interaction)) {
            return interaction.reply({
                content:
                    "❌ Você precisa da permissão de **Administrador do Discord** para usar este comando.",
                ephemeral: true
            });
        }

        const painel =
            criarPainelPrincipal();

        return interaction.reply({
            embeds:
                painel.embeds,
            components:
                painel.components,
            ephemeral: true
        });
    },

    // =================================================
    // 🔘 BOTÕES
    // =================================================

    async handleButton(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Este sistema só funciona dentro de servidores.",
                ephemeral: true
            });
        }

        if (!isAdmin(interaction)) {
            return interaction.reply({
                content:
                    "❌ Somente administradores podem configurar ou editar embeds.",
                ephemeral: true
            });
        }

        const userId =
            interaction.user.id;

        const guildId =
            interaction.guild.id;

        // =================================================
        // ➕ CRIAR
        // =================================================

        if (
            interaction.customId ===
            "embed_criar"
        ) {
            const chave =
                chaveConfiguracao(
                    userId,
                    guildId
                );

            const config =
                criarConfiguracao();

            configuracoes.set(
                chave,
                config
            );

            const painel =
                criarPainel(
                    config
                );

            return interaction.update({
                content: "",
                embeds:
                    painel.embeds,
                components:
                    painel.components
            });
        }

        // =================================================
        // ⚙️ CONFIGURAR
        // =================================================

        if (
            interaction.customId ===
            "embed_configurar"
        ) {
            try {
                const painel =
                    await criarPainelConfiguracao(
                        guildId,
                        0
                    );

                return interaction.update({
                    content: "",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao carregar embeds:",
                    erro
                );

                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    return interaction.reply({
                        content:
                            "❌ Não foi possível carregar os embeds deste servidor.",
                        ephemeral: true
                    });
                }
            }

            return;
        }

        // =================================================
        // 📄 PAGINAÇÃO
        // =================================================

        if (
            interaction.customId.startsWith(
                "embed_pagina_"
            )
        ) {
            try {
                const pagina =
                    parseInt(
                        interaction.customId.replace(
                            "embed_pagina_",
                            ""
                        ),
                        10
                    );

                if (
                    Number.isNaN(
                        pagina
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Página inválida.",
                        ephemeral: true
                    });
                }

                const painel =
                    await criarPainelConfiguracao(
                        guildId,
                        pagina
                    );

                return interaction.update({
                    content: "",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao trocar página dos embeds:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível carregar essa página.",
                    ephemeral: true
                });
            }
        }

        // =================================================
        // ↩️ VOLTAR
        // =================================================

        if (
            interaction.customId ===
            "embed_voltar"
        ) {
            const painel =
                criarPainelPrincipal();

            return interaction.update({
                content: "",
                embeds:
                    painel.embeds,
                components:
                    painel.components
            });
        }

        // =================================================
        // ✏️ EDITAR / CONFIGURAR EMBED EXISTENTE
        // =================================================

        if (
            interaction.customId.startsWith(
                "embed_edit_"
            )
        ) {
            try {
                const embedId =
                    interaction.customId.replace(
                        "embed_edit_",
                        ""
                    );

                const dados =
                    await getEmbedPorId(
                        embedId,
                        guildId
                    );

                if (!dados) {
                    return interaction.reply({
                        content:
                            "❌ Não encontrei esse embed neste servidor.",
                        ephemeral: true
                    });
                }

                const config =
                    criarConfigAPartirDoBanco(
                        dados
                    );

                const chave =
                    chaveConfiguracao(
                        userId,
                        guildId
                    );

                configuracoes.set(
                    chave,
                    config
                );

                const painel =
                    criarPainel(
                        config
                    );

                return interaction.update({
                    content:
                        "✏️ **Modo de configuração ativado.**\nAs alterações serão aplicadas na mesma mensagem.",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao configurar embed:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível abrir a configuração desse embed.",
                    ephemeral: true
                });
            }
        }

        // =================================================
        // ⚙️ CONFIGURAR EMBED - COMPATIBILIDADE
        // =================================================

        if (
            interaction.customId.startsWith(
                "embed_config_"
            )
        ) {
            try {
                const embedId =
                    interaction.customId.replace(
                        "embed_config_",
                        ""
                    );

                const dados =
                    await getEmbedPorId(
                        embedId,
                        guildId
                    );

                if (!dados) {
                    return interaction.reply({
                        content:
                            "❌ Não encontrei esse embed neste servidor.",
                        ephemeral: true
                    });
                }

                const config =
                    criarConfigAPartirDoBanco(
                        dados
                    );

                const chave =
                    chaveConfiguracao(
                        userId,
                        guildId
                    );

                configuracoes.set(
                    chave,
                    config
                );

                const painel =
                    criarPainel(
                        config
                    );

                return interaction.reply({
                    content:
                        "⚙️ **Configuração do embed ativada.**",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components,
                    ephemeral: true
                });

            } catch (erro) {
                console.error(
                    "❌ Erro na configuração do embed:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível configurar esse embed.",
                    ephemeral: true
                });
            }
        }

        // =================================================
        // 🗑️ EXCLUIR EMBED ATUAL
        // =================================================

        if (
            interaction.customId ===
            "embed_delete_current"
        ) {
            try {
                const chave =
                    chaveConfiguracao(
                        userId,
                        guildId
                    );

                const config =
                    configuracoes.get(
                        chave
                    );

                if (
                    !config ||
                    !config.editandoEmbedId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Nenhum embed está sendo configurado.",
                        ephemeral: true
                    });
                }

                const embedId =
                    config.editandoEmbedId;

                const dados =
                    await getEmbedPorId(
                        embedId,
                        guildId
                    );

                if (!dados) {
                    configuracoes.delete(
                        chave
                    );

                    return interaction.reply({
                        content:
                            "❌ Não encontrei esse embed no banco de dados.",
                        ephemeral: true
                    });
                }

                // =========================================
                // 🗑️ EXCLUIR MENSAGEM DO DISCORD
                // =========================================

                if (
                    dados.canal_id &&
                    dados.mensagem_id
                ) {
                    const canal =
                        await interaction.guild.channels
                            .fetch(
                                dados.canal_id
                            )
                            .catch(
                                () => null
                            );

                    if (
                        canal &&
                        canal.isTextBased()
                    ) {
                        const mensagem =
                            await canal.messages
                                .fetch(
                                    dados.mensagem_id
                                )
                                .catch(
                                    () => null
                                );

                        if (mensagem) {
                            await mensagem
                                .delete()
                                .catch(
                                    () => {}
                                );
                        }
                    }
                }

                // =========================================
                // 🗑️ EXCLUIR DO BANCO
                // =========================================

                await excluirEmbedBanco(
                    embedId,
                    guildId
                );

                configuracoes.delete(
                    chave
                );

                const painel =
                    await criarPainelConfiguracao(
                        guildId,
                        0
                    );

                return interaction.update({
                    content:
                        "🗑️ Embed excluído com sucesso.",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao excluir embed:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível excluir o embed.",
                    ephemeral: true
                });
            }
        }

        // =================================================
        // 🔧 CONFIGURAÇÃO TEMPORÁRIA
        // =================================================

        const chave =
            chaveConfiguracao(
                userId,
                guildId
            );

        const config =
            configuracoes.get(
                chave
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua configuração expirou. Use `/embed` novamente.",
                ephemeral: true
            });
        }

        // =================================================
        // 📝 TÍTULO
        // =================================================

        if (
            interaction.customId ===
            "embed_titulo"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_titulo"
                    )
                    .setTitle(
                        "📝 Configurar título"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "titulo"
                    )
                    .setLabel(
                        "Título do embed"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(256)
                    .setValue(
                        config.titulo ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 📄 DESCRIÇÃO
        // =================================================

        if (
            interaction.customId ===
            "embed_descricao"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_descricao"
                    )
                    .setTitle(
                        "📄 Configurar descrição"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "descricao"
                    )
                    .setLabel(
                        "Descrição do embed"
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(false)
                    .setMaxLength(4000)
                    .setValue(
                        config.descricao ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🖼️ IMAGEM
        // =================================================

        if (
            interaction.customId ===
            "embed_imagem"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_imagem"
                    )
                    .setTitle(
                        "🖼️ Configurar imagem"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "imagem"
                    )
                    .setLabel(
                        "URL da imagem"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "https://exemplo.com/imagem.png"
                    )
                    .setValue(
                        config.imagem ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🔗 THUMBNAIL
        // =================================================

        if (
            interaction.customId ===
            "embed_thumbnail"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_thumbnail"
                    )
                    .setTitle(
                        "🔗 Configurar thumbnail"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "thumbnail"
                    )
                    .setLabel(
                        "URL da thumbnail"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "https://exemplo.com/imagem.png"
                    )
                    .setValue(
                        config.thumbnail ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🎨 COR
        // =================================================

        if (
            interaction.customId ===
            "embed_cor"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_cor"
                    )
                    .setTitle(
                        "🎨 Configurar cor"
                    );

            const input =
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
                        "#5865F2"
                    )
                    .setValue(
                        config.cor ||
                        "#5865F2"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 👤 AUTOR
        // =================================================

        if (
            interaction.customId ===
            "embed_autor"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_autor"
                    )
                    .setTitle(
                        "👤 Configurar autor"
                    );

            const nome =
                new TextInputBuilder()
                    .setCustomId(
                        "autor"
                    )
                    .setLabel(
                        "Nome do autor"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(256)
                    .setValue(
                        config.autor ||
                        ""
                    );

            const icone =
                new TextInputBuilder()
                    .setCustomId(
                        "autor_icone"
                    )
                    .setLabel(
                        "URL do ícone do autor"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "https://exemplo.com/icone.png"
                    )
                    .setValue(
                        config.autorIcone ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                icone
                            )
                    )
            );

            // Corrige a estrutura das linhas do modal
            modal.setComponents(
                new ActionRowBuilder()
                    .addComponents(
                        nome
                    ),

                new ActionRowBuilder()
                    .addComponents(
                        icone
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 📝 RODAPÉ
        // =================================================

        if (
            interaction.customId ===
            "embed_footer"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_footer"
                    )
                    .setTitle(
                        "📝 Configurar rodapé"
                    );

            const texto =
                new TextInputBuilder()
                    .setCustomId(
                        "footer"
                    )
                    .setLabel(
                        "Texto do rodapé"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(2048)
                    .setValue(
                        config.footer ||
                        ""
                    );

            const icone =
                new TextInputBuilder()
                    .setCustomId(
                        "footer_icone"
                    )
                    .setLabel(
                        "URL do ícone do rodapé"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "https://exemplo.com/icone.png"
                    )
                    .setValue(
                        config.footerIcone ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        texto
                    ),

                new ActionRowBuilder()
                    .addComponents(
                        icone
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 📍 CANAL
        // =================================================

        if (
            interaction.customId ===
            "embed_canal"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_canal"
                    )
                    .setTitle(
                        "📍 Configurar canal"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "canal"
                    )
                    .setLabel(
                        "ID do canal"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "Ex: 123456789012345678"
                    )
                    .setValue(
                        config.canalId ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🕐 TIMESTAMP
        // =================================================

        if (
            interaction.customId ===
            "embed_timestamp"
        ) {
            config.timestamp =
                !config.timestamp;

            return interaction.reply({
                content:
                    config.timestamp
                        ? "🕐 Timestamp ativado!"
                        : "🕐 Timestamp desativado!",
                ephemeral: true
            });
        }

        // =================================================
        // 👀 PRÉ-VISUALIZAÇÃO
        // =================================================

        if (
            interaction.customId ===
            "embed_preview"
        ) {
            const resultado =
                criarEmbed(
                    config,
                    interaction.user
                );

            if (!resultado.sucesso) {
                return interaction.reply({
                    content:
                        resultado.erro,
                    ephemeral: true
                });
            }

            return interaction.reply({
                content:
                    "👀 **Pré-visualização:**",
                embeds: [
                    resultado.embed
                ],
                ephemeral: true
            });
        }

        // =================================================
        // 📤 ENVIAR / ATUALIZAR
        // =================================================

        if (
            interaction.customId ===
            "embed_send"
        ) {
            const resultado =
                criarEmbed(
                    config,
                    interaction.user
                );

            if (!resultado.sucesso) {
                return interaction.reply({
                    content:
                        resultado.erro,
                    ephemeral: true
                });
            }

            let canal;

            if (config.canalId) {
                canal =
                    await interaction.guild.channels
                        .fetch(
                            config.canalId
                        )
                        .catch(
                            () => null
                        );
            } else {
                canal =
                    interaction.channel;
            }

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        "❌ O canal configurado não existe ou não é um canal de texto válido.",
                    ephemeral: true
                });
            }

            // =================================================
            // ✏️ ATUALIZAR EXISTENTE
            // =================================================

            if (
                config.editandoEmbedId
            ) {
                const dados =
                    await getEmbedPorId(
                        config.editandoEmbedId,
                        guildId
                    );

                if (!dados) {
                    return interaction.reply({
                        content:
                            "❌ Não encontrei o embed que você estava configurando.",
                        ephemeral: true
                    });
                }

                try {
                    let mensagem = null;

                    // =========================================
                    // 🔎 PROCURAR MENSAGEM ANTIGA
                    // =========================================

                    if (
                        dados.canal_id &&
                        dados.mensagem_id
                    ) {
                        const canalAntigo =
                            await interaction.guild.channels
                                .fetch(
                                    dados.canal_id
                                )
                                .catch(
                                    () => null
                                );

                        if (
                            canalAntigo &&
                            canalAntigo.isTextBased()
                        ) {
                            mensagem =
                                await canalAntigo.messages
                                    .fetch(
                                        dados.mensagem_id
                                    )
                                    .catch(
                                        () => null
                                    );
                        }
                    }

                    // =========================================
                    // ✏️ EDITAR MESMA MENSAGEM
                    // =========================================

                    if (mensagem) {
                        await mensagem.edit({
                            embeds: [
                                resultado.embed
                            ],
                            components: []
                        });

                        await atualizarEmbedBanco(
                            dados.id,
                            guildId,
                            {
                                config: {
                                    ...config,
                                    editandoEmbedId:
                                        null
                                },

                                canalId:
                                    mensagem.channel.id,

                                mensagemId:
                                    mensagem.id
                            }
                        );

                        configuracoes.delete(
                            chave
                        );

                        return interaction.update({
                            content:
                                "✅ Embed atualizado com sucesso na mesma mensagem!",
                            embeds: [],
                            components: []
                        });
                    }

                    // =========================================
                    // 🆕 MENSAGEM ANTIGA NÃO EXISTE
                    // =========================================

                    const novaMensagem =
                        await canal.send({
                            embeds: [
                                resultado.embed
                            ],
                            components: []
                        });

                    await atualizarEmbedBanco(
                        dados.id,
                        guildId,
                        {
                            config: {
                                ...config,
                                editandoEmbedId:
                                    null
                            },

                            canalId:
                                novaMensagem.channel.id,

                            mensagemId:
                                novaMensagem.id
                        }
                    );

                    configuracoes.delete(
                        chave
                    );

                    return interaction.update({
                        content:
                            "⚠️ A mensagem antiga não foi encontrada. Um novo embed foi enviado.",
                        embeds: [],
                        components: []
                    });

                } catch (erro) {
                    console.error(
                        "❌ Erro ao atualizar embed:",
                        erro
                    );

                    return interaction.reply({
                        content:
                            "❌ Não foi possível atualizar o embed.",
                        ephemeral: true
                    });
                }
            }

            // =================================================
            // 🆕 CRIAR NOVO EMBED
            // =================================================

            try {
                const dadosBanco =
                    await criarEmbedBanco(
                        guildId,
                        interaction.user.id,
                        config
                    );

                const mensagem =
                    await canal.send({
                        embeds: [
                            resultado.embed
                        ],
                        components: []
                    });

                await salvarMensagemEmbed(
                    dadosBanco.id,
                    canal.id,
                    mensagem.id
                );

                configuracoes.delete(
                    chave
                );

                return interaction.update({
                    content:
                        `✅ Embed enviado com sucesso em <#${canal.id}>!`,
                    embeds: [],
                    components: []
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao enviar embed:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível enviar o embed nesse canal. Verifique as permissões do bot e a conexão com o banco.",
                    ephemeral: true
                });
            }
        }
    },

    // =====================================================
    // 📝 MODAIS
    // =====================================================

    async handleModal(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Este sistema só funciona dentro de servidores.",
                ephemeral: true
            });
        }

        if (!isAdmin(interaction)) {
            return interaction.reply({
                content:
                    "❌ Somente administradores podem alterar embeds.",
                ephemeral: true
            });
        }

        const userId =
            interaction.user.id;

        const guildId =
            interaction.guild.id;

        const chave =
            chaveConfiguracao(
                userId,
                guildId
            );

        const config =
            configuracoes.get(
                chave
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua configuração de embed expirou. Use `/embed` novamente.",
                ephemeral: true
            });
        }

        // =================================================
        // 📝 TÍTULO
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_titulo"
        ) {
            config.titulo =
                interaction.fields
                    .getTextInputValue(
                        "titulo"
                    )
                    .trim();

            return interaction.reply({
                content:
                    "✅ Título atualizado!",
                ephemeral: true
            });
        }

        // =================================================
        // 📄 DESCRIÇÃO
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_descricao"
        ) {
            config.descricao =
                interaction.fields
                    .getTextInputValue(
                        "descricao"
                    )
                    .trim();

            return interaction.reply({
                content:
                    "✅ Descrição atualizada!",
                ephemeral: true
            });
        }

        // =================================================
        // 🖼️ IMAGEM
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_imagem"
        ) {
            const imagem =
                interaction.fields
                    .getTextInputValue(
                        "imagem"
                    )
                    .trim();

            if (
                imagem &&
                !validarURL(imagem)
            ) {
                return interaction.reply({
                    content:
                        "❌ URL da imagem inválida.",
                    ephemeral: true
                });
            }

            config.imagem =
                imagem;

            return interaction.reply({
                content:
                    "✅ Imagem atualizada!",
                ephemeral: true
            });
        }

        // =================================================
        // 🔗 THUMBNAIL
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_thumbnail"
        ) {
            const thumbnail =
                interaction.fields
                    .getTextInputValue(
                        "thumbnail"
                    )
                    .trim();

            if (
                thumbnail &&
                !validarURL(thumbnail)
            ) {
                return interaction.reply({
                    content:
                        "❌ URL da thumbnail inválida.",
                    ephemeral: true
                });
            }

            config.thumbnail =
                thumbnail;

            return interaction.reply({
                content:
                    "✅ Thumbnail atualizada!",
                ephemeral: true
            });
        }

        // =================================================
        // 🎨 COR
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_cor"
        ) {
            const cor =
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
                return interaction.reply({
                    content:
                        "❌ Cor inválida! Use o formato `#5865F2`.",
                    ephemeral: true
                });
            }

            config.cor =
                cor ||
                "#5865F2";

            return interaction.reply({
                content:
                    "✅ Cor atualizada!",
                ephemeral: true
            });
        }

        // =================================================
        // 👤 AUTOR
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_autor"
        ) {
            const autor =
                interaction.fields
                    .getTextInputValue(
                        "autor"
                    )
                    .trim();

            const autorIcone =
                interaction.fields
                    .getTextInputValue(
                        "autor_icone"
                    )
                    .trim();

            if (
                autorIcone &&
                !validarURL(
                    autorIcone
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ URL do ícone do autor inválida.",
                    ephemeral: true
                });
            }

            config.autor =
                autor;

            config.autorIcone =
                autorIcone;

            return interaction.reply({
                content:
                    "✅ Autor e ícone do autor atualizados!",
                ephemeral: true
            });
        }

        // =================================================
        // 📝 RODAPÉ
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_footer"
        ) {
            const footer =
                interaction.fields
                    .getTextInputValue(
                        "footer"
                    )
                    .trim();

            const footerIcone =
                interaction.fields
                    .getTextInputValue(
                        "footer_icone"
                    )
                    .trim();

            if (
                footerIcone &&
                !validarURL(
                    footerIcone
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ URL do ícone do rodapé inválida.",
                    ephemeral: true
                });
            }

            config.footer =
                footer;

            config.footerIcone =
                footerIcone;

            return interaction.reply({
                content:
                    "✅ Rodapé e ícone do rodapé atualizados!",
                ephemeral: true
            });
        }

        // =================================================
        // 📍 CANAL
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_canal"
        ) {
            const canalId =
                interaction.fields
                    .getTextInputValue(
                        "canal"
                    )
                    .trim();

            if (!canalId) {
                config.canalId =
                    "";

                if (
                    config.editandoEmbedId
                ) {
                    await atualizarCanalEmbed(
                        config.editandoEmbedId,
                        guildId,
                        null
                    ).catch(
                        () => {}
                    );
                }

                return interaction.reply({
                    content:
                        "✅ Canal removido. O embed será enviado no canal atual.",
                    ephemeral: true
                });
            }

            const canal =
                await interaction.guild.channels
                    .fetch(
                        canalId
                    )
                    .catch(
                        () => null
                    );

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        "❌ Canal inválido. Coloque o ID de um canal de texto deste servidor.",
                    ephemeral: true
                });
            }

            config.canalId =
                canal.id;

            if (
                config.editandoEmbedId
            ) {
                await atualizarCanalEmbed(
                    config.editandoEmbedId,
                    guildId,
                    canal.id
                ).catch(
                    () => {}
                );
            }

            return interaction.reply({
                content:
                    `✅ Canal configurado: <#${canal.id}>`,
                ephemeral: true
            });
        }
    }
};
