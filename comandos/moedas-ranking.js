const { SlashCommandBuilder } = require("discord.js");

const { getRankingMoedasPaginado } = require("../database/database");
const { abrirRanking } = require("../rankingImagem.js");

const LIMITE_POR_PAGINA = 10;

// ================================================
// 😀 EMOJIS DO RANKING
// ================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).

const emojis = require("../emojis.js");

const EMOJIS = {
    erro: emojis.erro
};

// ================================================
// 👥 USUÁRIOS DO SERVIDOR (para o ranking local)
// ================================================

async function pegarUsuariosServidor(guild) {
    if (!guild) return [];

    try {
        await guild.members.fetch();
    } catch (erro) {
        console.error("❌ Erro ao buscar membros do servidor:", erro);
    }

    return [
        ...guild.members.cache
            .filter(membro => !membro.user.bot)
            .keys()
    ];
}

// ================================================
// 📊 CARREGAR UMA PÁGINA
// ================================================

function criarCarregador(userId, guild) {
    return async (tipo, pagina) => {
        let usuariosServidor = [];

        if (tipo === "local") {
            usuariosServidor = await pegarUsuariosServidor(guild);

            if (!usuariosServidor.includes(userId)) {
                usuariosServidor.push(userId);
            }
        }

        const r = await getRankingMoedasPaginado(
            userId,
            tipo,
            usuariosServidor,
            pagina,
            LIMITE_POR_PAGINA
        );

        // Mostra "sua posição" só se você não está nesta página
        let voce = null;

        if (r.usuario && r.usuario.posicao) {
            const inicio = (r.pagina - 1) * LIMITE_POR_PAGINA + 1;
            const fim = r.pagina * LIMITE_POR_PAGINA;

            if (r.usuario.posicao < inicio || r.usuario.posicao > fim) {
                voce = {
                    id: userId,
                    posicao: r.usuario.posicao,
                    valor: r.usuario.saldo
                };
            }
        }

        return {
            linhas: r.ranking.map(p => ({
                id: p.id,
                posicao: p.posicao,
                valor: p.saldo
            })),
            pagina: r.pagina,
            totalPaginas: r.totalPaginas,
            total: r.totalUsuarios,
            voce
        };
    };
}

function opcoesDoRanking(client, userId, guild, tipo, enviar) {
    return {
        client,
        userId,
        tipo,
        prefixo: "moedas",
        titulo: "Ranking de Moedas",
        cor: 0xFEE75C,
        corDestaque: "#f1c40f",
        formatarValor: v => `${Number(v).toLocaleString("pt-BR")} moedas`,
        carregar: criarCarregador(userId, guild),
        enviar
    };
}

// ================================================
// 📦 COMANDO
// ================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("moedas-ranking")
        .setDescription("Veja o ranking de usuários com mais moedas! 🏆")
        .addStringOption(option =>
            option
                .setName("tipo")
                .setDescription("Escolha entre ranking local ou global.")
                .setRequired(false)
                .addChoices(
                    { name: "🏠 Local", value: "local" },
                    { name: "🌎 Global", value: "global" }
                )
        ),

    async execute(interaction) {
        try {
            if (!interaction.guild) {
                return interaction.reply({
                    content: `${EMOJIS.erro} Esse comando só pode ser usado em um servidor.`,
                    ephemeral: true
                });
            }

            // Montar a imagem pode passar de 3 segundos
            await interaction.deferReply();

            const r = await abrirRanking(
                opcoesDoRanking(
                    interaction.client,
                    interaction.user.id,
                    interaction.guild,
                    interaction.options.getString("tipo") || "global",
                    dados => interaction.editReply(dados)
                )
            );

            if (r.vazio) {
                await interaction.editReply(`${EMOJIS.erro} Ainda não existem usuários no ranking.`);
            }

        } catch (erro) {
            console.error("❌ Erro no ranking de moedas:", erro);

            const aviso = `${EMOJIS.erro} Não foi possível carregar o ranking.`;

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: aviso, embeds: [], files: [], components: [] }).catch(() => { });
            } else {
                await interaction.reply({ content: aviso, ephemeral: true }).catch(() => { });
            }
        }
    },

    async handlePrefix(message, args) {
        try {
            if (!message.guild) {
                return message.reply(`${EMOJIS.erro} Esse comando só pode ser usado em um servidor.`);
            }

            const argumento = args?.[0]?.toLowerCase();
            const tipo = argumento === "local" || argumento === "l" ? "local" : "global";

            await message.channel.sendTyping().catch(() => { });

            const r = await abrirRanking(
                opcoesDoRanking(
                    message.client,
                    message.author.id,
                    message.guild,
                    tipo,
                    dados => message.reply(dados)
                )
            );

            if (r.vazio) {
                await message.reply(`${EMOJIS.erro} Ainda não existem usuários no ranking.`);
            }

        } catch (erro) {
            console.error("❌ Erro no ranking de moedas por prefixo:", erro);

            await message.reply(`${EMOJIS.erro} Não foi possível carregar o ranking.`).catch(() => { });
        }
    }
};
