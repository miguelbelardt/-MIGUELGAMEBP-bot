const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ajuda")
        .setDescription("Abra a Central de Ajuda 📚"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("📚 CENTRAL DE AJUDA")
            .setDescription(
                `Olá! 👋\n` +
                `Aqui você encontra informações sobre como usar o bot.\n\n` +

                `🔤 **PREFIXO**\n` +
                `O prefixo do bot é \`M\` ou \`m\`.\n\n` +

                `Você pode usar:\n` +
                `\`M ajuda\`\n` +
                `\`m ajuda\`\n` +
                `\`Majuda\`\n` +
                `\`majuda\`\n\n` +

                `📋 **COMANDOS**\n` +
                `Clique no botão abaixo para visualizar todos os comandos disponíveis.`
            );

        const botao = new ButtonBuilder()
            .setCustomId("ajuda_comandos")
            .setLabel("📋 Ver comandos")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(botao);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },

    async handleButton(interaction) {
        if (interaction.customId !== "ajuda_comandos") return;

        const comandos = interaction.client.commands;

        const lista = [...comandos.values()]
            .map(comando => {
                return `**/${comando.data.name}** — ${comando.data.description || "Sem descrição."}`;
            })
            .join("\n");

        const embed = new EmbedBuilder()
            .setTitle("📋 COMANDOS DISPONÍVEIS")
            .setDescription(
                lista || "❌ Nenhum comando encontrado."
            );

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};
