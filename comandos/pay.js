const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { mysqlPool, getSaldo } = require("../database/database");

// =====================================================
// 😀 EMOJIS DO PAY
// =====================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).
// Os outros ficam aqui: para trocar, coloque o código do emoji
// (use /emojiinfo) ou um emoji normal.

const emojis = require("../emojis.js");

const EMOJIS = {
    pagamento: "💸",
    pessoa: emojis.pessoa,
    moedas: emojis.moedas,
    saldo: emojis.saldo,
    relogio: emojis.relogio,
    sucesso: emojis.sucesso,
    erro: emojis.erro
};

const EXPIRA_EM = 60 * 60 * 1000;

async function criarPagamento(remetenteId, destinatario, quantidade, responder) {
    if (!destinatario) {
        return responder({
            content: `${EMOJIS.erro} Você precisa informar o usuário que receberá as moedas.`,
            ephemeral: true
        });
    }

    if (!Number.isInteger(quantidade) || quantidade < 1) {
        return responder({
            content: `${EMOJIS.erro} A quantidade precisa ser um número inteiro maior que 0.`,
            ephemeral: true
        });
    }

    if (destinatario.id === remetenteId) {
        return responder({
            content: `${EMOJIS.erro} Você não pode enviar moedas para si mesmo.`,
            ephemeral: true
        });
    }

    if (destinatario.bot) {
        return responder({
            content: `${EMOJIS.erro} Você não pode enviar moedas para um bot.`,
            ephemeral: true
        });
    }

    try {
        const saldo = await getSaldo(remetenteId);

        if (saldo < quantidade) {
            return responder({
                content:
                    `${EMOJIS.erro} Você não tem moedas suficientes.\n` +
                    `${EMOJIS.moedas} Seu saldo: **${saldo} moedas**\n` +
                    `${EMOJIS.pagamento} Tentativa: **${quantidade} moedas**`,
                ephemeral: true
            });
        }

        const id = `${remetenteId}-${destinatario.id}-${Date.now()}`;

        const expiraEm =
            Math.floor((Date.now() + EXPIRA_EM) / 1000);

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.pagamento} PEDIDO DE PAGAMENTO`)
            .setDescription(
                `<@${remetenteId}> quer enviar **${quantidade} moedas** para ${destinatario}.\n\n` +
                `${EMOJIS.pessoa} Destinatário: ${destinatario}\n` +
                `${EMOJIS.moedas} Quantidade: **${quantidade} moedas**\n\n` +
                `${EMOJIS.relogio} Este pedido expira <t:${expiraEm}:R> (<t:${expiraEm}:t>).\n` +
                `Apenas o destinatário pode aceitar.`
            )
            .setColor("Yellow");

        const botoes = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`pay_accept_${id}`)
                    .setLabel("Aceitar pagamento")
                    .setEmoji(EMOJIS.sucesso)
                    .setStyle(ButtonStyle.Success)
            );

        const mensagem = await responder({
            embeds: [embed],
            components: [botoes],
            fetchReply: true
        });

        const collector = mensagem.createMessageComponentCollector({
            time: EXPIRA_EM
        });

        collector.on("collect", async buttonInteraction => {
            if (buttonInteraction.user.id !== destinatario.id) {
                return buttonInteraction.reply({
                    content: `${EMOJIS.erro} Apenas o destinatário pode aceitar este pagamento.`,
                    ephemeral: true
                });
            }

            collector.stop("accepted");

            let connection;

            try {
                connection = await mysqlPool.getConnection();

                await connection.beginTransaction();

                // Garante que o destinatário exista
                await connection.query(
                    `
                    INSERT IGNORE INTO usuarios (id, saldo)
                    VALUES (?, 0)
                    `,
                    [destinatario.id]
                );

                // Retira as moedas do remetente somente se houver saldo suficiente
                const [resultado] = await connection.query(
                    `
                    UPDATE usuarios
                    SET saldo = COALESCE(saldo, 0) - ?
                    WHERE id = ?
                    AND COALESCE(saldo, 0) >= ?
                    `,
                    [quantidade, remetenteId, quantidade]
                );

                if (resultado.affectedRows === 0) {
                    await connection.rollback();

                    return buttonInteraction.update({
                        content:
                            `${EMOJIS.erro} O pagamento não pôde ser realizado porque o remetente não possui saldo suficiente.`,
                        embeds: [],
                        components: []
                    });
                }

                // Adiciona as moedas ao destinatário
                await connection.query(
                    `
                    UPDATE usuarios
                    SET saldo = COALESCE(saldo, 0) + ?
                    WHERE id = ?
                    `,
                    [quantidade, destinatario.id]
                );

                // Busca o novo saldo do remetente
                const [saldoAtualizado] = await connection.query(
                    `
                    SELECT COALESCE(saldo, 0) AS saldo
                    FROM usuarios
                    WHERE id = ?
                    `,
                    [remetenteId]
                );

                await connection.commit();

                const novoSaldo = Number(saldoAtualizado[0]?.saldo ?? 0);

                const sucesso = new EmbedBuilder()
                    .setTitle(`${EMOJIS.sucesso} PAGAMENTO ACEITO`)
                    .setDescription(
                        `${destinatario} aceitou o pagamento de <@${remetenteId}>!\n\n` +
                        `${EMOJIS.moedas} Valor recebido: **${quantidade} moedas**\n` +
                        `${EMOJIS.saldo} Novo saldo do remetente: **${novoSaldo} moedas**`
                    )
                    .setColor("Green");

                await buttonInteraction.update({
                    embeds: [sucesso],
                    components: []
                });

            } catch (erro) {
                if (connection) {
                    try {
                        await connection.rollback();
                    } catch (rollbackErro) {
                        console.error("❌ Erro ao fazer ROLLBACK do PAY:", rollbackErro);
                    }
                }

                console.error("❌ Erro ao aceitar PAY:", erro);

                await buttonInteraction.update({
                    content: `${EMOJIS.erro} Ocorreu um erro ao processar o pagamento.`,
                    embeds: [],
                    components: []
                });

            } finally {
                if (connection) {
                    connection.release();
                }
            }
        });

        collector.on("end", async (_, motivo) => {
            if (motivo !== "accepted") {
                try {
                    const expirado = new EmbedBuilder()
                        .setTitle(`${EMOJIS.relogio} PAGAMENTO EXPIRADO`)
                        .setDescription(
                            `O pedido de pagamento de **${quantidade} moedas** expirou.\n\n` +
                            `Nenhuma moeda foi transferida.`
                        )
                        .setColor("Red");

                    await mensagem.edit({
                        embeds: [expirado],
                        components: []
                    });

                } catch (erro) {
                    console.error("❌ Erro ao expirar PAY:", erro);
                }
            }
        });

    } catch (erro) {
        console.error("❌ Erro no PAY:", erro);

        if (!responder.replied && !responder.deferred) {
            await responder({
                content: `${EMOJIS.erro} Não foi possível criar o pedido de pagamento.`,
                ephemeral: true
            });
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Envie moedas para outro usuário 💸")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá as moedas")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("quantidade")
                .setDescription("Quantidade de moedas")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const destinatario = interaction.options.getUser("usuario");
        const quantidade = interaction.options.getInteger("quantidade");

        await criarPagamento(
            interaction.user.id,
            destinatario,
            quantidade,
            dados => interaction.reply(dados)
        );
    },

    async handlePrefix(message, args) {
        const mencoes = message.mentions.users;

        const destinatario = mencoes.first();

        if (!destinatario) {
            return message.reply(
                `${EMOJIS.erro} Use o formato: \`'pay @usuário quantidade\``
            );
        }

        const quantidadeTexto = args.find(
            arg => /^\d+$/.test(arg)
        );

        const quantidade = quantidadeTexto
            ? Number(quantidadeTexto)
            : NaN;

        await criarPagamento(
            message.author.id,
            destinatario,
            quantidade,
            async dados => {
                const { ephemeral, ...opcoes } = dados;

                return message.reply(opcoes);
            }
        );
    }
};
