const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("say")
        .setDescription("Faz o bot enviar uma mensagem.")
        .addStringOption(option =>
            option
                .setName("mensagem")
                .setDescription("Mensagem que o bot vai enviar.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const mensagem = interaction.options.getString("mensagem");

        await interaction.reply({
            content: "✅ Mensagem enviada!",
            ephemeral: true
        });

        await interaction.channel.send(mensagem);
    }
};
