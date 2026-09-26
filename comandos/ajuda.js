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

    // =====================================================
    // 💬 SLASH COMMAND
    // =====================================================

    async execute(interaction) {
        const embed = criarEmbedAjuda();
        const row = criarBotao();

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },

    // =====================================================
    // 🔤 COMANDO POR PREFIXO
    // =====================================================

    async handlePrefix(message) {
        const texto = message.content.trim().toLowerCase();

        // Aceita:
        // ' ajuda
        // 'ajuda
        // ' help
        // 'help

        const ehAjuda =
            texto === "' ajuda" ||
            texto === "'ajuda" ||
            texto === "' help" ||
            texto === "'help";

        if (!ehAjuda) return;

        const embed = criarEmbedAjuda();
        const row = criarBotao();

        await message.reply({
            embeds: [embed],
            components: [row]
        });
    },

    // =====================================================
    // 🔘 BOTÃO DE COMANDOS
    // =====================================================

    async handleButton(interaction) {
        if (interaction.customId !== "ajuda_comandos") return;

        const comandos = interaction.client.commands;

        const lista = [...comandos.values()]
            .map(comando => {
                return `**/${comando.data.name}** — ${comando.data.description || "Sem descrição."}`;
            })
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
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

// =====================================================
// 📚 EMBED DA CENTRAL DE AJUDA
// =====================================================

function criarEmbedAjuda() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📚 CENTRAL DE AJUDA")
        .setDescription(
            `Olá! 👋\n` +
            `Aqui você encontra informações sobre como usar o bot.\n\n` +

            `🔤 **PREFIXO**\n` +
            `O prefixo do bot é \`'\`.\n\n` +

            `Você pode usar:\n` +
            `\`'ajuda\`\n` +
            `\`' ajuda\`\n` +
            `\`'help\`\n` +
            `\`' help\`\n\n` +

            `📋 **COMANDOS**\n` +
            `Clique no botão abaixo para visualizar todos os comandos disponíveis.`
        );
}

// =====================================================
// 📋 BOTÃO
// =====================================================

function criarBotao() {
    const botao = new ButtonBuilder()
        .setCustomId("ajuda_comandos")
        .setLabel("📋 Ver comandos")
        .setStyle(ButtonStyle.Primary);

    return new ActionRowBuilder()
        .addComponents(botao);
}
