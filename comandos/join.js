const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder
} = require("discord.js");

const {
    getJoinConfig,
    salvarJoinConfig,
    atualizarCanalJoin
} = require("../database/database");

// =====================================================
// 🔄 SUBSTITUIR VARIÁVEIS
// =====================================================

function substituirVariaveis(texto, dados) {
    if (
        texto === null ||
        texto === undefined
    ) {
        return "";
    }

    return String(texto)
        .replace(/\{user\}/gi, dados.user)
        .replace(/\{username\}/gi, dados.username)
        .replace(/\{userid\}/gi, dados.userid)
        .replace(/\{avatar\}/gi, dados.avatar)
        .replace(/\{banner\}/gi, dados.banner || "")
        .replace(/\{members\}/gi, String(dados.members))
        .replace(/\{server\}/gi, dados.server);
}

// =====================================================
// 🧹 VERIFICAR URL
// =====================================================

function urlValida(url) {
    if (
        !url ||
        typeof url !== "string"
    ) {
        return false;
    }

    return (
        url.startsWith("http://") ||
        url.startsWith("https://")
    );
}

// =====================================================
// 🔢 CONVERTER COR
// =====================================================

function converterCor(cor) {
    if (typeof cor === "number") {
        return cor;
    }

    if (typeof cor === "string") {
        const valor = cor.trim();

        if (valor.startsWith("0x")) {
            const numero = Number.parseInt(
                valor,
                16
            );

            if (!Number.isNaN(numero)) {
                return numero;
            }
        }

        if (valor.startsWith("#")) {
            const numero = Number.parseInt(
                valor.slice(1),
                16
            );

            if (!Number.isNaN(numero)) {
                return numero;
            }
        }

        const numero = Number(valor);

        if (!Number.isNaN(numero)) {
            return numero;
        }
    }

    return 0x5865F2;
}

// =====================================================
// 🔘 VERIFICAR BOOLEAN
// =====================================================

function estaAtivado(valor) {
    return (
        valor === true ||
        valor === 1 ||
        valor === "1" ||
        valor === "true"
    );
}

// =====================================================
// 👤 PEGAR DADOS DO USUÁRIO
// =====================================================

async function pegarDadosMembro(membro) {
    let usuario = membro.user;

    try {
        usuario = await membro.user.fetch();
    } catch (erro) {
        console.warn(
            "⚠️ Não foi possível atualizar os dados do usuário:",
            erro
        );
    }

    const avatar =
        usuario.displayAvatarURL({
            extension: "png",
            size: 1024
        });

    let banner = "";

    if (usuario.banner) {
        banner =
            usuario.bannerURL({
                extension: "png",
                size: 2048
            }) || "";
    }

    return {
        user: `<@${membro.id}>`,
        username: usuario.username,
        userid: membro.id,
        avatar,
        banner,
        members: membro.guild.memberCount,
        server: membro.guild.name
    };
}

// =====================================================
// 🎨 CRIAR EMBED
// =====================================================

