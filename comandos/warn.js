const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const mod = require("../moderacao.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Dá uma advertência a um membro. ⚠️")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption(o =>
            o.setName("usuario").setDescription("Usuário alvo.").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("motivo").setDescription("Motivo da advertência.").setMaxLength(400).setRequired(true)
        ),

    async execute(interaction) {
        return mod.rodarSlash(interaction, mod.advertir, { alvoId: interaction.options.getUser("usuario").id, motivo: interaction.options.getString("motivo") });
    },

    async handlePrefix(message, args) {
        const { alvoId, resto } = mod.alvoDoPrefixo(args);

        if (!alvoId) return message.reply(mod.AJUDA_ALVO);

        return mod.rodarPrefixo(message, mod.advertir, { alvoId, motivo: resto.join(" ") });
    }
};
