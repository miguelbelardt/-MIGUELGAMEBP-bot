const { SlashCommandBuilder } = require("discord.js");
const economia = require("../economia.js");
const utilidade = require("../utilidade.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("afk")
        .setDescription("Fica AFK: avisa quem te marcar. 💤")
        .setDMPermission(false)
        .addStringOption(o =>
            o.setName("motivo")
                .setDescription("Por que você está AFK (opcional).")
                .setMaxLength(200)
                .setRequired(false)
        ),

    async execute(interaction) {
        return economia.rodarSlash(interaction, utilidade.ficarAfk, {
            motivo: interaction.options.getString("motivo")
        });
    },

    async handlePrefix(message, args) {
        return economia.rodarPrefixo(message, utilidade.ficarAfk, {
            motivo: args.join(" ")
        });
    }
};
