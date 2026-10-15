const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const { getSaldo } = require("../database/database");

// =====================================================
// 😀 EMOJIS DO ATM
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    banco: "🏦",
    saldo: "<:cash:1542933882452578415>",
    moedas: "<:Coin:1528228277913784340>",
    erro: "<:Danger:1536532666101538836>"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("atm")
        .setDescription("Veja seu saldo de moedas 💰"),

    // =====================================================
    // 💬 SLASH COMMAND
    // =====================================================

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            const saldo = await getSaldo(userId);

            const embed = new EmbedBuilder()
                .setTitle(`${EMOJIS.banco} ATM`)
                .setDescription(
                    `${EMOJIS.saldo} **${interaction.user.username}**, seu saldo é:\n\n` +
                    `${EMOJIS.moedas} **${saldo} moedas**`
                )
                .setColor("Green");

            await interaction.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro no ATM:", erro);

            await interaction.reply({
                content: `${EMOJIS.erro} Não foi possível consultar seu saldo.`,
                ephemeral: true
            });
        }
    },

    // =====================================================
    // 🔤 COMANDO POR PREFIXO
    // =====================================================

    async handlePrefix(message) {
        const userId = message.author.id;

        try {
            const saldo = await getSaldo(userId);

            const embed = new EmbedBuilder()
                .setTitle(`${EMOJIS.banco} ATM`)
                .setDescription(
                    `${EMOJIS.saldo} **${message.author.username}**, seu saldo é:\n\n` +
                    `${EMOJIS.moedas} **${saldo} moedas**`
                )
                .setColor("Green");

            await message.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro no ATM por prefixo:", erro);

            await message.reply(
                `${EMOJIS.erro} Não foi possível consultar seu saldo.`
            );
        }
    }
};
