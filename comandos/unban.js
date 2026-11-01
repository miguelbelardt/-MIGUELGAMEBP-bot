const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const mod = require("../moderacao.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbane um usuário pelo ID. ♻️")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setDMPermission(false)
        .addStringOption(o =>
            o.setName("id").setDescription("ID do usuário banido.").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("motivo").setDescription("Motivo (opcional).").setMaxLength(400).setRequired(false)
        ),

    async execute(interaction) {
        return mod.rodarSlash(interaction, mod.desbanir, { alvoId: interaction.options.getString("id").trim(), motivo: interaction.options.getString("motivo") });
    },

    async handlePrefix(message, args) {
        const alvoId = (args[0] || "").trim();

        if (!/^\d{15,25}$/.test(alvoId)) {
            return message.reply("❌ Informe o ID do usuário banido.");
        }

        return mod.rodarPrefixo(message, mod.desbanir, { alvoId, motivo: args.slice(1).join(" ") });
    }
};