function criarEmbedBoasVindas(
    configBanco,
    dados
) {
    if (
        !estaAtivado(
            configBanco.embed_habilitado
        )
    ) {
        return null;
    }

    const embed =
        new EmbedBuilder();

    // =================================================
    // 📝 TÍTULO
    // =================================================

    if (configBanco.embed_titulo) {
        const titulo =
            substituirVariaveis(
                configBanco.embed_titulo,
                dados
            );

        if (titulo) {
            embed.setTitle(titulo);
        }
    }

    // =================================================
    // 📄 DESCRIÇÃO
    // =================================================

    if (configBanco.embed_descricao) {
        const descricao =
            substituirVariaveis(
                configBanco.embed_descricao,
                dados
            );

        if (descricao) {
            embed.setDescription(
                descricao
            );
        }
    }

    // =================================================
    // 🎨 COR
    // =================================================

    if (
        configBanco.embed_cor !== null &&
        configBanco.embed_cor !== undefined &&
        configBanco.embed_cor !== ""
    ) {
        embed.setColor(
            converterCor(
                configBanco.embed_cor
            )
        );
    }

    // =================================================
    // 👤 AUTOR
    // =================================================

    if (
        estaAtivado(
            configBanco.autor_habilitado
        )
    ) {
        const nomeAutor =
            substituirVariaveis(
                configBanco.autor_nome,
                dados
            );

        const iconeAutor =
            substituirVariaveis(
                configBanco.autor_icone,
                dados
            );

        if (nomeAutor) {
            const autor = {
                name: nomeAutor
            };

            if (
                urlValida(
                    iconeAutor
                )
            ) {
                autor.iconURL =
                    iconeAutor;
            }

            embed.setAuthor(autor);
        }
    }

    // =================================================
    // 🖼️ THUMBNAIL
    // =================================================

    if (configBanco.thumbnail) {
        const thumbnail =
            substituirVariaveis(
                configBanco.thumbnail,
                dados
            );

        if (
            urlValida(thumbnail)
        ) {
            embed.setThumbnail(
                thumbnail
            );
        }
    }

    // =================================================
    // 🖼️ IMAGEM
    // =================================================

    if (configBanco.imagem) {
        const imagem =
            substituirVariaveis(
                configBanco.imagem,
                dados
            );

        if (
            urlValida(imagem)
        ) {
            embed.setImage(imagem);
        }
    }

    // =================================================
    // 📌 RODAPÉ
    // =================================================

    if (
        estaAtivado(
            configBanco.footer_habilitado
        )
    ) {
        const textoFooter =
            substituirVariaveis(
                configBanco.footer_texto,
                dados
            );

        const iconeFooter =
            substituirVariaveis(
                configBanco.footer_icone,
                dados
            );

        const footer = {
            text:
                textoFooter ||
                "Massa Com Chika"
        };

        if (
            urlValida(
                iconeFooter
            )
        ) {
            footer.iconURL =
                iconeFooter;
        }

        embed.setFooter(footer);
    }

    // =================================================
    // ⏰ TIMESTAMP
    // =================================================

    if (
        estaAtivado(
            configBanco.timestamp
        )
    ) {
        embed.setTimestamp();
    }

    return embed;
}

// =====================================================
// 👋 ENVIAR BOAS-VINDAS
// =====================================================

async function enviarBoasVindas(membro) {
    try {
        if (
            !membro ||
            !membro.guild
        ) {
            return;
        }

        const guild =
            membro.guild;

        let configBanco = null;

        try {
            configBanco =
                await getJoinConfig(
                    guild.id
                );
        } catch (erro) {
            console.error(
                "❌ Erro ao buscar configuração de boas-vindas no banco:",
                erro
            );

            return;
        }

        if (!configBanco) {
            console.log(
                `⚠️ Sistema de boas-vindas não configurado para ${guild.name}.`
            );

            return;
        }

        if (
            !estaAtivado(
                configBanco.habilitado
            )
        ) {
            return;
        }

        const canalId =
            configBanco.canal_id;

        if (!canalId) {
            console.log(
                `⚠️ Canal de boas-vindas não configurado em ${guild.name}.`
            );

            return;
        }

        const canal =
            guild.channels.cache.get(
                canalId
            );

        if (!canal) {
            console.error(
                `❌ Canal de boas-vindas não encontrado: ${canalId}`
            );

            return;
        }

        if (!canal.isTextBased()) {
            console.error(
                `❌ O canal configurado para boas-vindas não é de texto: ${canalId}`
            );

            return;
        }

        const dados =
            await pegarDadosMembro(
                membro
            );

        const embed =
            criarEmbedBoasVindas(
                configBanco,
                dados
            );

        const mensagem = {};

        if (
            configBanco.content !== null &&
            configBanco.content !== undefined &&
            configBanco.content !== ""
        ) {
            mensagem.content =
                substituirVariaveis(
                    configBanco.content,
                    dados
                );
        }

        if (embed) {
            mensagem.embeds = [
                embed
            ];
        }

        if (
            !mensagem.content &&
            !mensagem.embeds
        ) {
            console.warn(
                `⚠️ A configuração de boas-vindas de ${guild.name} não possui conteúdo para enviar.`
            );

            return;
        }

        await canal.send(
            mensagem
        );

        console.log(
            `👋 Boas-vindas enviadas para ${membro.user.tag} em ${guild.name}`
        );

    } catch (erro) {
        console.error(
            "❌ Erro ao enviar mensagem de boas-vindas:",
            erro
        );
    }
}

