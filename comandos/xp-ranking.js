const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getRankingXP
} = require("../database/database.js");

// =====================================================
// 😀 EMOJIS DO RANKING DE XP
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    ranking: "<:GoldRank:1542947364212318328>",
    xp: "<:FortniteXP:1528582193717182635>",
    erro: "<:Danger:1536532666101538836>"
};

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
                return `${usuario.posicao}. <@${usuario.id}> — ${EMOJIS.xp} **${usuario.xp} XP**`;
            });

            const embed = new EmbedBuilder()
                .setColor("Gold")
                .setTitle(`${EMOJIS.ranking} Ranking de XP`)
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
                    `${EMOJIS.erro} Não foi possível carregar o ranking de XP.`,
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
                return `${usuario.posicao}. <@${usuario.id}> — ${EMOJIS.xp} **${usuario.xp} XP**`;
            });

            const embed = new EmbedBuilder()
                .setColor("Gold")
                .setTitle(`${EMOJIS.ranking} Ranking de XP`)
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
                `${EMOJIS.erro} Não foi possível carregar o ranking de XP.`
            );
        }
    }
};
