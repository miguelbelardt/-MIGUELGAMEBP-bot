const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getXP
} = require("../database/database.js");

// =====================================================
// 😀 EMOJIS
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    erro: "<:Danger:1536532666101538836>",
    xp: "<:FortniteXP:1528582193717182635>"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("xp")
        .setDescription("Veja a quantidade de XP de um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que você quer consultar.")
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const usuario =
                interaction.options.getUser("usuario") ||
                interaction.user;

            const xp = await getXP(usuario.id);

            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setTitle(`${EMOJIS.xp} XP do usuário`)
                .setDescription(
                    `👤 **Usuário:** ${usuario}\n${EMOJIS.xp} **XP:** ${xp}`
                )
                .setThumbnail(usuario.displayAvatarURL())
                .setFooter({
                    text: "MIGUELGAMEBP-bot"
                });

            await interaction.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando /ver-xp:",
                erro
            );

            await interaction.reply({
                content:
                    `${EMOJIS.erro} Não foi possível consultar o XP.`,
                ephemeral: true
            });
        }
    },

    async handlePrefix(message, args) {
        try {
            const usuario =
                message.mentions.users.first() ||
                message.author;

            const xp = await getXP(usuario.id);

            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setTitle(`${EMOJIS.xp} XP do usuário`)
                .setDescription(
                    `👤 **Usuário:** ${usuario}\n${EMOJIS.xp} **XP:** ${xp}`
                )
                .setThumbnail(usuario.displayAvatarURL())
                .setFooter({
                    text: "MIGUELGAMEBP-bot"
                });

            await message.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando mver-xp:",
                erro
            );

            await message.reply(
                `${EMOJIS.erro} Não foi possível consultar o XP.`
            );
        }
    }
};