// =====================================================
// 🧪 GERAR DADOS DE TESTE
// =====================================================

async function pegarDadosTeste(interaction) {
    const usuario =
        interaction.user;

    let banner = "";

    try {
        const usuarioAtualizado =
            await usuario.fetch();

        if (
            usuarioAtualizado.banner
        ) {
            banner =
                usuarioAtualizado.bannerURL({
                    extension: "png",
                    size: 2048
                }) || "";
        }
    } catch (erro) {
        console.warn(
            "⚠️ Não foi possível obter o banner no teste:",
            erro
        );
    }

    return {
        user:
            `<@${interaction.user.id}>`,
        username:
            interaction.user.username,
        userid:
            interaction.user.id,
        avatar:
            interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024
            }),
        banner,
        members:
            interaction.guild.memberCount,
        server:
            interaction.guild.name
    };
}

// =====================================================
// 🧩 PAINEL DE CONFIGURAÇÃO
// =====================================================

function criarPainelJoin(config = {}) {
    const embed =
        new EmbedBuilder()
            .setTitle("👋 Configuração de Boas-vindas")
            .setDescription(
                "Use os botões abaixo para configurar o sistema de boas-vindas.\n\n" +
                "📢 **Canal:** selecione onde as mensagens serão enviadas.\n" +
                "📝 **Mensagem:** configure o content.\n" +
                "🎨 **Embed:** configure título, descrição e cor.\n" +
                "👤 **Autor:** configure nome e ícone do autor.\n" +
                "🖼️ **Imagens:** configure thumbnail e imagem.\n" +
                "📌 **Rodapé:** configure texto e ícone.\n" +
                "⚙️ **Opções:** configure ativação e timestamp.\n\n" +
                "As variáveis disponíveis continuam funcionando."
            )
            .setColor(
                converterCor(
                    config.embed_cor
                )
            )
            .addFields(
                {
                    name: "⚙️ Sistema",
                    value:
                        estaAtivado(config.habilitado)
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "🎨 Embed",
                    value:
                        estaAtivado(config.embed_habilitado)
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "📢 Canal",
                    value:
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "❌ Não configurado",
                    inline: true
                }
            );

    const canalSelect =
        new ChannelSelectMenuBuilder()
            .setCustomId(
                "join_config_canal"
            )
            .setPlaceholder(
                "📢 Selecione o canal de boas-vindas"
            )
            .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
            );

    const rowCanal =
        new ActionRowBuilder()
            .addComponents(
                canalSelect
            );

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "join_config_mensagem"
                    )
                    .setLabel("Mensagem")
                    .setEmoji("📝")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "join_config_embed"
                    )
                    .setLabel("Embed")
                    .setEmoji("🎨")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "join_config_autor"
                    )
                    .setLabel("Autor")
                    .setEmoji("👤")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "join_config_imagens"
                    )
                    .setLabel("Imagens")
                    .setEmoji("🖼️")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "join_config_footer"
                    )
                    .setLabel("Rodapé")
                    .setEmoji("📌")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "join_config_opcoes"
                    )
                    .setLabel("Opções")
                    .setEmoji("⚙️")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "join_config_status"
                    )
                    .setLabel("Status")
                    .setEmoji("📊")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "join_config_teste"
                    )
                    .setLabel("Testar")
                    .setEmoji("🧪")
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "join_config_fechar"
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
            rowCanal,
            row1,
            row2,
            row3
        ]
    };
}

