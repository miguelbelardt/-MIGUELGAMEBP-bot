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

// =====================================================
// 💾 EMBEDS EM MEMÓRIA
// =====================================================

// Configurações temporárias dos painéis
const configuracoes = new Map();

// Embeds publicados
// guildId -> Map(messageId -> dados)
const embedsPublicados = new Map();

// =====================================================
// 🛠️ FUNÇÕES AUXILIARES
// =====================================================

function getGuildEmbeds(guildId) {
    if (!embedsPublicados.has(guildId)) {
        embedsPublicados.set(
            guildId,
            new Map()
        );
    }

    return embedsPublicados.get(guildId);
}

function criarConfiguracao() {
    return {
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

        canalId: ""
    };
}

function chaveConfiguracao(userId, guildId) {
    return `${guildId}:${userId}`;
}

function chaveEmbed(guildId, messageId) {
    return `${guildId}:${messageId}`;
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
// 🛠️ CRIAR EMBED
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
        .setColor(config.cor || "#5865F2");

    // =================================================
    // 📝 TÍTULO
    // =================================================

    if (config.titulo) {
        embed.setTitle(config.titulo);
    }

    // =================================================
    // 📄 DESCRIÇÃO
    // =================================================

    if (config.descricao) {
        embed.setDescription(config.descricao);
    }

    // =================================================
    // 🖼️ IMAGEM
    // =================================================

    if (config.imagem) {
        embed.setImage(config.imagem);
    }

    // =================================================
    // 🔗 THUMBNAIL
    // =================================================

    if (config.thumbnail) {
        embed.setThumbnail(config.thumbnail);
    }

    // =================================================
    // 👤 AUTOR
    // =================================================

    if (config.autor) {

        const autor = {
            name: config.autor
        };

        if (config.autorIcone) {
            autor.iconURL = config.autorIcone;
        }

        embed.setAuthor(autor);
    }

    // =================================================
    // 📝 RODAPÉ
    // =================================================

    if (config.footer) {

        const footer = {
            text: config.footer
        };

        if (config.footerIcone) {
            footer.iconURL = config.footerIcone;
        }

        embed.setFooter(footer);

    } else if (usuario) {

        // Se não configurou rodapé,
        // mantém o comportamento antigo.
        embed.setFooter({
            text: `Enviado por ${usuario.username}`
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
// 🔘 BOTÕES DO EMBED PUBLICADO
// =====================================================

function criarBotoesEmbed(guildId, messageId) {

    return [
        new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId(
                    `embed_config_${guildId}_${messageId}`
                )
                .setLabel("⚙️ Configurar")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId(
                    `embed_edit_${guildId}_${messageId}`
                )
                .setLabel("✏️ Editar")
                .setStyle(ButtonStyle.Primary)
        )
    ];
}

// =====================================================
// 📋 PAINEL PRINCIPAL
// =====================================================

function criarPainel(config) {

    const embed = new EmbedBuilder()
        .setTitle("🎨 CONFIGURADOR DE EMBED")
        .setDescription(
            "Configure seu embed usando os botões abaixo.\n\n" +
            "🔒 **Somente administradores podem utilizar este painel.**\n\n" +
            "👀 Depois de enviar, o embed ficará visível para todos no servidor.\n" +
            "✏️ Administradores poderão editar o mesmo embed depois."
        )
        .setColor(config.cor || "#5865F2");

    // =================================================
    // 📍 CANAL
    // =================================================

    let canalTexto = "📍 Canal: canal atual";

    if (config.canalId) {
        canalTexto =
            `📍 Canal configurado: <#${config.canalId}>`;
    }

    embed.addFields({
        name: "📤 Destino",
        value: canalTexto
    });

    // =================================================
    // LINHA 1
    // =================================================

    const linha1 = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
            .setCustomId("embed_titulo")
            .setLabel("📝 Título")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("embed_descricao")
            .setLabel("📄 Descrição")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("embed_autor")
            .setLabel("👤 Autor")
            .setStyle(ButtonStyle.Primary)
    );

    // =================================================
    // LINHA 2
    // =================================================

    const linha2 = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
            .setCustomId("embed_imagem")
            .setLabel("🖼️ Imagem")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("embed_thumbnail")
            .setLabel("🔗 Thumbnail")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("embed_cor")
            .setLabel("🎨 Cor")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("embed_timestamp")
            .setLabel("🕐 Timestamp")
            .setStyle(ButtonStyle.Secondary)
    );

    // =================================================
    // LINHA 3
    // =================================================

    const linha3 = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
            .setCustomId("embed_footer")
            .setLabel("📝 Rodapé")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("embed_canal")
            .setLabel("📍 Canal")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("embed_preview")
            .setLabel("👀 Pré-visualizar")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("embed_send")
            .setLabel("📤 Enviar")
            .setStyle(ButtonStyle.Success)
    );

    return {
        embeds: [embed],
        components: [
            linha1,
            linha2,
            linha3
        ]
    };
}

