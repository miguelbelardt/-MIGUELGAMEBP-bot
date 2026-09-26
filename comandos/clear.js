const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Apaga mensagens do canal.")
        .addIntegerOption(option =>
            option
                .setName("quantidade")
                .setDescription("Quantidade de mensagens para apagar. Máximo: 100.")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageMessages
            )
        ) {
            return interaction.reply({
                content:
                    "❌ Você precisa da permissão **Gerenciar Mensagens** para usar este comando.",
                ephemeral: true
            });
        }

        const quantidade =
            interaction.options.getInteger("quantidade");

        try {
            const mensagens = await interaction.channel.bulkDelete(
                quantidade,
                true
            );

            const apagadas = mensagens.size;

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🧹 Mensagens limpas")
                .setDescription(
                    `🗑️ Foram apagadas **${apagadas} mensagem(ns)** deste canal.\n\n` +
                    `👤 **Responsável:** ${interaction.user}`
                );

            await interaction.reply({
                embeds: [embed]
            });

            // Remove a mensagem de confirmação depois de alguns segundos.
            setTimeout(async () => {
                try {
                    const mensagem =
                        await interaction.fetchReply();

                    await mensagem.delete();
                } catch (erro) {
                    // A mensagem pode já ter sido apagada.
                }
            }, 5000);

            // ==========================================
            // LOG DE MODERAÇÃO
            // ==========================================

            if (
                interaction.client.registrarLog
            ) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle("🧹 Mensagens limpas")
                    .addFields(
                        {
                            name: "👤 Responsável",
                            value: `${interaction.user} (\`${interaction.user.id}\`)`,
                            inline: false
                        },
                        {
                            name: "📍 Canal",
                            value: `${interaction.channel}`,
                            inline: true
                        },
                        {
                            name: "🗑️ Quantidade",
                            value: `${apagadas}`,
                            inline: true
                        }
                    )
                    .setTimestamp();

                await interaction.client.registrarLog(
                    interaction.guild,
                    "moderacao_clear",
                    logEmbed
                );
            }

        } catch (erro) {
            console.error(
                "❌ Erro ao executar /clear:",
                erro
            );

            if (!interaction.replied) {
                return interaction.reply({
                    content:
                        "❌ Não consegui apagar as mensagens. Verifique se tenho permissão para **Gerenciar Mensagens** neste canal.",
                    ephemeral: true
                });
            }
        }
    },

    async handlePrefix(message) {
        if (
            !message.member?.permissions?.has(
                PermissionFlagsBits.ManageMessages
            )
        ) {
            return message.reply(
                "❌ Você precisa da permissão **Gerenciar Mensagens** para usar este comando."
            );
        }

        const args =
            message.content.trim().split(/\s+/);

        const quantidade =
            Number(args[1]);

        if (
            !Number.isInteger(quantidade) ||
            quantidade < 1 ||
            quantidade > 100
        ) {
            return message.reply(
                "❌ Use uma quantidade entre **1 e 100**.\n\n" +
                "Exemplo: `'clear 10`"
            );
        }

        try {
            const mensagens =
                await message.channel.bulkDelete(
                    quantidade,
                    true
                );

            const apagadas =
                mensagens.size;

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🧹 Mensagens limpas")
                .setDescription(
                    `🗑️ Foram apagadas **${apagadas} mensagem(ns)** deste canal.\n\n` +
                    `👤 **Responsável:** ${message.author}`
                );

            const resposta =
                await message.channel.send({
                    embeds: [embed]
                });

            // ==========================================
            // LOG DE MODERAÇÃO
            // ==========================================

            if (
                message.client.registrarLog
            ) {
                const logEmbed =
                    new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle("🧹 Mensagens limpas")
                        .addFields(
                            {
                                name: "👤 Responsável",
                                value:
                                    `${message.author} (\`${message.author.id}\`)`,
                                inline: false
                            },
                            {
                                name: "📍 Canal",
                                value:
                                    `${message.channel}`,
                                inline: true
                            },
                            {
                                name: "🗑️ Quantidade",
                                value:
                                    `${apagadas}`,
                                inline: true
                            }
                        )
                        .setTimestamp();

                await message.client.registrarLog(
                    message.guild,
                    "moderacao_clear",
                    logEmbed
                );
            }

            setTimeout(async () => {
                try {
                    await resposta.delete();
                } catch (erro) {
                    // A mensagem pode já ter sido apagada.
                }
            }, 5000);

        } catch (erro) {
            console.error(
                "❌ Erro ao executar clear por prefixo:",
                erro
            );

            await message.reply(
                "❌ Não consegui apagar as mensagens. Verifique se tenho permissão para **Gerenciar Mensagens** neste canal."
            );
        }
    }
};