// =====================================================
// 📝 MODAL - MENSAGEM
// =====================================================

function criarModalMensagem(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_mensagem"
            )
            .setTitle(
                "📝 Mensagem de boas-vindas"
            );

    const content =
        new TextInputBuilder()
            .setCustomId("content")
            .setLabel("Content da mensagem")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder(
                "Ex.: 👋 Seja bem-vindo(a), {user}!"
            )
            .setValue(
                config.content || ""
            )
            .setMaxLength(2000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(content)
    );

    return modal;
}

// =====================================================
// 🎨 MODAL - EMBED
// =====================================================

function criarModalEmbed(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_embed"
            )
            .setTitle(
                "🎨 Configuração do Embed"
            );

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config.embed_titulo ?? ""
                )
            )
            .setMaxLength(256);

    const descricao =
        new TextInputBuilder()
            .setCustomId("descricao")
            .setLabel("Descrição")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue(
                String(
                    config.embed_descricao ?? ""
                )
            )
            .setMaxLength(4000);

    const cor =
        new TextInputBuilder()
            .setCustomId("cor")
            .setLabel(
                "Cor (#5865F2, 0x5865F2 ou número)"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config.embed_cor ?? "#5865F2"
                )
            )
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(titulo),

        new ActionRowBuilder()
            .addComponents(descricao),

        new ActionRowBuilder()
            .addComponents(cor)
    );

    return modal;
}

// =====================================================
// 👤 MODAL - AUTOR
// =====================================================

function criarModalAutor(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_autor"
            )
            .setTitle(
                "👤 Configuração do Autor"
            );

    const nome =
        new TextInputBuilder()
            .setCustomId("nome")
            .setLabel("Nome do autor")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.autor_nome || ""
            )
            .setMaxLength(256);

    const icone =
        new TextInputBuilder()
            .setCustomId("icone")
            .setLabel("Ícone do autor")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.autor_icone || ""
            )
            .setMaxLength(1000);

    const habilitado =
        new TextInputBuilder()
            .setCustomId("habilitado")
            .setLabel("Autor ativado? (sim/não)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config.autor_habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(5);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(nome),

        new ActionRowBuilder()
            .addComponents(icone),

        new ActionRowBuilder()
            .addComponents(habilitado)
    );

    return modal;
}

// =====================================================
// 🖼️ MODAL - IMAGENS
// =====================================================

function criarModalImagens(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_imagens"
            )
            .setTitle(
                "🖼️ Imagens"
            );

    const thumbnail =
        new TextInputBuilder()
            .setCustomId("thumbnail")
            .setLabel("Thumbnail / URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.thumbnail || ""
            )
            .setMaxLength(1000);

    const imagem =
        new TextInputBuilder()
            .setCustomId("imagem")
            .setLabel("Imagem grande / URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.imagem || ""
            )
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(thumbnail),

        new ActionRowBuilder()
            .addComponents(imagem)
    );

    return modal;
}

// =====================================================
// 📌 MODAL - RODAPÉ
// =====================================================

function criarModalFooter(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_footer"
            )
            .setTitle(
                "📌 Configuração do Rodapé"
            );

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto do rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.footer_texto || ""
            )
            .setMaxLength(2048);

    const icone =
        new TextInputBuilder()
            .setCustomId("icone")
            .setLabel("Ícone do rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.footer_icone || ""
            )
            .setMaxLength(1000);

    const habilitado =
        new TextInputBuilder()
            .setCustomId("habilitado")
            .setLabel("Rodapé ativado? (sim/não)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config.footer_habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(5);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(texto),

        new ActionRowBuilder()
            .addComponents(icone),

        new ActionRowBuilder()
            .addComponents(habilitado)
    );

    return modal;
}

// =====================================================
// ⚙️ MODAL - OPÇÕES
// =====================================================

