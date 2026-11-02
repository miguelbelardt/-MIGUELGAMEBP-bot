const { SlashCommandBuilder } = require("discord.js");

const { mysqlPool, getXP } = require("../database/database.js");
const { abrirRanking } = require("../rankingImagem.js");
const { calcularNivel } = require("../niveis.js");

const LIMITE_POR_PAGINA = 10;

// =====================================================
// 😀 EMOJIS DO RANKING DE XP
// =====================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).

const emojis = require("../emojis.js");

const EMOJIS = {
    erro: emojis.erro
};

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

// =====================================================
// 📊 CARREGAR UMA PÁGINA
// =====================================================

function criarCarregador(userId, guild) {
    return async (tipo, paginaPedida) => {
        let filtro = "";
        let ids = null;

        if (tipo === "local") {
            ids = await pegarUsuariosServidor(guild);

            if (!ids.length) {
                return { linhas: [], pagina: 1, totalPaginas: 1, total: 0, voce: null };
            }

            filtro = " AND id IN (?)";
        }

        const parametros = ids ? [ids] : [];

        const [[contagem]] = await mysqlPool.query(
            `SELECT COUNT(*) AS total FROM usuarios WHERE COALESCE(xp, 0) > 0${filtro}`,
            parametros
        );

        const total = Number(contagem.total);
        const totalPaginas = Math.max(1, Math.ceil(total / LIMITE_POR_PAGINA));
        const pagina = Math.min(Math.max(1, Number(paginaPedida) || 1), totalPaginas);
        const deslocamento = (pagina - 1) * LIMITE_POR_PAGINA;

        const [linhas] = await mysqlPool.query(
            `SELECT id, COALESCE(xp, 0) AS xp
             FROM usuarios
             WHERE COALESCE(xp, 0) > 0${filtro}
             ORDER BY xp DESC, id ASC
             LIMIT ? OFFSET ?`,
            [...parametros, LIMITE_POR_PAGINA, deslocamento]
        );

        // "Sua posição": só aparece se você não está nesta página
        let voce = null;
        const meuXp = await getXP(userId);

        if (meuXp > 0) {
            const [[acima]] = await mysqlPool.query(
                `SELECT COUNT(*) AS total FROM usuarios
                 WHERE (xp > ? OR (xp = ? AND id < ?))${filtro}`,
                [meuXp, meuXp, userId, ...parametros]
            );

            const posicao = Number(acima.total) + 1;
            const inicio = deslocamento + 1;
            const fim = deslocamento + LIMITE_POR_PAGINA;

            const estaNoRanking = tipo !== "local" || ids.includes(userId);

            if (estaNoRanking && (posicao < inicio || posicao > fim)) {
                voce = { id: userId, posicao, valor: meuXp };
            }
        }

        return {
            linhas: linhas.map((l, i) => ({
                id: l.id,
                posicao: deslocamento + i + 1,
                valor: Number(l.xp)
            })),
            pagina,
            totalPaginas,
            total,
            voce
        };
    };
}

function opcoesDoRanking(client, userId, guild, tipo, enviar) {
    return {
        client,
        userId,
        tipo,
        prefixo: "xprank",
        titulo: "Ranking de XP",
        cor: 0x1ABC9C,
        corDestaque: "#1abc9c",
        formatarValor: v => `${Number(v).toLocaleString("pt-BR")} XP`,
        detalhe: v => `Nível ${calcularNivel(v)}`,
        carregar: criarCarregador(userId, guild),
        enviar
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("xp-ranking")
        .setDescription("Mostra o ranking de XP. 📈")
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
                await interaction.editReply("⭐ Ainda não existe ninguém com XP.");
            }

        } catch (erro) {
            console.error("❌ Erro no comando /xp-ranking:", erro);

            const aviso = `${EMOJIS.erro} Não foi possível carregar o ranking de XP.`;

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
                await message.reply("⭐ Ainda não existe ninguém com XP.");
            }

        } catch (erro) {
            console.error("❌ Erro no comando 'xp-ranking:", erro);

            await message.reply(`${EMOJIS.erro} Não foi possível carregar o ranking de XP.`).catch(() => { });
        }
    }
};
