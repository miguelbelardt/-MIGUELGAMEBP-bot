const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const mod = require("../moderacao.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("delwarn")
        .setDescription("Remove uma advertência pelo número. 🗑️")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addIntegerOption(o =>
            o.setName("id").setDescription("Número da advertência (veja em /warns).").setMinValue(1).setRequired(true)
        ),

    async execute(interaction) {
        return mod.rodarSlash(interaction, mod.removerAdvertencia, { id: interaction.options.getInteger("id") });
    },

    async handlePrefix(message, args) {
        return mod.rodarPrefixo(message, mod.removerAdvertencia, { id: args[0] });
    }
};
