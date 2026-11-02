const {
    SlashCommandBuilder
} = require("discord.js");

const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setDMPermission(false)
        .setName("stop")
        .setDescription(
            "Para a música, limpa a fila e sai da call."
        ),

    async execute(interaction) {
        return musica.rodarSlash(
            interaction,
            musica.parar
        );
    },

    async handlePrefix(message) {
        return musica.rodarPrefixo(
            message,
            musica.parar
        );
    }
};
