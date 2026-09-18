const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    getRankingMoedasPaginado
} = require("../database/database");

const LIMITE_POR_PAGINA = 10;

// ================================================
// 🏆 CRIAR EMBED DO RANKING
// ================================================

function criarEmbed(resultado, tipo) {

    const ranking = resultado.ranking;
    const usuario = resultado.usuario;

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

    if (
        usuario.posicao &&
        usuario.posicao > (
            resultado.pagina *
            LIMITE_POR_PAGINA
        )
    ) {

        texto +=
            `\n\n━━━━━━━━━━━━━━━━━━\n` +
            `📍 **Sua posição:** ${usuario.posicao}º\n` +
            `💰 **Suas moedas:** ${usuario.saldo.toLocaleString("pt-BR")}`;
    }

    const nomeTipo =
        tipo === "local"
            ? "🏠 RANKING LOCAL"
            : "🌎 RANKING GLOBAL";

    return new EmbedBuilder()
        .setTitle(`🏆 ${nomeTipo}`)
        .setDescription(texto)
        .setFooter({
            text:
                `Página ${resultado.pagina}/${resultado.totalPaginas} • ` +
                `${resultado.totalUsuarios} usuários`
        });
}

// ================================================
// 🔘 CRIAR BOTÕES
// ================================================

function criarBotoes(resultado, tipo, userId) {

    const pagina = resultado.pagina;
    const totalPaginas = resultado.totalPaginas;

    return new ActionRowBuilder().addComponents(

        new ButtonBuilder()
            .setCustomId(
                `moedas_anterior_${userId}`
            )
            .setLabel("Voltar")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina <= 1),

        new ButtonBuilder()
            .setCustomId(
                `moedas_global_${userId}`
            )
            .setLabel("Global")
            .setEmoji("🌎")
            .setStyle(
                tipo === "global"
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary
            ),

        new ButtonBuilder()
            .setCustomId(
                `moedas_local_${userId}`
            )
            .setLabel("Local")
            .setEmoji("🏠")
            .setStyle(
                tipo === "local"
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary
            ),

        new ButtonBuilder()
            .setCustomId(
                `moedas_proxima_${userId}`
            )
            .setLabel("Próxima")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina >= totalPaginas)
    );
}

// ================================================
// 👥 PEGAR USUÁRIOS DO SERVIDOR
// ================================================

async function pegarUsuariosServidor(guild) {

    if (!guild) {
        return [];
    }

    try {

        const membros =
            await guild.members.fetch();

        return [
            ...membros.keys()
        ];

    } catch (erro) {

        console.error(
            "❌ Erro ao buscar membros do servidor:",
            erro
        );

        return [];
    }
}

// ================================================
// 📊 CARREGAR RANKING
// ================================================

async function carregarRanking(
    userId,
    guild,
    tipo,
    pagina
) {

    let usuariosServidor = [];

    if (tipo === "local") {
        usuariosServidor =
            await pegarUsuariosServidor(guild);
    }

    return await getRankingMoedasPaginado(
        userId,
        tipo,
        usuariosServidor,
        pagina,
        LIMITE_POR_PAGINA
    );
}

// ================================================
// 📦 COMANDO
// ================================================

