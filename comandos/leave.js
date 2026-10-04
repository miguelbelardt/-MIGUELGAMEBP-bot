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
    getLeaveConfig,
    salvarLeaveConfig,
    atualizarCanalLeave
} = require("../database/database");


// =====================================================
// 🚪 VARIÁVEIS
// =====================================================

function substituirVariaveis(texto, dados) {

    if (!texto) {
        return texto;
    }

    return String(texto)
        .replaceAll("{user}", dados.user ?? "")
        .replaceAll("{username}", dados.username ?? "")
        .replaceAll("{userid}", dados.userid ?? "")
        .replaceAll("{avatar}", dados.avatar ?? "")
        .replaceAll("{banner}", dados.banner ?? "")
        .replaceAll("{members}", String(dados.members ?? ""))
        .replaceAll("{server}", dados.server ?? "");
}


// =====================================================
// 🚪 UTILITÁRIOS
// =====================================================

function urlValida(url) {

    if (!url) {
        return false;
    }

    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}


function converterCor(cor) {

    if (!cor) {
        return 0xED4245;
    }

    const valor = String(cor).trim();

    if (/^#[0-9A-Fa-f]{6}$/.test(valor)) {
        return parseInt(
            valor.slice(1),
            16
        );
    }

    if (/^0x[0-9A-Fa-f]{6}$/.test(valor)) {
        return parseInt(
            valor,
            16
        );
    }

    if (/^[0-9]+$/.test(valor)) {
        return Number(valor);
    }

    return 0xED4245;
}


function estaAtivado(valor) {
    return valor === true ||
        valor === 1 ||
        valor === "1";
}


// =====================================================
// 🚪 DADOS DO MEMBRO
// =====================================================

