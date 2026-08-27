const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const database = require("../database/database");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("atm")
        .setDescription("Veja seu saldo de moedas. 💰"),

    async execute(interaction) {
        const userId = interaction.user.id;

        const saldo = database.getSaldo(userId);

        const embed = new EmbedBuilder()
            .setTitle("🏦 ATM")
            .setDescription(
                `💳 **Conta de ${interaction.user.username}**\n\n` +
                `💰 Saldo: **${saldo} moedas**`
            )
            .setColor("#2ecc71");

        await interaction.reply({
            embeds: [embed]
        });
    }
};