function criarModalOpcoes(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_opcoes"
            )
            .setTitle(
                "⚙️ Opções do Join"
            );

    const embed =
        new TextInputBuilder()
            .setCustomId("embed_habilitado")
            .setLabel("Embed ativado? (sim/não)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config.embed_habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(5);

    const timestamp =
        new TextInputBuilder()
            .setCustomId("timestamp")
            .setLabel("Timestamp ativado? (sim/não)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config.timestamp
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(5);

    const sistema =
        new TextInputBuilder()
            .setCustomId("habilitado")
            .setLabel("Sistema ativado? (sim/não)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config.habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(5);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(embed),

        new ActionRowBuilder()
            .addComponents(timestamp),

        new ActionRowBuilder()
            .addComponents(sistema)
    );

    return modal;
}

// =====================================================
// 📊 STATUS
// =====================================================

async function enviarStatusJoin(interaction) {
    const config =
        await getJoinConfig(
            interaction.guild.id
        );

    if (!config) {
        await interaction.reply({
            content:
                "⚠️ O sistema ainda não possui uma configuração salva.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    const embed =
        new EmbedBuilder()
            .setTitle(
                "📊 Status do sistema de boas-vindas"
            )
            .setColor(
                converterCor(
                    config.embed_cor
                )
            )
            .addFields(
                {
                    name: "📢 Canal",
                    value:
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "❌ Não configurado",
                    inline: true
                },
                {
                    name: "⚙️ Sistema",
                    value:
                        estaAtivado(
                            config.habilitado
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "🎨 Embed",
                    value:
                        estaAtivado(
                            config.embed_habilitado
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "👤 Autor",
                    value:
                        estaAtivado(
                            config.autor_habilitado
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "📌 Rodapé",
                    value:
                        estaAtivado(
                            config.footer_habilitado
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "⏰ Timestamp",
                    value:
                        estaAtivado(
                            config.timestamp
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                }
            );

    await interaction.reply({
        embeds: [embed],
        flags:
            MessageFlags.Ephemeral
    });
}

// =====================================================
// 🧪 TESTAR JOIN
// =====================================================

async function testarJoin(interaction) {
    const config =
        await getJoinConfig(
            interaction.guild.id
        );

    if (!config) {
        await interaction.reply({
            content:
                "⚠️ Configure o sistema primeiro.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    if (!config.canal_id) {
        await interaction.reply({
            content:
                "⚠️ Nenhum canal de boas-vindas foi configurado.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    const canal =
        interaction.guild.channels.cache.get(
            config.canal_id
        );

    if (!canal || !canal.isTextBased()) {
        await interaction.reply({
            content:
                "❌ O canal configurado não foi encontrado ou não é um canal de texto.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    const dados =
        await pegarDadosTeste(
            interaction
        );

    const embed =
        criarEmbedBoasVindas(
            config,
            dados
        );

    const mensagem = {};

    if (
        config.content !== null &&
        config.content !== undefined &&
        config.content !== ""
    ) {
        mensagem.content =
            substituirVariaveis(
                config.content,
                dados
            );
    }

    if (embed) {
        mensagem.embeds = [
            embed
        ];
    }

    if (
        !mensagem.content &&
        !mensagem.embeds
    ) {
        await interaction.reply({
            content:
                "⚠️ Não há conteúdo configurado para testar.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    await canal.send(
        mensagem
    );

    await interaction.reply({
        content:
            `✅ Mensagem de teste enviada em ${canal}.`,
        flags:
            MessageFlags.Ephemeral
    });
}

// =====================================================
// ⚙️ COMANDO /JOIN
// =====================================================

const data =
    new SlashCommandBuilder()
        .setName("join")
        .setDescription(
            "Configura o sistema de boas-vindas"
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )

        // =================================================
        // 📢 CONFIGURAR
        // =================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("configurar")
                    .setDescription(
                        "Abre o painel de configuração do Join"
                    )
        )

        // =================================================
        // 🟢 ATIVAR
        // =================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("ativar")
                    .setDescription(
                        "Ativa o sistema de boas-vindas"
                    )
        )

        // =================================================
        // 🔴 DESATIVAR
        // =================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("desativar")
                    .setDescription(
                        "Desativa o sistema de boas-vindas"
                    )
        )

        // =================================================
        // 📊 STATUS
        // =================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("status")
                    .setDescription(
                        "Mostra a configuração atual"
                    )
        )

        // =================================================
        // 🧪 TESTE
        // =================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("teste")
                    .setDescription(
                        "Envia uma mensagem de teste"
                    )
        );

// =====================================================
// ⚡ EXECUTAR COMANDO
// =====================================================

async function execute(interaction) {
    try {
        const subcomando =
            interaction.options.getSubcommand();

        const guildId =
            interaction.guild.id;

        // =================================================
        // 🧩 PAINEL
        // =================================================

        if (
            subcomando ===
            "configurar"
        ) {
            let config =
                await getJoinConfig(
                    guildId
                );

            if (!config) {
                config =
                    await salvarJoinConfig(
                        guildId,
                        {}
                    );
            }

            await interaction.reply({
                ...criarPainelJoin(config),
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // =================================================
        // 🟢 ATIVAR
        // =================================================

        if (
            subcomando ===
            "ativar"
        ) {
            const configAtual =
                await getJoinConfig(
                    guildId
                );

            await salvarJoinConfig(
                guildId,
                {
                    ...(configAtual || {}),
                    habilitado: true
                }
            );

            await interaction.reply({
                content:
                    "✅ Sistema de boas-vindas ativado!",
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // =================================================
        // 🔴 DESATIVAR
        // =================================================

        if (
            subcomando ===
            "desativar"
        ) {
            const configAtual =
                await getJoinConfig(
                    guildId
                );

            await salvarJoinConfig(
                guildId,
                {
                    ...(configAtual || {}),
                    habilitado: false
                }
            );

            await interaction.reply({
                content:
                    "🔴 Sistema de boas-vindas desativado!",
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // =================================================
        // 📊 STATUS
        // =================================================

        if (
            subcomando ===
            "status"
        ) {
            await enviarStatusJoin(
                interaction
            );

            return;
        }

        // =================================================
        // 🧪 TESTE
        // =================================================

        if (
            subcomando ===
            "teste"
        ) {
            await testarJoin(
                interaction
            );

            return;
        }

    } catch (erro) {
        console.error(
            "❌ Erro no comando /join:",
            erro
        );

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            await interaction.followUp({
                content:
                    "❌ Ocorreu um erro ao executar o comando.",
                flags:
                    MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({
                content:
                    "❌ Ocorreu um erro ao executar o comando.",
                flags:
                    MessageFlags.Ephemeral
            });
        }
    }
}

// =====================================================
// 🖱️ TRATAR INTERAÇÕES DO PAINEL
// =====================================================

async function tratarInteracao(interaction) {
    if (
        !interaction.guild
    ) {
        return false;
    }

    // Segurança extra
    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        if (
            interaction.isButton() ||
            interaction.isChannelSelectMenu()
        ) {
            await interaction.reply({
                content:
                    "❌ Você não possui permissão para configurar o sistema de boas-vindas.",
                flags:
                    MessageFlags.Ephemeral
            });
        } else if (
            interaction.isModalSubmit()
        ) {
            await interaction.reply({
                content:
                    "❌ Você não possui permissão para configurar o sistema de boas-vindas.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    const id =
        interaction.customId || "";

    // =================================================
    // 📢 SELECIONAR CANAL
    // =================================================

    if (
        interaction.isChannelSelectMenu() &&
        id === "join_config_canal"
    ) {
        const canal =
            interaction.channels.first();

        if (!canal) {
            await interaction.reply({
                content:
                    "❌ Nenhum canal foi selecionado.",
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await atualizarCanalJoin(
            interaction.guild.id,
            canal.id
        );

        await interaction.reply({
            content:
                `✅ Canal de boas-vindas definido para ${canal}.`,
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // =================================================
    // 📝 MENSAGEM
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_mensagem"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalMensagem(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 🎨 EMBED
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_embed"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalEmbed(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 👤 AUTOR
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_autor"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalAutor(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 🖼️ IMAGENS
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_imagens"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalImagens(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 📌 FOOTER
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_footer"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalFooter(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // ⚙️ OPÇÕES
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_opcoes"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalOpcoes(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 📊 STATUS
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_status"
    ) {
        await enviarStatusJoin(
            interaction
        );

        return true;
    }

    // =================================================
    // 🧪 TESTE
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_teste"
    ) {
        await testarJoin(
            interaction
        );

        return true;
    }

    // =================================================
    // ❌ FECHAR
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_fechar"
    ) {
        await interaction.update({
            content:
                "✅ Painel de configuração fechado.",
            embeds: [],
            components: []
        });

        return true;
    }

    // =================================================
    // 📝 SALVAR MENSAGEM
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_mensagem"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                content:
                    interaction.fields.getTextInputValue(
                        "content"
                    )
            }
        );

        await interaction.reply({
            content:
                "✅ Mensagem de boas-vindas atualizada!",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // =================================================
    // 🎨 SALVAR EMBED
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_embed"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                embed_titulo:
                    interaction.fields.getTextInputValue(
                        "titulo"
                    ),
                embed_descricao:
                    interaction.fields.getTextInputValue(
                        "descricao"
                    ),
                embed_cor:
                    interaction.fields.getTextInputValue(
                        "cor"
                    )
            }
        );

        await interaction.reply({
            content:
                "✅ Configuração do embed atualizada!",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // =================================================
    // 👤 SALVAR AUTOR
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_autor"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        const habilitado =
            interaction.fields
                .getTextInputValue(
                    "habilitado"
                )
                .trim()
                .toLowerCase() !== "não";

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                autor_nome:
                    interaction.fields.getTextInputValue(
                        "nome"
                    ),
                autor_icone:
                    interaction.fields.getTextInputValue(
                        "icone"
                    ),
                autor_habilitado:
                    habilitado
            }
        );

        await interaction.reply({
            content:
                "✅ Configuração do autor atualizada!",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // =================================================
    // 🖼️ SALVAR IMAGENS
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_imagens"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                thumbnail:
                    interaction.fields.getTextInputValue(
                        "thumbnail"
                    ),
                imagem:
                    interaction.fields.getTextInputValue(
                        "imagem"
                    )
            }
        );

        await interaction.reply({
            content:
                "✅ Imagens atualizadas!",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // =================================================
    // 📌 SALVAR FOOTER
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_footer"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        const habilitado =
            interaction.fields
                .getTextInputValue(
                    "habilitado"
                )
                .trim()
                .toLowerCase() !== "não";

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                footer_texto:
                    interaction.fields.getTextInputValue(
                        "texto"
                    ),
                footer_icone:
                    interaction.fields.getTextInputValue(
                        "icone"
                    ),
                footer_habilitado:
                    habilitado
            }
        );

        await interaction.reply({
            content:
                "✅ Configuração do rodapé atualizada!",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // =================================================
    // ⚙️ SALVAR OPÇÕES
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_opcoes"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        const valorBooleano = nome => {
            return (
                interaction.fields
                    .getTextInputValue(nome)
                    .trim()
                    .toLowerCase() !== "não"
            );
        };

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                embed_habilitado:
                    valorBooleano(
                        "embed_habilitado"
                    ),
                timestamp:
                    valorBooleano(
                        "timestamp"
                    ),
                habilitado:
                    valorBooleano(
                        "habilitado"
                    )
            }
        );

        await interaction.reply({
            content:
                "✅ Opções do sistema atualizadas!",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    return false;
}

// =====================================================
// 📤 EXPORTAR
// =====================================================

module.exports = {
    data,
    execute,
    enviarBoasVindas,
    tratarInteracao
};
