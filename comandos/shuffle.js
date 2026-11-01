const { SlashCommandBuilder } = require("discord.js");
const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Embaralha a ordem das músicas da fila."),

    async execute(interaction) {
        return musica.rodarSlash(interaction, musica.embaralhar);
    },

    async handlePrefix(message) {
        return musica.rodarPrefixo(message, musica.embaralhar);
    }
};
