const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Abra a Central de Ajuda 📚"),

    async execute(interaction) {
        const embed = criarEmbedAjuda();

        const botao = criarBotao();

        const row = new ActionRowBuilder()
            .addComponents(botao);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },

    async handlePrefix(message) {
        const conteudo = message.content.trim();
        const texto = conteudo.toLowerCase();

        // Aceita:
        // 'help
        // ' help
        // 'ajuda
        // ' ajuda

        const ehHelp =
            texto === "'help" ||
            texto === "' help" ||
            texto === "'ajuda" ||
            texto === "' ajuda";

        if (!ehHelp) return;

        const embed = criarEmbedAjuda();

        const botao = criarBotao();

        const row = new ActionRowBuilder()
            .addComponents(botao);

        await message.reply({
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
    return new ButtonBuilder()
        .setCustomId("ajuda_comandos")
        .setLabel("📋 Ver comandos")
        .setStyle(ButtonStyle.Primary);
}
