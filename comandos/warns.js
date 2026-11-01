const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const mod = require("../moderacao.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("warns")
        .setDescription("Veja as advertências de um membro. 📋")
        .setDMPermission(false)
        .addUserOption(o =>
            o.setName("usuario").setDescription("Usuário (padrão: você).").setRequired(false)
        ),

    async execute(interaction) {
        return mod.rodarSlash(interaction, mod.verAdvertencias, { alvoId: (interaction.options.getUser("usuario") || interaction.user).id });
    },

    async handlePrefix(message, args) {
        const { alvoId } = mod.alvoDoPrefixo(args);

        return mod.rodarPrefixo(message, mod.verAdvertencias, { alvoId: alvoId || message.author.id });
    }
};
