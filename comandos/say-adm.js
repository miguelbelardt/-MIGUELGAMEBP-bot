const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("say-adm")
        .setDescription("Envia uma mensagem privada para um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá a mensagem.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("mensagem")
                .setDescription("Mensagem que será enviada.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const usuario = interaction.options.getUser("usuario");
        const mensagem = interaction.options.getString("mensagem");

        try {
            await usuario.send(mensagem);

            await interaction.reply({
                content: `✅ Mensagem enviada para ${usuario}.`,
                ephemeral: true
            });

        } catch (erro) {
            console.error("Erro no say-adm:", erro);

            await interaction.reply({
                content:
                    "❌ Não consegui enviar a mensagem. " +
                    "O usuário pode estar com as DMs fechadas.",
                ephemeral: true
            });
        }
    }
};
