const { SlashCommandBuilder } = require("discord.js");
const help = require("./help.js");

// A /ajuda abre a mesma central do /help.
module.exports = {
    data: new SlashCommandBuilder()
        .setName("ajuda")
        .setDescription("Abra a Central de Ajuda 📚"),

    async execute(interaction) {
        await help.execute(interaction);
    },

    async handlePrefix(message) {
        await help.handlePrefix(message);
    },

    // Botão "Ver comandos" de painéis antigos que ainda estão no chat
    async handleButton(interaction) {
        if (interaction.customId !== "ajuda_comandos") return;

        await interaction.reply({
            content: "📚 Esse painel é da versão antiga. Use `/help` para abrir a nova central.",
            ephemeral: true
        });
    }
};
