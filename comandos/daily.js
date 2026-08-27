const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const database = require("../database/database");

const COOLDOWN = 24 * 60 * 60 * 1000;
const RECOMPENSA = 100;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Resgate sua recompensa diária! 💰"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const agora = Date.now();

        const ultimoDaily = database.getUltimoDaily(userId);
        const restante = COOLDOWN - (agora - ultimoDaily);

        if (ultimoDaily > 0 && restante > 0) {
            const horas = Math.floor(
                restante / (1000 * 60 * 60)
            );

            const minutos = Math.floor(
                (restante % (1000 * 60 * 60)) / (1000 * 60)
            );

            const segundos = Math.floor(
                (restante % (1000 * 60)) / 1000
            );

            const notificacaoAtivada =
                database.getNotificacaoDaily(userId);

            const botao = new ButtonBuilder()
                .setCustomId("daily_notificar")
                .setLabel(
                    notificacaoAtivada
                        ? "🔔 Notificação ativada"
                        : "🔔 Me notificar"
                )
                .setStyle(
                    notificacaoAtivada
                        ? ButtonStyle.Success
                        : ButtonStyle.Primary
                )
                .setDisabled(notificacaoAtivada);

            const row = new ActionRowBuilder()
                .addComponents(botao);

            const embed = new EmbedBuilder()
                .setTitle("⏳ DAILY")
                .setDescription(
                    `Você já pegou seu daily!\n\n` +
                    `🕐 Próximo daily em **${horas}h ${minutos}min ${segundos}s**.`
                );

            return interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
        }

        // Adiciona a recompensa ao saldo
        database.adicionarSaldo(userId, RECOMPENSA);

        // Salva o horário do novo daily
        database.setUltimoDaily(userId, agora);

        const embed = new EmbedBuilder()
            .setTitle("🎁 DAILY")
            .setDescription(
                `Parabéns, ${interaction.user}!\n\n` +
                `💰 Você recebeu **${RECOMPENSA} moedas**!`
            )
            .setFooter({
                text: "Volte amanhã para pegar novamente!"
            });

        const botao = new ButtonBuilder()
            .setCustomId("daily_notificar")
            .setLabel("🔔 Me notificar amanhã")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(botao);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },

    async handleButton(interaction) {
        if (interaction.customId !== "daily_notificar") return;

        const userId = interaction.user.id;

        const jaAtivada =
            database.getNotificacaoDaily(userId);

        if (jaAtivada) {
            return interaction.reply({
                content: "🔔 Você já ativou a notificação do daily!",
                ephemeral: true
            });
        }

        database.setNotificacaoDaily(userId, true);

        await interaction.reply({
            content: "✅ Pronto! Vou te notificar quando seu próximo daily estiver disponível.",
            ephemeral: true
        });
    }
};