async function pegarDadosMembro(membro) {

    const usuario =
        await membro.user.fetch();

    let avatar =
        membro.user.displayAvatarURL({
            extension: "png",
            size: 1024
        });

    let banner = "";

    try {

        const usuarioCompleto =
            await usuario.fetch();

        banner =
            usuarioCompleto.bannerURL({
                extension: "png",
                size: 1024
            }) || "";

    } catch {
        banner = "";
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
// 🚪 CRIAR EMBED
// =====================================================

function criarEmbedSaida(
    configBanco,
    dados
) {

    const config = configBanco;

    const embed =
        new EmbedBuilder()
            .setColor(
                converterCor(
                    config.embed_cor
                )
            );

    if (config.embed_titulo) {

        embed.setTitle(
            substituirVariaveis(
                config.embed_titulo,
                dados
            )
        );
    }

    if (config.embed_descricao) {

        embed.setDescription(
            substituirVariaveis(
                config.embed_descricao,
                dados
            )
        );
    }

    if (
        estaAtivado(
            config.autor_habilitado
        ) &&
        config.autor_nome
    ) {

        const autor = {
            name:
                substituirVariaveis(
                    config.autor_nome,
                    dados
                )
        };

        if (
            config.autor_icone &&
            urlValida(
                substituirVariaveis(
                    config.autor_icone,
                    dados
                )
            )
        ) {

            autor.iconURL =
                substituirVariaveis(
                    config.autor_icone,
                    dados
                );
        }

        embed.setAuthor(autor);
    }

    if (config.thumbnail) {

        const thumbnail =
            substituirVariaveis(
                config.thumbnail,
                dados
            );

        if (urlValida(thumbnail)) {
            embed.setThumbnail(thumbnail);
        }
    }

    if (config.imagem) {

        const imagem =
            substituirVariaveis(
                config.imagem,
                dados
            );

        if (urlValida(imagem)) {
            embed.setImage(imagem);
        }
    }

    if (
        estaAtivado(
            config.footer_habilitado
        ) &&
        config.footer_texto
    ) {

        const footer = {
            text:
                substituirVariaveis(
                    config.footer_texto,
                    dados
                )
        };

        if (
            config.footer_icone &&
            urlValida(
                substituirVariaveis(
                    config.footer_icone,
                    dados
                )
            )
        ) {

            footer.iconURL =
                substituirVariaveis(
                    config.footer_icone,
                    dados
                );
        }

        embed.setFooter(footer);
    }

    if (
        estaAtivado(
            config.timestamp
        )
    ) {
        embed.setTimestamp();
    }

    return embed;
}


// =====================================================
// 🚪 ENVIAR MENSAGEM DE SAÍDA
// =====================================================

async function enviarSaida(membro) {

    const config =
        await getLeaveConfig(
            membro.guild.id
        );

    if (!config) {
        return;
    }

    if (
        !estaAtivado(
            config.habilitado
        )
    ) {
        return;
    }

    if (!config.canal_id) {
        return;
    }

    const canal =
        await membro.guild.channels
            .fetch(config.canal_id)
            .catch(() => null);

    if (!canal) {
        return;
    }

    const dados =
        await pegarDadosMembro(
            membro
        );

    const mensagem = {};

    if (config.content) {

        mensagem.content =
            substituirVariaveis(
                config.content,
                dados
            );
    }

    if (
        estaAtivado(
            config.embed_habilitado
        )
    ) {

        mensagem.embeds = [
            criarEmbedSaida(
                config,
                dados
            )
        ];
    }

    if (
        !mensagem.content &&
        !mensagem.embeds
    ) {
        return;
    }

    await canal.send(mensagem);
}


// =====================================================
// 🚪 DADOS PARA TESTE
// =====================================================

async function pegarDadosTeste(interaction) {

    const usuario =
        await interaction.user.fetch();

    let banner = "";

    try {

        banner =
            usuario.bannerURL({
                extension: "png",
                size: 1024
            }) || "";

    } catch {
        banner = "";
    }

    return {
        user: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        userid: interaction.user.id,
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
// 🚪 PAINEL
// =====================================================

function criarPainelLeave(config) {

    const canal =
        config?.canal_id
            ? `<#${config.canal_id}>`
            : "Nenhum canal definido";

    const status =
        estaAtivado(
            config?.habilitado
        )
            ? "🟢 Ativado"
            : "🔴 Desativado";

    const embedStatus =
        estaAtivado(
            config?.embed_habilitado
        )
            ? "🟢"
            : "🔴";

    const descricao =
        [
            `🚪 **Sistema de saída:** ${status}`,
            `📢 **Canal:** ${canal}`,
            `${embedStatus} **Embed:** ${
                estaAtivado(config?.embed_habilitado)
                    ? "Ativado"
                    : "Desativado"
            }`
        ].join("\n");

    const embed =
        new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🚪 Configuração de Leave")
            .setDescription(
                `${descricao}\n\n` +
                "Configure abaixo como a mensagem de saída será enviada."
            )
            .setFooter({
                text: "Massa Com Chika • Sistema de Leave"
            })
            .setTimestamp();

    const canalSelect =
        new ChannelSelectMenuBuilder()
            .setCustomId(
                "leave_config_canal"
            )
            .setPlaceholder(
                "📢 Escolha o canal de saída"
            )
            .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
            );

    const linhaCanal =
        new ActionRowBuilder()
            .addComponents(
                canalSelect
            );

    const linha1 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_mensagem"
                    )
                    .setLabel("Mensagem")
                    .setEmoji("💬")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_embed"
                    )
                    .setLabel("Embed")
                    .setEmoji("🎨")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_autor"
                    )
                    .setLabel("Autor")
                    .setEmoji("👤")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const linha2 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_imagens"
                    )
                    .setLabel("Imagens")
                    .setEmoji("🖼️")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_footer"
                    )
                    .setLabel("Footer")
                    .setEmoji("📝")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_opcoes"
                    )
                    .setLabel("Opções")
                    .setEmoji("⚙️")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const linha3 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_status"
                    )
                    .setLabel("Ativar/Desativar")
                    .setEmoji("🔄")
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_teste"
                    )
                    .setLabel("Testar")
                    .setEmoji("🧪")
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "leave_config_fechar"
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
            linhaCanal,
            linha1,
            linha2,
            linha3
        ]
    };
}


// =====================================================
// 🚪 MODAL — MENSAGEM
// =====================================================

function criarModalMensagem(config) {

    const mensagem =
        new TextInputBuilder()
            .setCustomId("content")
            .setLabel("Mensagem")
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.content ??
                    ""
                )
            )
            .setMaxLength(2000);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_mensagem"
            )
            .setTitle("💬 Mensagem de saída");

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(mensagem)
    );

    return modal;
}


