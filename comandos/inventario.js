const { SlashCommandBuilder } = require("discord.js");
const economia = require("../economia.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("inventario")
        .setDescription("Veja os itens de um inventário. 🎒")
        .addUserOption(o =>
            o.setName("usuario")
                .setDescription("Usuário (padrão: você).")
                .setRequired(false)
        ),

    async execute(interaction) {
        return economia.rodarSlash(interaction, economia.inventario, {
            alvo: interaction.options.getUser("usuario")
        });
    },

    async handlePrefix(message) {
        return economia.rodarPrefixo(message, economia.inventario, {
            alvo: message.mentions.users.first() || null
        });
    }
};
