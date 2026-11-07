const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const configServidor = require("../configServidor.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("server-config")
        .setDescription("Ligue ou desligue os recursos do bot neste servidor. 🛠️")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({
                content: "❌ Esse comando só funciona dentro de um servidor.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (!configServidor.podeConfigurar(interaction)) {
            return interaction.reply({
                content: "❌ Você precisa da permissão **Gerenciar Servidor** para usar isso.",
                flags: MessageFlags.Ephemeral
            });
        }

        const dados = await configServidor.abrirPainel(interaction.guildId);

        return interaction.reply({
            ...dados,
            flags: MessageFlags.Ephemeral
        });
    },

    async handlePrefix(message) {
        return message.reply({
            content: "🛠️ Use **/server-config**: o painel é privado e só quem tem Gerenciar Servidor vê.",
            allowedMentions: { parse: [] }
        });
    }
};
