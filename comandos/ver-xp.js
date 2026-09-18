const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getXP
} = require("../database/database.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ver-xp")
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
                .setTitle("⭐ XP do usuário")
                .setDescription(
                    `👤 **Usuário:** ${usuario}\n⭐ **XP:** ${xp}`
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
                    "❌ Não foi possível consultar o XP.",
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
                .setTitle("⭐ XP do usuário")
                .setDescription(
                    `👤 **Usuário:** ${usuario}\n⭐ **XP:** ${xp}`
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
                "❌ Não foi possível consultar o XP."
            );
        }
    }
};
