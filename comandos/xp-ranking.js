const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getRankingXP
} = require("../database/database.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("xp-ranking")
        .setDescription("Mostra o ranking de XP do servidor."),

    async execute(interaction) {
        try {
            const ranking = await getRankingXP(10);

            if (ranking.length === 0) {
                return interaction.reply(
                    "⭐ Ainda não existe ninguém com XP."
                );
            }

            const linhas = ranking.map(usuario => {
                return `${usuario.posicao}. <@${usuario.id}> — ⭐ **${usuario.xp} XP**`;
            });

            const embed = new EmbedBuilder()
                .setColor("Gold")
                .setTitle("🏆 Ranking de XP")
                .setDescription(linhas.join("\n"))
                .setFooter({
                    text: "Top 10 jogadores com mais XP"
                });

            await interaction.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando /xp-ranking:",
                erro
            );

            await interaction.reply({
                content:
                    "❌ Não foi possível carregar o ranking de XP.",
                ephemeral: true
            });
        }
    },

    async handlePrefix(message) {
        try {
            const ranking = await getRankingXP(10);

            if (ranking.length === 0) {
                return message.reply(
                    "⭐ Ainda não existe ninguém com XP."
                );
            }

            const linhas = ranking.map(usuario => {
                return `${usuario.posicao}. <@${usuario.id}> — ⭐ **${usuario.xp} XP**`;
            });

            const embed = new EmbedBuilder()
                .setColor("Gold")
                .setTitle("🏆 Ranking de XP")
                .setDescription(linhas.join("\n"))
                .setFooter({
                    text: "Top 10 jogadores com mais XP"
                });

            await message.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando mxp-ranking:",
                erro
            );

            await message.reply(
                "❌ Não foi possível carregar o ranking de XP."
            );
        }
    }
};
