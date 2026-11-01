const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const mod = require("../moderacao.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Expulsa um membro do servidor. 👢")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .setDMPermission(false)
        .addUserOption(o =>
            o.setName("usuario").setDescription("Usuário alvo.").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("motivo").setDescription("Motivo (opcional).").setMaxLength(400).setRequired(false)
        ),

    async execute(interaction) {
        return mod.rodarSlash(interaction, mod.expulsar, { alvoId: interaction.options.getUser("usuario").id, motivo: interaction.options.getString("motivo") });
    },

    async handlePrefix(message, args) {
        const { alvoId, resto } = mod.alvoDoPrefixo(args);

        if (!alvoId) return message.reply(mod.AJUDA_ALVO);

        return mod.rodarPrefixo(message, mod.expulsar, { alvoId, motivo: resto.join(" ") });
    }
};