// =====================================================
// 📦 EXPORTAÇÃO
// =====================================================

module.exports = {

    data: new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Abre o painel para criar um embed.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    // =================================================
    // 🚀 /EMBED
    // =================================================

    async execute(interaction) {

        // =================================================
        // 🔐 ADMIN
        // =================================================

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {

            return interaction.reply({
                content:
                    "❌ Você precisa ter a permissão de **Administrador do Discord** para usar este comando.",
                ephemeral: true
            });
        }

        if (!interaction.guild) {

            return interaction.reply({
                content:
                    "❌ Este comando só pode ser usado dentro de um servidor.",
                ephemeral: true
            });
        }

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

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
            criarPainel(config);

        await interaction.reply({
            embeds: painel.embeds,
            components: painel.components,
            ephemeral: true
        });
    },

    // =================================================
    // 🔘 BOTÕES
    // =================================================

    async handleButton(interaction) {

        // =================================================
        // 🔐 GARANTIR ADMIN
        // =================================================

        if (
            !interaction.member ||
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {

            return interaction.reply({
                content:
                    "❌ Você precisa ter a permissão de **Administrador do Discord** para configurar ou editar embeds.",
                ephemeral: true
            });
        }

        if (!interaction.guild) {

            return interaction.reply({
                content:
                    "❌ Este sistema só funciona dentro de servidores.",
                ephemeral: true
            });
        }

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // =================================================
        // ✏️ EDITAR EMBED PUBLICADO
        // =================================================

        if (
            interaction.customId.startsWith(
                "embed_edit_"
            )
        ) {

            const partes =
                interaction.customId.split("_");

            const messageId =
                partes[partes.length - 1];

            const embedsServidor =
                getGuildEmbeds(guildId);

            const dados =
                embedsServidor.get(messageId);

            if (!dados) {

                return interaction.reply({
                    content:
                        "❌ Não encontrei os dados desse embed. Ele pode ter sido criado antes desta versão do sistema ou os dados foram perdidos após o bot reiniciar.",
                    ephemeral: true
                });
            }

            const config =
                JSON.parse(
                    JSON.stringify(
                        dados.config
                    )
                );

            const chave =
                chaveConfiguracao(
                    userId,
                    guildId
                );

            configuracoes.set(
                chave,
                {
                    ...config,
                    editandoMessageId:
                        messageId
                }
            );

            const painel =
                criarPainel(config);

            return interaction.reply({
                content:
                    "✏️ **Modo de edição ativado.**\nAs alterações serão aplicadas na mesma mensagem do embed.",
                embeds:
                    painel.embeds,
                components:
                    painel.components,
                ephemeral: true
            });
        }

        // =================================================
        // ⚙️ CONFIGURAR EMBED PUBLICADO
        // =================================================

        if (
            interaction.customId.startsWith(
                "embed_config_"
            )
        ) {

            const partes =
                interaction.customId.split("_");

            const messageId =
                partes[partes.length - 1];

            const embedsServidor =
                getGuildEmbeds(guildId);

            const dados =
                embedsServidor.get(messageId);

            if (!dados) {

                return interaction.reply({
                    content:
                        "❌ Não encontrei os dados desse embed.",
                    ephemeral: true
                });
            }

            return interaction.reply({
                content:
                    "⚙️ **Embed configurado!**\n\n" +
                    `📍 Canal: <#${dados.channelId}>\n` +
                    `👤 Criado por: <@${dados.ownerId}>\n\n` +
                    "Use **✏️ Editar** para alterar o conteúdo.",
                ephemeral: true
            });
        }

        // =================================================
        // CONFIGURAÇÃO TEMPORÁRIA
        // =================================================

        const chave =
            chaveConfiguracao(
                userId,
                guildId
            );

        const config =
            configuracoes.get(chave);

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
                    .setCustomId("titulo")
                    .setLabel(
                        "Título do embed"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(256)
                    .setValue(
                        config.titulo || ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(input)
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
                    .setCustomId("descricao")
                    .setLabel(
                        "Descrição do embed"
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(false)
                    .setMaxLength(4000)
                    .setValue(
                        config.descricao || ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(input)
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
                    .setCustomId("imagem")
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
                        config.imagem || ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(input)
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
                    .setCustomId("thumbnail")
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
                        config.thumbnail || ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(input)
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
                    .setCustomId("cor")
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
                        config.cor || "#5865F2"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(input)
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
                    .setCustomId("autor")
                    .setLabel(
                        "Nome do autor"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(256)
                    .setValue(
                        config.autor || ""
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
                        config.autorIcone || ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(nome),

                new ActionRowBuilder()
                    .addComponents(icone)
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
                    .setCustomId("footer")
                    .setLabel(
                        "Texto do rodapé"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(2048)
                    .setValue(
                        config.footer || ""
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
                        config.footerIcone || ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(texto),

                new ActionRowBuilder()
                    .addComponents(icone)
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
                        config.canalId || ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(input)
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

            // =================================================
            // 📍 DETERMINAR CANAL
            // =================================================

            let canal;

            if (config.canalId) {

                canal =
                    await interaction.guild.channels
                        .fetch(config.canalId)
                        .catch(() => null);

            } else {

                canal =
                    interaction.channel;
            }

            if (!canal || !canal.isTextBased()) {

                return interaction.reply({
                    content:
                        "❌ O canal configurado não existe ou não é um canal de texto válido.",
                    ephemeral: true
                });
            }

            // =================================================
            // ✏️ EDITAR EMBED EXISTENTE
            // =================================================

            if (config.editandoMessageId) {

                const embedsServidor =
                    getGuildEmbeds(guildId);

                const dados =
                    embedsServidor.get(
                        config.editandoMessageId
                    );

                if (!dados) {

                    return interaction.reply({
                        content:
                            "❌ Não encontrei o embed que você estava editando.",
                        ephemeral: true
                    });
                }

                try {

                    const mensagem =
                        await canal.messages.fetch(
                            config.editandoMessageId
                        );

                    await mensagem.edit({
                        embeds: [
                            resultado.embed
                        ],
                        components:
                            criarBotoesEmbed(
                                guildId,
                                mensagem.id
                            )
                    });

                    dados.config =
                        {
                            ...config
                        };

                    delete dados.config.editandoMessageId;

                    dados.channelId =
                        canal.id;

                    return interaction.update({
                        content:
                            "✅ Embed atualizado com sucesso!",
                        embeds: [],
                        components: []
                    });

                } catch (erro) {

                    console.error(
                        "❌ Erro ao editar embed:",
                        erro
                    );

                    return interaction.reply({
                        content:
                            "❌ Não foi possível atualizar o embed. Verifique se o bot consegue acessar o canal e a mensagem.",
                        ephemeral: true
                    });
                }
            }

            // =================================================
            // 🆕 CRIAR NOVO EMBED
            // =================================================

            try {

                const mensagem =
                    await canal.send({
                        embeds: [
                            resultado.embed
                        ]
                    });

                const embedsServidor =
                    getGuildEmbeds(guildId);

                embedsServidor.set(
                    mensagem.id,
                    {
                        messageId:
                            mensagem.id,

                        channelId:
                            canal.id,

                        ownerId:
                            interaction.user.id,

                        config:
                            {
                                ...config
                            }
                    }
                );

                // Adiciona os botões depois que temos o ID
                await mensagem.edit({
                    embeds: [
                        resultado.embed
                    ],
                    components:
                        criarBotoesEmbed(
                            guildId,
                            mensagem.id
                        )
                });

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
                        "❌ Não foi possível enviar o embed nesse canal. Verifique as permissões do bot.",
                    ephemeral: true
                });
            }
        }
    },

    // =================================================
    // 📝 MODAIS
    // =================================================

    async handleModal(interaction) {

        if (
            !interaction.member ||
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {

            return interaction.reply({
                content:
                    "❌ Você precisa ter a permissão de **Administrador do Discord** para alterar embeds.",
                ephemeral: true
            });
        }

        if (!interaction.guild) {

            return interaction.reply({
                content:
                    "❌ Este sistema só funciona dentro de servidores.",
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
            configuracoes.get(chave);

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
                !/^#[0-9A-Fa-f]{6}$/.test(cor)
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
                !validarURL(autorIcone)
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
                !validarURL(footerIcone)
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

                return interaction.reply({
                    content:
                        "✅ Canal removido. O embed será enviado no canal atual.",
                    ephemeral: true
                });
            }

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
                        "❌ Canal inválido. Coloque o ID de um canal de texto deste servidor.",
                    ephemeral: true
                });
            }

            config.canalId =
                canal.id;

            return interaction.reply({
                content:
                    `✅ Canal configurado: <#${canal.id}>`,
                ephemeral: true
            });
        }
    }
};
