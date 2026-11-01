const { SlashCommandBuilder } = require("discord.js");
const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Repete a música atual ou a fila toda.")
        .addStringOption(opcao =>
            opcao
                .setName("modo")
                .setDescription("O que repetir.")
                .setRequired(true)
                .addChoices(
                    { name: "Desligado", value: "off" },
                    { name: "Repetir a música atual", value: "musica" },
                    { name: "Repetir a fila toda", value: "fila" }
                )
        ),

    async execute(interaction) {
        return musica.rodarSlash(
            interaction,
            musica.loop,
            { modo: interaction.options.getString("modo") }
        );
    },

    async handlePrefix(message, args) {
        return musica.rodarPrefixo(
            message,
            musica.loop,
            { modo: args[0] }
        );
    }
};