// =====================================================
// 🚪 MODAL — EMBED
// =====================================================

function criarModalEmbed(config) {

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.embed_titulo ??
                    ""
                )
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
                String(
                    config?.embed_descricao ??
                    ""
                )
            )
            .setMaxLength(4000);

    const cor =
        new TextInputBuilder()
            .setCustomId("cor")
            .setLabel("Cor (#ED4245, 0xED4245 ou número)")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.embed_cor ??
                    "#ED4245"
                )
            )
            .setMaxLength(20);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_embed"
            )
            .setTitle("🎨 Configuração do Embed");

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
// 🚪 MODAL — AUTOR
// =====================================================

function criarModalAutor(config) {

    const habilitado =
        new TextInputBuilder()
            .setCustomId("habilitado")
            .setLabel("Ativado? (sim/não)")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config?.autor_habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(10);

    const nome =
        new TextInputBuilder()
            .setCustomId("nome")
            .setLabel("Nome do autor")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.autor_nome ??
                    ""
                )
            )
            .setMaxLength(256);

    const icone =
        new TextInputBuilder()
            .setCustomId("icone")
            .setLabel("Ícone do autor")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.autor_icone ??
                    ""
                )
            )
            .setMaxLength(1000);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_autor"
            )
            .setTitle("👤 Autor do Embed");

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(habilitado),

        new ActionRowBuilder()
            .addComponents(nome),

        new ActionRowBuilder()
            .addComponents(icone)
    );

    return modal;
}


// =====================================================
// 🚪 MODAL — IMAGENS
// =====================================================

function criarModalImagens(config) {

    const thumbnail =
        new TextInputBuilder()
            .setCustomId("thumbnail")
            .setLabel("Thumbnail")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.thumbnail ??
                    ""
                )
            )
            .setMaxLength(1000);

    const imagem =
        new TextInputBuilder()
            .setCustomId("imagem")
            .setLabel("Imagem")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.imagem ??
                    ""
                )
            )
            .setMaxLength(1000);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_imagens"
            )
            .setTitle("🖼️ Imagens do Embed");

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(thumbnail),

        new ActionRowBuilder()
            .addComponents(imagem)
    );

    return modal;
}


// =====================================================
// 🚪 MODAL — FOOTER
// =====================================================

function criarModalFooter(config) {

    const habilitado =
        new TextInputBuilder()
            .setCustomId("habilitado")
            .setLabel("Ativado? (sim/não)")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config?.footer_habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(10);

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto do footer")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.footer_texto ??
                    ""
                )
            )
            .setMaxLength(2048);

    const icone =
        new TextInputBuilder()
            .setCustomId("icone")
            .setLabel("Ícone do footer")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.footer_icone ??
                    ""
                )
            )
            .setMaxLength(1000);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_footer"
            )
            .setTitle("📝 Footer do Embed");

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(habilitado),

        new ActionRowBuilder()
            .addComponents(texto),

        new ActionRowBuilder()
            .addComponents(icone)
    );

    return modal;
}


// =====================================================
// 🚪 MODAL — OPÇÕES
// =====================================================

function criarModalOpcoes(config) {

    const embed =
        new TextInputBuilder()
            .setCustomId("embed_habilitado")
            .setLabel("Embed ativado? (sim/não)")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config?.embed_habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(10);

    const timestamp =
        new TextInputBuilder()
            .setCustomId("timestamp")
            .setLabel("Timestamp ativado? (sim/não)")
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config?.timestamp
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(10);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_opcoes"
            )
            .setTitle("⚙️ Opções do Leave");

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(embed),

        new ActionRowBuilder()
            .addComponents(timestamp)
    );

    return modal;
}


// =====================================================
// 🚪 TRATAR INTERAÇÕES
// =====================================================

