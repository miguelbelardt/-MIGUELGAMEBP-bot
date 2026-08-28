const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { pool, getSaldo } = require("../database/database");

async function criarPagamento(remetenteId, destinatario, quantidade, responder) {
    if (!destinatario) {
        return responder({
            content: "❌ Você precisa informar o usuário que receberá as moedas.",
            ephemeral: true
        });
    }

    if (!Number.isInteger(quantidade) || quantidade < 1) {
        return responder({
            content: "❌ A quantidade precisa ser um número inteiro maior que 0.",
            ephemeral: true
        });
    }

    if (destinatario.id === remetenteId) {
        return responder({
            content: "❌ Você não pode enviar moedas para si mesmo.",
            ephemeral: true
        });
    }

    if (destinatario.bot) {
        return responder({
            content: "❌ Você não pode enviar moedas para um bot.",
            ephemeral: true
        });
    }

    try {
        const saldo = await getSaldo(remetenteId);

        if (saldo < quantidade) {
            return responder({
                content:
                    `❌ Você não tem moedas suficientes.\n` +
                    `💰 Seu saldo: **${saldo} moedas**\n` +
                    `💸 Tentativa: **${quantidade} moedas**`,
                ephemeral: true
            });
        }

        const id = `${remetenteId}-${destinatario.id}-${Date.now()}`;

        const embed = new EmbedBuilder()
            .setTitle("💸 PEDIDO DE PAGAMENTO")
            .setDescription(
                `${responder.user} quer enviar **${quantidade} moedas** para ${destinatario}.\n\n` +
                `👤 Destinatário: ${destinatario}\n` +
                `💰 Quantidade: **${quantidade} moedas**\n\n` +
                `⏰ Este pedido expira em **1 hora**.\n` +
                `Apenas o destinatário pode aceitar.`
            )
            .setColor("Yellow");

        const botoes = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`pay_accept_${id}`)
                    .setLabel("Aceitar pagamento")
                    .setEmoji("✅")
                    .setStyle(ButtonStyle.Success)
            );

        const mensagem = await responder({
            embeds: [embed],
            components: [botoes],
            fetchReply: true
        });

        const collector = mensagem.createMessageComponentCollector({
            time: 60 * 60 * 1000
        });

        collector.on("collect", async buttonInteraction => {

            if (buttonInteraction.user.id !== destinatario.id) {
                return buttonInteraction.reply({
                    content: "❌ Apenas o destinatário pode aceitar este pagamento.",
                    ephemeral: true
                });
            }

            collector.stop("accepted");

            const client = await pool.connect();

            try {
                await client.query("BEGIN");

                await client.query(
                    `
                    INSERT INTO usuarios (id, saldo)
                    VALUES ($1, 0)
                    ON CONFLICT (id) DO NOTHING
                    `,
                    [destinatario.id]
                );

                const resultado = await client.query(
                    `
                    UPDATE usuarios
                    SET saldo = COALESCE(saldo, 0) - $1
                    WHERE id = $2
                    AND COALESCE(saldo, 0) >= $1
                    RETURNING saldo
                    `,
                    [quantidade, remetenteId]
                );

                if (resultado.rowCount === 0) {
                    await client.query("ROLLBACK");

                    return buttonInteraction.update({
                        content:
                            "❌ O pagamento não pôde ser realizado porque o remetente não possui saldo suficiente.",
                        embeds: [],
                        components: []
                    });
                }

                await client.query(
                    `
                    UPDATE usuarios
                    SET saldo = COALESCE(saldo, 0) + $1
                    WHERE id = $2
                    `,
                    [quantidade, destinatario.id]
                );

                await client.query("COMMIT");

                const novoSaldo = Number(resultado.rows[0].saldo);

                const sucesso = new EmbedBuilder()
                    .setTitle("✅ PAGAMENTO ACEITO")
                    .setDescription(
                        `${destinatario} aceitou o pagamento de ${responder.user}!\n\n` +
                        `💰 Valor recebido: **${quantidade} moedas**\n` +
                        `💳 Novo saldo de ${responder.user}: **${novoSaldo} moedas**`
                    )
                    .setColor("Green");

                await buttonInteraction.update({
                    embeds: [sucesso],
                    components: []
                });

            } catch (erro) {
                await client.query("ROLLBACK");

                console.error("❌ Erro ao aceitar PAY:", erro);

                await buttonInteraction.update({
                    content: "❌ Ocorreu um erro ao processar o pagamento.",
                    embeds: [],
                    components: []
                });

            } finally {
                client.release();
            }
        });

        collector.on("end", async (_, motivo) => {
            if (motivo !== "accepted") {
                try {
                    const expirado = new EmbedBuilder()
                        .setTitle("⏰ PAGAMENTO EXPIRADO")
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
                content: "❌ Não foi possível criar o pedido de pagamento.",
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
                "❌ Use o formato: `M pay @usuário quantidade`"
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
