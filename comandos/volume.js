const { SlashCommandBuilder } = require("discord.js");
const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Muda o volume da música (1 a 200).")
        .addIntegerOption(opcao =>
            opcao
                .setName("valor")
                .setDescription("Volume em % (100 é o normal). Vazio mostra o atual.")
                .setMinValue(1)
                .setMaxValue(200)
                .setRequired(false)
        ),

    async execute(interaction) {
        return musica.rodarSlash(
            interaction,
            musica.volume,
            { valor: interaction.options.getInteger("valor") }
        );
    },

    async handlePrefix(message, args) {
        return musica.rodarPrefixo(
            message,
            musica.volume,
            { valor: args[0] === undefined ? null : args[0] }
        );
    }
};