async function tratarInteracao(interaction) {

    if (
        !interaction.customId ||
        !interaction.customId.startsWith("leave_")
    ) {
        return false;
    }

    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {

        await interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para configurar o sistema de Leave.",
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    const guildId =
        interaction.guild.id;

    // =================================================
    // 📢 SELEÇÃO DO CANAL
    // =================================================

    if (
        interaction.isChannelSelectMenu() &&
        interaction.customId ===
            "leave_config_canal"
    ) {

        const canalId =
            interaction.values[0];

        await atualizarCanalLeave(
            guildId,
            canalId
        );

        const config =
            await getLeaveConfig(
                guildId
            );

        await interaction.update(
            criarPainelLeave(config)
        );

        return true;
    }


    // =================================================
    // 🔘 BOTÕES
    // =================================================

    if (
        interaction.isButton()
    ) {

        const config =
            await getLeaveConfig(
                guildId
            );

        if (
            interaction.customId ===
            "leave_config_mensagem"
        ) {

            await interaction.showModal(
                criarModalMensagem(config)
            );

            return true;
        }

        if (
            interaction.customId ===
            "leave_config_embed"
        ) {

            await interaction.showModal(
                criarModalEmbed(config)
            );

            return true;
        }

        if (
            interaction.customId ===
            "leave_config_autor"
        ) {

            await interaction.showModal(
                criarModalAutor(config)
            );

            return true;
        }

        if (
            interaction.customId ===
            "leave_config_imagens"
        ) {

            await interaction.showModal(
                criarModalImagens(config)
            );

            return true;
        }

        if (
            interaction.customId ===
            "leave_config_footer"
        ) {

            await interaction.showModal(
                criarModalFooter(config)
            );

            return true;
        }

        if (
            interaction.customId ===
            "leave_config_opcoes"
        ) {

            await interaction.showModal(
                criarModalOpcoes(config)
            );

            return true;
        }

        if (
            interaction.customId ===
            "leave_config_status"
        ) {

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    habilitado:
                        !estaAtivado(
                            config?.habilitado
                        )
                }
            );

            const novoConfig =
                await getLeaveConfig(
                    guildId
                );

            await interaction.update(
                criarPainelLeave(
                    novoConfig
                )
            );

            return true;
        }

        if (
            interaction.customId ===
            "leave_config_teste"
        ) {

            const dados =
                await pegarDadosTeste(
                    interaction
                );

            const configTeste =
                config || {};

            const resposta = {};

            if (
                configTeste.content
            ) {

                resposta.content =
                    substituirVariaveis(
                        configTeste.content,
                        dados
                    );
            }

            if (
                estaAtivado(
                    configTeste.embed_habilitado
                )
            ) {

                resposta.embeds = [
                    criarEmbedSaida(
                        configTeste,
                        dados
                    )
                ];
            }

            await interaction.reply({
                ...resposta,
                flags: MessageFlags.Ephemeral
            });

            return true;
        }

        if (
            interaction.customId ===
            "leave_config_fechar"
        ) {

            await interaction.update({
                content:
                    "🚪 Painel de Leave fechado.",
                embeds: [],
                components: []
            });

            return true;
        }
    }


    // =================================================
    // 📝 MODAIS
    // =================================================

    if (
        interaction.isModalSubmit()
    ) {

        const config =
            await getLeaveConfig(
                guildId
            ) || {};

        if (
            interaction.customId ===
            "leave_modal_mensagem"
        ) {

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    content:
                        interaction.fields.getTextInputValue(
                            "content"
                        )
                }
            );
        }

        else if (
            interaction.customId ===
            "leave_modal_embed"
        ) {

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
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
        }

        else if (
            interaction.customId ===
            "leave_modal_autor"
        ) {

            const habilitado =
                interaction.fields
                    .getTextInputValue(
                        "habilitado"
                    )
                    .toLowerCase() === "sim";

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    autor_habilitado:
                        habilitado,

                    autor_nome:
                        interaction.fields.getTextInputValue(
                            "nome"
                        ),

                    autor_icone:
                        interaction.fields.getTextInputValue(
                            "icone"
                        )
                }
            );
        }

        else if (
            interaction.customId ===
            "leave_modal_imagens"
        ) {

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
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
        }

        else if (
            interaction.customId ===
            "leave_modal_footer"
        ) {

            const habilitado =
                interaction.fields
                    .getTextInputValue(
                        "habilitado"
                    )
                    .toLowerCase() === "sim";

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    footer_habilitado:
                        habilitado,

                    footer_texto:
                        interaction.fields.getTextInputValue(
                            "texto"
                        ),

                    footer_icone:
                        interaction.fields.getTextInputValue(
                            "icone"
                        )
                }
            );
        }

        else if (
            interaction.customId ===
            "leave_modal_opcoes"
        ) {

            const embedHabilitado =
                interaction.fields
                    .getTextInputValue(
                        "embed_habilitado"
                    )
                    .toLowerCase() === "sim";

            const timestamp =
                interaction.fields
                    .getTextInputValue(
                        "timestamp"
                    )
                    .toLowerCase() === "sim";

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    embed_habilitado:
                        embedHabilitado,

                    timestamp
                }
            );
        }

        else {
            return false;
        }

        const novoConfig =
            await getLeaveConfig(
                guildId
            );

        await interaction.reply({
            content:
                "✅ Configuração do Leave atualizada!",
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    return false;
}


// =====================================================
// 🚪 COMANDO /LEAVE
// =====================================================

const data =
    new SlashCommandBuilder()
        .setName("leave")
        .setDescription(
            "Configura o sistema de saída do servidor"
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("configurar")
                .setDescription(
                    "Abrir o painel de configuração"
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("ativar")
                .setDescription(
                    "Ativar o sistema de Leave"
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("desativar")
                .setDescription(
                    "Desativar o sistema de Leave"
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("status")
                .setDescription(
                    "Ver o status do sistema"
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("teste")
                .setDescription(
                    "Testar a mensagem de saída"
                )
        );


// =====================================================
// 🚪 EXECUTAR /LEAVE
// =====================================================

async function execute(interaction) {

    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {

        return interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor**.",
            flags: MessageFlags.Ephemeral
        });
    }

    const subcomando =
        interaction.options.getSubcommand();

    let config =
        await getLeaveConfig(
            interaction.guild.id
        );

    if (
        subcomando === "configurar"
    ) {

        if (!config) {

            config =
                await salvarLeaveConfig(
                    interaction.guild.id
                );
        }

        return interaction.reply({
            ...criarPainelLeave(config),
            flags: MessageFlags.Ephemeral
        });
    }


    if (
        subcomando === "ativar"
    ) {

        config =
            await salvarLeaveConfig(
                interaction.guild.id,
                {
                    ...(config || {}),
                    habilitado: true
                }
            );

        return interaction.reply({
            content:
                "✅ Sistema de Leave **ativado**!",
            flags: MessageFlags.Ephemeral
        });
    }


    if (
        subcomando === "desativar"
    ) {

        config =
            await salvarLeaveConfig(
                interaction.guild.id,
                {
                    ...(config || {}),
                    habilitado: false
                }
            );

        return interaction.reply({
            content:
                "🔴 Sistema de Leave **desativado**!",
            flags: MessageFlags.Ephemeral
        });
    }


    if (
        subcomando === "status"
    ) {

        const status =
            config &&
            estaAtivado(
                config.habilitado
            )
                ? "🟢 Ativado"
                : "🔴 Desativado";

        const canal =
            config?.canal_id
                ? `<#${config.canal_id}>`
                : "Nenhum";

        return interaction.reply({
            content:
                `🚪 **Sistema de Leave**\n\n` +
                `Status: ${status}\n` +
                `Canal: ${canal}\n` +
                `Embed: ${
                    config &&
                    estaAtivado(
                        config.embed_habilitado
                    )
                        ? "🟢 Ativado"
                        : "🔴 Desativado"
                }`,
            flags: MessageFlags.Ephemeral
        });
    }


    if (
        subcomando === "teste"
    ) {

        if (!config) {

            return interaction.reply({
                content:
                    "❌ O sistema de Leave ainda não foi configurado.",
                flags: MessageFlags.Ephemeral
            });
        }

        const dados =
            await pegarDadosTeste(
                interaction
            );

        const resposta = {};

        if (config.content) {

            resposta.content =
                substituirVariaveis(
                    config.content,
                    dados
                );
        }

        if (
            estaAtivado(
                config.embed_habilitado
            )
        ) {

            resposta.embeds = [
                criarEmbedSaida(
                    config,
                    dados
                )
            ];
        }

        return interaction.reply({
            ...resposta,
            flags: MessageFlags.Ephemeral
        });
    }
}


module.exports = {
    data,
    execute,
    enviarSaida,
    tratarInteracao
};
