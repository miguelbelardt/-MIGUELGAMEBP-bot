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

// Configurações temporárias de cada usuário
const configuracoes = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Abre o painel para criar um embed.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        // 🔐 SOMENTE ADMINISTRADOR DO DISCORD
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ Você precisa ter a permissão de **Administrador do Discord** para usar este comando.",
                ephemeral: true
            });
        }

        const userId = interaction.user.id;

        configuracoes.set(userId, {
            titulo: "",
            descricao: "",
            imagem: "",
            thumbnail: "",
            cor: "#5865F2",
            timestamp: false
        });

        const embed = new EmbedBuilder()
            .setTitle("🎨 CONFIGURADOR DE EMBED")
            .setDescription(
                "Configure seu embed usando os botões abaixo.\n\n" +
                "🔒 **Este painel é privado e somente você pode utilizá-lo.**\n\n" +
                "Depois de configurar, use **Pré-visualizar** para conferir e **Enviar** para publicar."
            )
            .setColor("#5865F2");

        const linha1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("embed_titulo")
                .setLabel("📝 Título")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("embed_descricao")
                .setLabel("📄 Descrição")
                .setStyle(ButtonStyle.Primary)
        );

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
                .setStyle(ButtonStyle.Secondary)
        );

        const linha3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("embed_timestamp")
                .setLabel("🕐 Timestamp")
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

        await interaction.reply({
            embeds: [embed],
            components: [linha1, linha2, linha3],
            ephemeral: true
        });
    },

    async handleButton(interaction) {
        const userId = interaction.user.id;
        const config = configuracoes.get(userId);

        if (!config) {
            return interaction.reply({
                content: "❌ Sua configuração de embed expirou. Use `/embed` novamente.",
                ephemeral: true
            });
        }

        // =====================================================
        // 🔐 GARANTIR ADMIN DO DISCORD NOS BOTÕES
        // =====================================================

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ Você precisa ter a permissão de **Administrador do Discord** para usar este painel.",
                ephemeral: true
            });
        }

        // =====================================================
        // 📝 TÍTULO
        // =====================================================

        if (interaction.customId === "embed_titulo") {
            const modal = new ModalBuilder()
                .setCustomId("embed_modal_titulo")
                .setTitle("📝 Configurar título");

            const input = new TextInputBuilder()
                .setCustomId("titulo")
                .setLabel("Título do embed")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(256)
                .setValue(config.titulo);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            return interaction.showModal(modal);
        }

        // =====================================================
        // 📄 DESCRIÇÃO
        // =====================================================

        if (interaction.customId === "embed_descricao") {
            const modal = new ModalBuilder()
                .setCustomId("embed_modal_descricao")
                .setTitle("📄 Configurar descrição");

            const input = new TextInputBuilder()
                .setCustomId("descricao")
                .setLabel("Descrição do embed")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(4000)
                .setValue(config.descricao);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            return interaction.showModal(modal);
        }

        // =====================================================
        // 🖼️ IMAGEM
        // =====================================================

        if (interaction.customId === "embed_imagem") {
            const modal = new ModalBuilder()
                .setCustomId("embed_modal_imagem")
                .setTitle("🖼️ Configurar imagem");

            const input = new TextInputBuilder()
                .setCustomId("imagem")
                .setLabel("URL da imagem")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder("https://exemplo.com/imagem.png")
                .setValue(config.imagem);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            return interaction.showModal(modal);
        }

        // =====================================================
        // 🔗 THUMBNAIL
        // =====================================================

        if (interaction.customId === "embed_thumbnail") {
            const modal = new ModalBuilder()
                .setCustomId("embed_modal_thumbnail")
                .setTitle("🔗 Configurar thumbnail");

            const input = new TextInputBuilder()
                .setCustomId("thumbnail")
                .setLabel("URL da thumbnail")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder("https://exemplo.com/imagem.png")
                .setValue(config.thumbnail);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            return interaction.showModal(modal);
        }

        // =====================================================
        // 🎨 COR
        // =====================================================

        if (interaction.customId === "embed_cor") {
            const modal = new ModalBuilder()
                .setCustomId("embed_modal_cor")
                .setTitle("🎨 Configurar cor");

            const input = new TextInputBuilder()
                .setCustomId("cor")
                .setLabel("Cor hexadecimal")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder("#5865F2")
                .setValue(config.cor);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            return interaction.showModal(modal);
        }

        // =====================================================
        // 🕐 TIMESTAMP
        // =====================================================

        if (interaction.customId === "embed_timestamp") {
            config.timestamp = !config.timestamp;

            return interaction.reply({
                content: config.timestamp
                    ? "🕐 Timestamp ativado!"
                    : "🕐 Timestamp desativado!",
                ephemeral: true
            });
        }

        // =====================================================
        // 👀 PRÉ-VISUALIZAÇÃO
        // =====================================================

        if (interaction.customId === "embed_preview") {
            const resultado = criarEmbed(config, interaction.user);

            if (!resultado.sucesso) {
                return interaction.reply({
                    content: resultado.erro,
                    ephemeral: true
                });
            }

            return interaction.reply({
                content: "👀 **Pré-visualização:**",
                embeds: [resultado.embed],
                ephemeral: true
            });
        }

        // =====================================================
        // 📤 ENVIAR
        // =====================================================

        if (interaction.customId === "embed_send") {
            const resultado = criarEmbed(config, interaction.user);

            if (!resultado.sucesso) {
                return interaction.reply({
                    content: resultado.erro,
                    ephemeral: true
                });
            }

            await interaction.channel.send({
                embeds: [resultado.embed]
            });

            configuracoes.delete(userId);

            return interaction.update({
                content: "✅ Embed enviado com sucesso!",
                embeds: [],
                components: []
            });
        }
    },

    async handleModal(interaction) {
        const userId = interaction.user.id;
        const config = configuracoes.get(userId);

        if (!config) {
            return interaction.reply({
                content: "❌ Sua configuração de embed expirou. Use `/embed` novamente.",
                ephemeral: true
            });
        }

        // 🔐 ADMINISTRADOR DO DISCORD
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ Você precisa ter a permissão de **Administrador do Discord** para alterar este painel.",
                ephemeral: true
            });
        }

        if (interaction.customId === "embed_modal_titulo") {
            config.titulo = interaction.fields
                .getTextInputValue("titulo")
                .trim();

            return interaction.reply({
                content: "✅ Título atualizado!",
                ephemeral: true
            });
        }

        if (interaction.customId === "embed_modal_descricao") {
            config.descricao = interaction.fields
                .getTextInputValue("descricao")
                .trim();

            return interaction.reply({
                content: "✅ Descrição atualizada!",
                ephemeral: true
            });
        }

        if (interaction.customId === "embed_modal_imagem") {
            const imagem = interaction.fields
                .getTextInputValue("imagem")
                .trim();

            if (imagem && !validarURL(imagem)) {
                return interaction.reply({
                    content: "❌ URL da imagem inválida.",
                    ephemeral: true
                });
            }

            config.imagem = imagem;

            return interaction.reply({
                content: "✅ Imagem atualizada!",
                ephemeral: true
            });
        }

        if (interaction.customId === "embed_modal_thumbnail") {
            const thumbnail = interaction.fields
                .getTextInputValue("thumbnail")
                .trim();

            if (thumbnail && !validarURL(thumbnail)) {
                return interaction.reply({
                    content: "❌ URL da thumbnail inválida.",
                    ephemeral: true
                });
            }

            config.thumbnail = thumbnail;

            return interaction.reply({
                content: "✅ Thumbnail atualizada!",
                ephemeral: true
            });
        }

        if (interaction.customId === "embed_modal_cor") {
            const cor = interaction.fields
                .getTextInputValue("cor")
                .trim();

            if (cor && !/^#[0-9A-Fa-f]{6}$/.test(cor)) {
                return interaction.reply({
                    content: "❌ Cor inválida! Use o formato `#5865F2`.",
                    ephemeral: true
                });
            }

            config.cor = cor || "#5865F2";

            return interaction.reply({
                content: "✅ Cor atualizada!",
                ephemeral: true
            });
        }
    }
};

// =====================================================
// 🛠️ CRIAR EMBED
// =====================================================

function criarEmbed(config, usuario) {
    if (
        !config.titulo &&
        !config.descricao &&
        !config.imagem &&
        !config.thumbnail
    ) {
        return {
            sucesso: false,
            erro: "❌ Configure pelo menos um campo antes de continuar."
        };
    }

    const embed = new EmbedBuilder()
        .setColor(config.cor || "#5865F2")
        .setFooter({
            text: `Enviado por ${usuario.username}`
        });

    if (config.titulo) {
        embed.setTitle(config.titulo);
    }

    if (config.descricao) {
        embed.setDescription(config.descricao);
    }

    if (config.imagem) {
        embed.setImage(config.imagem);
    }

    if (config.thumbnail) {
        embed.setThumbnail(config.thumbnail);
    }

    if (config.timestamp) {
        embed.setTimestamp();
    }

    return {
        sucesso: true,
        embed
    };
}

// =====================================================
// 🔗 VALIDAR URL
// =====================================================

function validarURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}
