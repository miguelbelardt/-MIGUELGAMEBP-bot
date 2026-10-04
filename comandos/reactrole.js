const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

// =====================================================
// ⚙️ COMANDO REACT ROLE
// =====================================================

const data = new SlashCommandBuilder()
    .setName("reactrole")
    .setDescription("Configura um sistema de cargos por reação.")
    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
    )

    // =================================================
    // 📨 CONFIGURAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("configurar")
            .setDescription("Configura uma mensagem de React Role.")

            // ID DA MENSAGEM
            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem que receberá os reacts."
                    )
                    .setRequired(true)
            )

            // EMOJI
            .addStringOption(option =>
                option
                    .setName("emoji")
                    .setDescription(
                        "Emoji que será usado para dar o cargo."
                    )
                    .setRequired(true)
            )

            // CARGO
            .addRoleOption(option =>
                option
                    .setName("cargo")
                    .setDescription(
                        "Cargo que será dado ao reagir."
                    )
                    .setRequired(true)
            )

            // TÍTULO
            .addStringOption(option =>
                option
                    .setName("titulo")
                    .setDescription(
                        "Título do Embed."
                    )
                    .setRequired(false)
            )

            // DESCRIÇÃO
            .addStringOption(option =>
                option
                    .setName("descricao")
                    .setDescription(
                        "Descrição do Embed."
                    )
                    .setRequired(false)
            )

            // RODAPÉ
            .addStringOption(option =>
                option
                    .setName("rodape")
                    .setDescription(
                        "Texto do rodapé do Embed."
                    )
                    .setRequired(false)
            )

            // IMAGEM
            .addStringOption(option =>
                option
                    .setName("imagem")
                    .setDescription(
                        "URL da imagem do Embed."
                    )
                    .setRequired(false)
            )

            // THUMBNAIL
            .addStringOption(option =>
                option
                    .setName("thumbnail")
                    .setDescription(
                        "URL da thumbnail do Embed."
                    )
                    .setRequired(false)
            )

            // CONTENT
            .addStringOption(option =>
                option
                    .setName("content")
                    .setDescription(
                        "Mensagem enviada acima do Embed."
                    )
                    .setRequired(false)
            )
    )

    // =================================================
    // ➕ ADICIONAR REAÇÃO
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("adicionar")
            .setDescription(
                "Adiciona outro emoji e cargo à mensagem."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("emoji")
                    .setDescription(
                        "Emoji que será usado."
                    )
                    .setRequired(true)
            )

            .addRoleOption(option =>
                option
                    .setName("cargo")
                    .setDescription(
                        "Cargo dado ao reagir."
                    )
                    .setRequired(true)
            )
    )

    // =================================================
    // ➖ REMOVER REAÇÃO
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("remover")
            .setDescription(
                "Remove um emoji/cargo da mensagem."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("emoji")
                    .setDescription(
                        "Emoji que será removido."
                    )
                    .setRequired(true)
            )
    )

    // =================================================
    // 📋 STATUS
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("status")
            .setDescription(
                "Mostra a configuração do React Role."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )
    )

    // =================================================
    // ❌ LIMPAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("limpar")
            .setDescription(
                "Remove toda a configuração de uma mensagem."
            )

            .addStringOption(option =>
                option
                    .setName("mensagem")
                    .setDescription(
                        "ID da mensagem."
                    )
                    .setRequired(true)
            )
    );

// =====================================================
// ▶️ EXECUTE
// =====================================================

