const {
    SlashCommandBuilder
} = require("discord.js");

const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("resume")
        .setDescription(
            "Continua a música pausada."
        ),

    async execute(interaction) {
        return musica.rodarSlash(
            interaction,
            musica.retomar
        );
    },

    async handlePrefix(message) {
        return musica.rodarPrefixo(
            message,
            musica.retomar
        );
    }
};
