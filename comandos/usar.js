const { SlashCommandBuilder } = require("discord.js");
const economia = require("../economia.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("usar")
        .setDescription("Usa um item do seu inventário. 🧪")
        .addStringOption(o =>
            o.setName("item")
                .setDescription("Item que você quer usar.")
                .setRequired(true)
                .addChoices(...economia.ITENS.map(i => ({ name: i.nome, value: i.id })))
        ),

    async execute(interaction) {
        return economia.rodarSlash(interaction, economia.usar, {
            item: interaction.options.getString("item")
        });
    },

    async handlePrefix(message, args) {
        return economia.rodarPrefixo(message, economia.usar, {
            item: args.join(" ")
        });
    }
};
