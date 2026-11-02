const {
    SlashCommandBuilder
} = require("discord.js");

const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setDMPermission(false)
        .setName("skip")
        .setDescription(
            "Pula para a próxima música da fila."
        ),

    async execute(interaction) {
        return musica.rodarSlash(
            interaction,
            musica.pular
        );
    },

    async handlePrefix(message) {
        return musica.rodarPrefixo(
            message,
            musica.pular
        );
    }
};