async function execute(interaction) {

    if (
        !interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",
            ephemeral: true
        });
    }

    const subcomando =
        interaction.options.getSubcommand();

    const mensagemId =
        interaction.options.getString(
            "mensagem"
        );

    // =================================================
    // 📨 CONFIGURAR
    // =================================================

    if (
        subcomando === "configurar"
    ) {

        const emoji =
            interaction.options.getString(
                "emoji"
            );

        const cargo =
            interaction.options.getRole(
                "cargo"
            );

        const titulo =
            interaction.options.getString(
                "titulo"
            );

        const descricao =
            interaction.options.getString(
                "descricao"
            );

        const rodape =
            interaction.options.getString(
                "rodape"
            );

        const imagem =
            interaction.options.getString(
                "imagem"
            );

        const thumbnail =
            interaction.options.getString(
                "thumbnail"
            );

        const content =
            interaction.options.getString(
                "content"
            );

        // Verifica se a mensagem existe
        let mensagem;

        try {

            mensagem =
                await interaction.channel.messages.fetch(
                    mensagemId
                );

        } catch (erro) {

            return interaction.reply({
                content:
                    "❌ Não consegui encontrar essa mensagem neste canal.",
                ephemeral: true
            });
        }

        // Cria o Embed
        const embed =
            new EmbedBuilder();

        if (titulo) {
            embed.setTitle(titulo);
        }

        if (descricao) {
            embed.setDescription(
                descricao
            );
        }

        if (rodape) {
            embed.setFooter({
                text: rodape
            });
        }

        if (imagem) {
            try {
                embed.setImage(imagem);
            } catch {}
        }

        if (thumbnail) {
            try {
                embed.setThumbnail(
                    thumbnail
                );
            } catch {}
        }

        // Aqui futuramente salvaremos no banco
        // e o index.js adicionará o listener.

        try {

            await mensagem.react(
                emoji
            );

        } catch (erro) {

            console.error(
                "❌ Erro ao adicionar reação:",
                erro
            );

            return interaction.reply({
                content:
                    "❌ Não consegui adicionar esse emoji à mensagem. Verifique se o emoji é válido e se eu tenho permissão para reagir.",
                ephemeral: true
            });
        }

        // Apenas teste inicial.
        // O banco será conectado na próxima etapa.

        return interaction.reply({
            content:
                `✅ React Role configurado!\n\n` +
                `📨 Mensagem: \`${mensagemId}\`\n` +
                `😀 Emoji: ${emoji}\n` +
                `🎭 Cargo: ${cargo}\n` +
                `📝 Título: ${titulo || "Não definido"}\n` +
                `📄 Descrição: ${descricao || "Não definida"}\n` +
                `🔻 Rodapé: ${rodape || "Não definido"}\n` +
                `🖼️ Imagem: ${imagem || "Não definida"}\n` +
                `🔳 Thumbnail: ${thumbnail || "Não definida"}\n` +
                `💬 Content: ${content || "Não definido"}`,
            ephemeral: true
        });
    }

    // =================================================
    // ➕ ADICIONAR
    // =================================================

    if (
        subcomando === "adicionar"
    ) {

        const emoji =
            interaction.options.getString(
                "emoji"
            );

        const cargo =
            interaction.options.getRole(
                "cargo"
            );

        let mensagem;

        try {

            mensagem =
                await interaction.channel.messages.fetch(
                    mensagemId
                );

        } catch {

            return interaction.reply({
                content:
                    "❌ Não consegui encontrar essa mensagem neste canal.",
                ephemeral: true
            });
        }

        try {

            await mensagem.react(
                emoji
            );

        } catch {

            return interaction.reply({
                content:
                    "❌ Não consegui adicionar esse emoji à mensagem.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content:
                `✅ Emoji ${emoji} adicionado para o cargo ${cargo}.`,
            ephemeral: true
        });
    }

    // =================================================
    // ➖ REMOVER
    // =================================================

    if (
        subcomando === "remover"
    ) {

        const emoji =
            interaction.options.getString(
                "emoji"
            );

        return interaction.reply({
            content:
                `🗑️ A configuração do emoji ${emoji} será removida na próxima etapa, quando conectarmos o banco de dados.`,
            ephemeral: true
        });
    }

    // =================================================
    // 📋 STATUS
    // =================================================

    if (
        subcomando === "status"
    ) {

        return interaction.reply({
            content:
                `📋 O sistema da mensagem \`${mensagemId}\` ainda será conectado ao banco de dados.`,
            ephemeral: true
        });
    }

    // =================================================
    // ❌ LIMPAR
    // =================================================

    if (
        subcomando === "limpar"
    ) {

        return interaction.reply({
            content:
                `🗑️ A configuração da mensagem \`${mensagemId}\` será limpa na próxima etapa.`,
            ephemeral: true
        });
    }
}

// =====================================================
// 📦 EXPORT
// =====================================================

module.exports = {
    data,
    execute
};
