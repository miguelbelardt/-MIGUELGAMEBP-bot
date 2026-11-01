const {
    SlashCommandBuilder
} = require("discord.js");

const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pause")
        .setDescription(
            "Pausa a música que está tocando."
        ),

    async execute(interaction) {
        return musica.rodarSlash(
            interaction,
            musica.pausar
        );
    },

    async handlePrefix(message) {
        return musica.rodarPrefixo(
            message,
            musica.pausar
        );
    }
};
