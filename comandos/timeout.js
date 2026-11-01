const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const mod = require("../moderacao.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Silencia um membro por um tempo. 🔇")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption(o =>
            o.setName("usuario").setDescription("Usuário alvo.").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("duracao").setDescription("Ex.: 30s, 10m, 2h, 1d (máx. 28d) ou off para remover.").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("motivo").setDescription("Motivo (opcional).").setMaxLength(400).setRequired(false)
        ),

    async execute(interaction) {
        return mod.rodarSlash(interaction, mod.silenciar, { alvoId: interaction.options.getUser("usuario").id, duracao: interaction.options.getString("duracao"), motivo: interaction.options.getString("motivo") });
    },

    async handlePrefix(message, args) {
        const { alvoId, resto } = mod.alvoDoPrefixo(args);

        if (!alvoId) return message.reply(mod.AJUDA_ALVO);

        if (!resto[0]) {
            return message.reply("❌ Informe a duração. Ex.: `'timeout @fulano 10m motivo`");
        }

        return mod.rodarPrefixo(message, mod.silenciar, {
            alvoId,
            duracao: resto[0],
            motivo: resto.slice(1).join(" ")
        });
    }
};
