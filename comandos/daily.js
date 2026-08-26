const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const cooldowns = new Map();
const notificacoes = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Resgate sua recompensa diária! 💰"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const agora = Date.now();
        const cooldown = 24 * 60 * 60 * 1000;

        if (cooldowns.has(userId)) {
            const ultimoDaily = cooldowns.get(userId);
            const restante = cooldown - (agora - ultimoDaily);

            if (restante > 0) {
                const horas = Math.floor(
                    restante / (1000 * 60 * 60)
                );

                const minutos = Math.floor(
                    (restante % (1000 * 60 * 60)) / (1000 * 60)
                );

                const segundos = Math.floor(
                    (restante % (1000 * 60)) / 1000
                );

                const embed = new EmbedBuilder()
                    .setTitle("⏳ DAILY")
                    .setDescription(
                        `Você já pegou seu daily!\n\n` +
                        `🕐 Próximo daily em **${horas}h ${minutos}min ${segundos}s**.`
                    );

                const botao = new ButtonBuilder()
                    .setCustomId("daily_notificar")
                    .setLabel(
                        notificacoes.has(userId)
                            ? "🔔 Notificação ativada"
                            : "🔔 Me notificar"
                    )
                    .setStyle(
                        notificacoes.has(userId)
                            ? ButtonStyle.Success
                            : ButtonStyle.Primary
                    )
                    .setDisabled(notificacoes.has(userId));

                const row = new ActionRowBuilder()
                    .addComponents(botao);

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }
        }

        const recompensa = 100;

        cooldowns.set(userId, agora);

        const embed = new EmbedBuilder()
            .setTitle("🎁 DAILY")
            .setDescription(
                `Parabéns, ${interaction.user}!\n\n` +
                `💰 Você recebeu **${recompensa} moedas**!`
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

        if (notificacoes.has(userId)) {
            return interaction.reply({
                content: "🔔 Você já ativou a notificação do daily!",
                ephemeral: true
            });
        }

        notificacoes.add(userId);

        await interaction.reply({
            content: "✅ Pronto! Vou te notificar quando seu próximo daily estiver disponível.",
            ephemeral: true
        });
    }
};
