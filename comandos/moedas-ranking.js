const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getRankingMoedas
} = require("../database/database");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("moedas-ranking")
        .setDescription(
            "Veja o ranking de usuários com mais moedas! 🏆"
        ),

    async execute(interaction) {
        try {
            const resultado =
                await getRankingMoedas(
                    interaction.user.id
                );

            const ranking =
                resultado.ranking;

            const usuario =
                resultado.usuario;

            if (ranking.length === 0) {
                return interaction.reply({
                    content:
                        "❌ Ainda não existem usuários no ranking.",
                    ephemeral: true
                });
            }

            const linhas = [];

            for (const pessoa of ranking) {
                let medalha;

                if (pessoa.posicao === 1) {
                    medalha = "🥇";
                } else if (pessoa.posicao === 2) {
                    medalha = "🥈";
                } else if (pessoa.posicao === 3) {
                    medalha = "🥉";
                } else {
                    medalha = `**${pessoa.posicao}.**`;
                }

                linhas.push(
                    `${medalha} <@${pessoa.id}> — **${pessoa.saldo.toLocaleString("pt-BR")} moedas**`
                );
            }

            let texto = linhas.join("\n");

            if (usuario.posicao > 10) {
                texto +=
                    `\n\n━━━━━━━━━━━━━━━━━━\n` +
                    `📍 **Sua posição:** ${usuario.posicao}º\n` +
                    `💰 **Suas moedas:** ${usuario.saldo.toLocaleString("pt-BR")}`;
            }

            const embed =
                new EmbedBuilder()
                    .setTitle("🏆 RANKING DE MOEDAS")
                    .setDescription(texto)
                    .setFooter({
                        text:
                            "Ranking baseado na quantidade de moedas."
                    });

            await interaction.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no ranking de moedas:",
                erro
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Não foi possível carregar o ranking.",
                    ephemeral: true
                });
            }
        }
    },

    async handlePrefix(message) {
        try {
            const resultado =
                await getRankingMoedas(
                    message.author.id
                );

            const ranking =
                resultado.ranking;

            const usuario =
                resultado.usuario;

            if (ranking.length === 0) {
                return message.reply(
                    "❌ Ainda não existem usuários no ranking."
                );
            }

            const linhas = [];

            for (const pessoa of ranking) {
                let medalha;

                if (pessoa.posicao === 1) {
                    medalha = "🥇";
                } else if (pessoa.posicao === 2) {
                    medalha = "🥈";
                } else if (pessoa.posicao === 3) {
                    medalha = "🥉";
                } else {
                    medalha = `**${pessoa.posicao}.**`;
                }

                linhas.push(
                    `${medalha} <@${pessoa.id}> — **${pessoa.saldo.toLocaleString("pt-BR")} moedas**`
                );
            }

            let texto = linhas.join("\n");

            if (usuario.posicao > 10) {
                texto +=
                    `\n\n━━━━━━━━━━━━━━━━━━\n` +
                    `📍 **Sua posição:** ${usuario.posicao}º\n` +
                    `💰 **Suas moedas:** ${usuario.saldo.toLocaleString("pt-BR")}`;
            }

            const embed =
                new EmbedBuilder()
                    .setTitle("🏆 RANKING DE MOEDAS")
                    .setDescription(texto)
                    .setFooter({
                        text:
                            "Ranking baseado na quantidade de moedas."
                    });

            await message.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no ranking de moedas por prefixo:",
                erro
            );

            await message.reply(
                "❌ Não foi possível carregar o ranking."
            );
        }
    }
};
