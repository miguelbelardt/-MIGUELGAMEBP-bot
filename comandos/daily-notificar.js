const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    getNotificacaoDaily,
    salvarNotificacaoDaily
} = require("../database/database");

// =====================================================
// 🎨 CORES DOS EMBEDS
// =====================================================

const COR_ATIVA = 0x57F287;       // 🟢 Verde
const COR_DESATIVADA = 0xED4245;  // 🔴 Vermelho
const COR_INFO = 0x5865F2;        // 🔵 Azul

// =====================================================
// 🤖 COMANDO
// =====================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("daily-notificar")
            .setDescription(
                "Gerencie as notificações do seu Daily. 🔔"
            ),

    // =================================================
    // 💬 SLASH COMMAND
    // =================================================

    async execute(interaction) {

        const userId =
            interaction.user.id;

        try {

            const notificacaoAtiva =
                await getNotificacaoDaily(
                    userId
                );

            // =================================================
            // 🔔 NOTIFICAÇÃO ATIVA
            // =================================================

            if (notificacaoAtiva) {

                const embed =
                    new EmbedBuilder()
                        .setColor(COR_ATIVA)
                        .setTitle("🔔 Notificação do Daily")
                        .setDescription(
                            "Sua notificação do Daily está **ativada**.\n\n" +
                            "Você receberá uma mensagem quando seu Daily estiver disponível."
                        )
                        .setFooter({
                            text:
                                "Use o botão abaixo para desativar."
                        });

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    "daily_notificar_desativar"
                                )
                                .setLabel(
                                    "🔕 Desativar notificação"
                                )
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        );

                return interaction.reply({
                    embeds: [
                        embed
                    ],
                    components: [
                        row
                    ],
                    ephemeral: true
                });
            }

            // =================================================
            // 🔕 NOTIFICAÇÃO DESATIVADA
            // =================================================

            const embed =
                new EmbedBuilder()
                    .setColor(COR_DESATIVADA)
                    .setTitle("🔕 Notificação do Daily")
                    .setDescription(
                        "Sua notificação do Daily está **desativada**.\n\n" +
                        "Quando você usar `/daily` e resgatar sua recompensa, poderá ativar a notificação novamente."
                    )
                    .setFooter({
                        text:
                            "Nenhuma notificação do Daily está ativa."
                    });

            return interaction.reply({
                embeds: [
                    embed
                ],
                ephemeral: true
            });

        } catch (erro) {

            console.error(
                "❌ Erro no /daily-notificar:",
                erro
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({
                    content:
                        "❌ Não foi possível verificar sua configuração de notificação.",
                    ephemeral: true
                });
            }
        }
    },

    // =================================================
    // 🔘 BOTÃO
    // =================================================

    async handleButton(interaction) {

        if (
            interaction.customId !==
            "daily_notificar_desativar"
        ) {
            return;
        }

        const userId =
            interaction.user.id;

        try {

            const notificacaoAtiva =
                await getNotificacaoDaily(
                    userId
                );

            if (!notificacaoAtiva) {

                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(COR_DESATIVADA)
                            .setTitle("🔕 Notificação do Daily")
                            .setDescription(
                                "Sua notificação do Daily já está **desativada**."
                            )
                    ],
                    components: []
                });
            }

            // =================================================
            // 🔕 DESATIVAR NO BANCO
            // =================================================

            await salvarNotificacaoDaily(
                userId,
                false
            );

            // =================================================
            // 🔕 ATUALIZAR MENSAGEM
            // =================================================

            const embed =
                new EmbedBuilder()
                    .setColor(COR_DESATIVADA)
                    .setTitle("🔕 Notificação desativada")
                    .setDescription(
                        "Pronto! As notificações do seu Daily foram **desativadas**.\n\n" +
                        "Quando quiser ativá-las novamente, use `/daily` depois de resgatar seu Daily."
                    )
                    .setFooter({
                        text:
                            "Sua preferência foi salva."
                    });

            await interaction.update({
                embeds: [
                    embed
                ],
                components: []
            });

        } catch (erro) {

            console.error(
                "❌ Erro ao desativar notificação do Daily:",
                erro
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({
                    content:
                        "❌ Não foi possível desativar sua notificação.",
                    ephemeral: true
                });
            }
        }
    }
};
