const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Envie moedas para outro usuário. 💸")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá as moedas")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("quantidade")
                .setDescription("Quantidade de moedas para enviar")
                .setMinValue(1)
                .setRequired(true)
        ),

    async execute(interaction) {
        const usuario = interaction.options.getUser("usuario");
        const quantidade = interaction.options.getInteger("quantidade");

        if (usuario.id === interaction.user.id) {
            return interaction.reply({
                content: "❌ Você não pode enviar moedas para você mesmo.",
                ephemeral: true
            });
        }

        if (usuario.bot) {
            return interaction.reply({
                content: "❌ Você não pode enviar moedas para um bot.",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("💸 Transferência")
            .setDescription(
                `**${interaction.user.username}** enviou **${quantidade} moedas** para **${usuario.username}**.`
            )
            .setColor("#2ecc71");

        await interaction.reply({
            embeds: [embed]
        });
    }
};