module.exports = {

    data: new SlashCommandBuilder()
        .setName("moedas-ranking")
        .setDescription(
            "Veja o ranking de usuários com mais moedas! 🏆"
        )
        .addStringOption(option =>
            option
                .setName("tipo")
                .setDescription(
                    "Escolha entre ranking local ou global."
                )
                .setRequired(false)
                .addChoices(
                    {
                        name: "🏠 Local",
                        value: "local"
                    },
                    {
                        name: "🌎 Global",
                        value: "global"
                    }
                )
        ),

    // ================================================
    // /moedas-ranking
    // ================================================

    async execute(interaction) {

        try {

            if (!interaction.guild) {
                return interaction.reply({
                    content:
                        "❌ Esse comando só pode ser usado em um servidor.",
                    ephemeral: true
                });
            }

            const tipo =
                interaction.options.getString("tipo") ||
                "global";

            const resultado =
                await carregarRanking(
                    interaction.user.id,
                    interaction.guild,
                    tipo,
                    1
                );

            if (resultado.ranking.length === 0) {
                return interaction.reply({
                    content:
                        "❌ Ainda não existem usuários no ranking.",
                    ephemeral: true
                });
            }

            const embed =
                criarEmbed(
                    resultado,
                    tipo
                );

            const botoes =
                criarBotoes(
                    resultado,
                    tipo,
                    interaction.user.id
                );

            const resposta =
                await interaction.reply({
                    embeds: [embed],
                    components: [botoes],
                    fetchReply: true
                });

            const collector =
                resposta.createMessageComponentCollector({
                    time: 5 * 60 * 1000
                });

            collector.on(
                "collect",
                async botao => {

                    if (
                        botao.user.id !==
                        interaction.user.id
                    ) {
                        return botao.reply({
                            content:
                                "❌ Esse ranking pertence a outra pessoa.",
                            ephemeral: true
                        });
                    }

                    try {

                        const partes =
                            botao.customId.split("_");

                        const acao =
                            partes[1];

                        let novoTipo =
                            tipo;

                        let novaPagina =
                            resultado.pagina;

                        if (acao === "anterior") {

                            novaPagina =
                                Math.max(
                                    1,
                                    novaPagina - 1
                                );

                        } else if (acao === "proxima") {

                            novaPagina =
                                Math.min(
                                    resultado.totalPaginas,
                                    novaPagina + 1
                                );

                        } else if (
                            acao === "global"
                        ) {

                            novoTipo =
                                "global";

                            novaPagina = 1;

                        } else if (
                            acao === "local"
                        ) {

                            novoTipo =
                                "local";

                            novaPagina = 1;
                        }

                        const novoResultado =
                            await carregarRanking(
                                interaction.user.id,
                                interaction.guild,
                                novoTipo,
                                novaPagina
                            );

                        if (
                            novoResultado.ranking.length === 0
                        ) {
                            return botao.update({
                                content:
                                    "❌ Ainda não existem usuários no ranking.",
                                embeds: [],
                                components: []
                            });
                        }

                        const novoEmbed =
                            criarEmbed(
                                novoResultado,
                                novoTipo
                            );

                        const novosBotoes =
                            criarBotoes(
                                novoResultado,
                                novoTipo,
                                interaction.user.id
                            );

                        await botao.update({
                            embeds: [novoEmbed],
                            components: [novosBotoes]
                        });

                    } catch (erro) {

                        console.error(
                            "❌ Erro ao atualizar ranking:",
                            erro
                        );

                        if (!botao.replied) {
                            await botao.reply({
                                content:
                                    "❌ Não foi possível atualizar o ranking.",
                                ephemeral: true
                            });
                        }
                    }
                }
            );

            collector.on(
                "end",
                async () => {

                    try {

                        const mensagem =
                            await interaction.fetchReply();

                        const botoesDesativados =
                            new ActionRowBuilder().addComponents(

                                new ButtonBuilder()
                                    .setCustomId(
                                        `moedas_anterior_expirado`
                                    )
                                    .setLabel("Voltar")
                                    .setEmoji("◀️")
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                                    .setDisabled(true),

                                new ButtonBuilder()
                                    .setCustomId(
                                        `moedas_global_expirado`
                                    )
                                    .setLabel("Global")
                                    .setEmoji("🌎")
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                                    .setDisabled(true),

                                new ButtonBuilder()
                                    .setCustomId(
                                        `moedas_local_expirado`
                                    )
                                    .setLabel("Local")
                                    .setEmoji("🏠")
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                                    .setDisabled(true),

                                new ButtonBuilder()
                                    .setCustomId(
                                        `moedas_proxima_expirado`
                                    )
                                    .setLabel("Próxima")
                                    .setEmoji("▶️")
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                                    .setDisabled(true)
                            );

                        await mensagem.edit({
                            components: [
                                botoesDesativados
                            ]
                        });

                    } catch (erro) {
                        // Mensagem pode ter sido apagada
                    }
                }
            );

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

    // ================================================
    // mmoedas-ranking
    // ================================================

    async handlePrefix(message, args) {

        try {

            if (!message.guild) {
                return message.reply(
                    "❌ Esse comando só pode ser usado em um servidor."
                );
            }

            const argumento =
                args?.[0]?.toLowerCase();

            let tipo = "global";

            if (
                argumento === "local" ||
                argumento === "l"
            ) {
                tipo = "local";
            }

            if (
                argumento === "global" ||
                argumento === "g"
            ) {
                tipo = "global";
            }

            const resultado =
                await carregarRanking(
                    message.author.id,
                    message.guild,
                    tipo,
                    1
                );

            if (resultado.ranking.length === 0) {
                return message.reply(
                    "❌ Ainda não existem usuários no ranking."
                );
            }

            const embed =
                criarEmbed(
                    resultado,
                    tipo
                );

            const botoes =
                criarBotoes(
                    resultado,
                    tipo,
                    message.author.id
                );

            const resposta =
                await message.reply({
                    embeds: [embed],
                    components: [botoes]
                });

            const collector =
                resposta.createMessageComponentCollector({
                    time: 5 * 60 * 1000
                });

            collector.on(
                "collect",
                async botao => {

                    if (
                        botao.user.id !==
                        message.author.id
                    ) {
                        return botao.reply({
                            content:
                                "❌ Esse ranking pertence a outra pessoa.",
                            ephemeral: true
                        });
                    }

                    try {

                        const partes =
                            botao.customId.split("_");

                        const acao =
                            partes[1];

                        let novoTipo =
                            tipo;

                        let novaPagina =
                            resultado.pagina;

                        if (
                            acao === "anterior"
                        ) {

                            novaPagina =
                                Math.max(
                                    1,
                                    novaPagina - 1
                                );

                        } else if (
                            acao === "proxima"
                        ) {

                            novaPagina =
                                Math.min(
                                    resultado.totalPaginas,
                                    novaPagina + 1
                                );

                        } else if (
                            acao === "global"
                        ) {

                            novoTipo =
                                "global";

                            novaPagina = 1;

                        } else if (
                            acao === "local"
                        ) {

                            novoTipo =
                                "local";

                            novaPagina = 1;
                        }

                        const novoResultado =
                            await carregarRanking(
                                message.author.id,
                                message.guild,
                                novoTipo,
                                novaPagina
                            );

                        if (
                            novoResultado.ranking.length === 0
                        ) {
                            return botao.update({
                                content:
                                    "❌ Ainda não existem usuários no ranking.",
                                embeds: [],
                                components: []
                            });
                        }

                        const novoEmbed =
                            criarEmbed(
                                novoResultado,
                                novoTipo
                            );

                        const novosBotoes =
                            criarBotoes(
                                novoResultado,
                                novoTipo,
                                message.author.id
                            );

                        await botao.update({
                            embeds: [novoEmbed],
                            components: [novosBotoes]
                        });

                    } catch (erro) {

                        console.error(
                            "❌ Erro ao atualizar ranking por prefixo:",
                            erro
                        );

                        if (!botao.replied) {
                            await botao.reply({
                                content:
                                    "❌ Não foi possível atualizar o ranking.",
                                ephemeral: true
                            });
                        }
                    }
                }
            );

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
