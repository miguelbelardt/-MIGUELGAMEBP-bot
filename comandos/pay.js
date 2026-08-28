const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { pool, getSaldo } = require("../database/database");

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
        const remetenteId = interaction.user.id;
        const destinatario = interaction.options.getUser("usuario");
        const quantidade = interaction.options.getInteger("quantidade");

        if (destinatario.id === remetenteId) {
            return interaction.reply({
                content: "❌ Você não pode enviar moedas para si mesmo.",
                ephemeral: true
            });
        }

        if (destinatario.bot) {
            return interaction.reply({
                content: "❌ Você não pode enviar moedas para um bot.",
                ephemeral: true
            });
        }

        try {
            const saldo = await getSaldo(remetenteId);

            if (saldo < quantidade) {
                return interaction.reply({
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
                    `${interaction.user} quer enviar **${quantidade} moedas** para ${destinatario}.\n\n` +
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

            const mensagem = await interaction.reply({
                embeds: [embed],
                components: [botoes],
                fetchReply: true
            });

            const collector = mensagem.createMessageComponentCollector({
                time: 60 * 60 * 1000
            });

            collector.on("collect", async buttonInteraction => {

                // Somente o destinatário pode aceitar
                if (buttonInteraction.user.id !== destinatario.id) {
                    return buttonInteraction.reply({
                        content: "❌ Apenas o destinatário pode aceitar este pagamento.",
                        ephemeral: true
                    });
                }

                // Evita aceitar duas vezes
                collector.stop("accepted");

                const client = await pool.connect();

                try {
                    await client.query("BEGIN");

                    // Garante que o destinatário exista
                    await client.query(
                        `
                        INSERT INTO usuarios (id, saldo)
                        VALUES ($1, 0)
                        ON CONFLICT (id) DO NOTHING
                        `,
                        [destinatario.id]
                    );

                    // Tenta retirar o dinheiro do remetente.
                    // COALESCE também protege contra saldo NULL.
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

                    // Saldo insuficiente na hora de aceitar
                    if (resultado.rowCount === 0) {
                        await client.query("ROLLBACK");

                        return buttonInteraction.update({
                            content: "❌ O pagamento não pôde ser realizado porque o remetente não possui saldo suficiente.",
                            embeds: [],
                            components: []
                        });
                    }

                    // Adiciona ao destinatário
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
                            `${destinatario} aceitou o pagamento de ${interaction.user}!\n\n` +
                            `💰 Valor recebido: **${quantidade} moedas**\n` +
                            `💳 Novo saldo de ${interaction.user}: **${novoSaldo} moedas**`
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
                        console.error("Erro ao expirar PAY:", erro);
                    }
                }
            });

        } catch (erro) {
            console.error("❌ Erro no PAY:", erro);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Não foi possível criar o pedido de pagamento.",
                    ephemeral: true
                });
            }
        }
    }
};
