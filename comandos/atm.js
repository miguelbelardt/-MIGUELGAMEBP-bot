const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("atm")
        .setDescription("Veja seu saldo de moedas. 💰"),

    async execute(interaction) {
        // Por enquanto, saldo inicial
        const saldo = 0;

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
