const {
    SlashCommandBuilder
} = require("discord.js");

const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("fila")
        .setDescription(
            "Mostra a fila de músicas."
        ),

    async execute(interaction) {
        return musica.rodarSlash(
            interaction,
            musica.verFila
        );
    },

    async handlePrefix(message) {
        return musica.rodarPrefixo(
            message,
            musica.verFila
        );
    }
};
