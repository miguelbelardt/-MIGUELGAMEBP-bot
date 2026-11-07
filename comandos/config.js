const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const configUsuario = require("../configUsuario.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Ligue ou desligue as suas configurações pessoais. ⚙️"),

    async execute(interaction) {
        const dados = await configUsuario.abrirPainel(interaction.user.id);

        return interaction.reply({
            ...dados,
            flags: MessageFlags.Ephemeral
        });
    },

    async handlePrefix(message) {
        return message.reply({
            content: "⚙️ Use **/config**: o painel é só seu, ninguém mais vê.",
            allowedMentions: { parse: [] }
        });
    }
};
