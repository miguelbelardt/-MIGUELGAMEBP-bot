const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const { getSaldo } = require("../database/database");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("atm")
        .setDescription("Veja seu saldo de moedas 💰"),

    // =====================================================
    // 💬 SLASH COMMAND
    // =====================================================

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            const saldo = await getSaldo(userId);

            const embed = new EmbedBuilder()
                .setTitle("🏦 ATM")
                .setDescription(
                    `💳 **${interaction.user.username}**, seu saldo é:\n\n` +
                    `💰 **${saldo} moedas**`
                )
                .setColor("Green");

            await interaction.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro no ATM:", erro);

            await interaction.reply({
                content: "❌ Não foi possível consultar seu saldo.",
                ephemeral: true
            });
        }
    },

    // =====================================================
    // 🔤 COMANDO POR PREFIXO
    // =====================================================

    async handlePrefix(message) {
        const userId = message.author.id;

        try {
            const saldo = await getSaldo(userId);

            const embed = new EmbedBuilder()
                .setTitle("🏦 ATM")
                .setDescription(
                    `💳 **${message.author.username}**, seu saldo é:\n\n` +
                    `💰 **${saldo} moedas**`
                )
                .setColor("Green");

            await message.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro no ATM por prefixo:", erro);

            await message.reply(
                "❌ Não foi possível consultar seu saldo."
            );
        }
    }
};
