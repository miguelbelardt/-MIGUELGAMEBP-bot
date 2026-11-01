const { SlashCommandBuilder } = require("discord.js");
const economia = require("../economia.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("trabalhar")
        .setDescription("Trabalhe para ganhar moedas (1 vez por hora). 💼"),

    async execute(interaction) {
        return economia.rodarSlash(interaction, economia.trabalhar);
    },

    async handlePrefix(message) {
        return economia.rodarPrefixo(message, economia.trabalhar);
    }
};
