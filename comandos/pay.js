const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getSaldo,
    alterarSaldo
} = require("../database/database");

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
            const saldoRemetente = await getSaldo(remetenteId);

            if (saldoRemetente < quantidade) {
                return interaction.reply({
                    content:
                        `❌ Saldo insuficiente.\n\n` +
                        `💰 Seu saldo: **${saldoRemetente} moedas**\n` +
                        `💸 Você tentou enviar: **${quantidade} moedas**`,
                    ephemeral: true
                });
            }

            // Retira do remetente
            await alterarSaldo(remetenteId, -quantidade);

            try {
                // Adiciona ao destinatário
                await alterarSaldo(destinatario.id, quantidade);
            } catch (erroDestino) {
                // Se falhar, devolve o dinheiro ao remetente
                await alterarSaldo(remetenteId, quantidade);
                throw erroDestino;
            }

            const novoSaldo = await getSaldo(remetenteId);

            const embed = new EmbedBuilder()
                .setTitle("💸 PAGAMENTO REALIZADO")
                .setDescription(
                    `${interaction.user} enviou **${quantidade} moedas** para ${destinatario}.\n\n` +
                    `💰 Seu novo saldo: **${novoSaldo} moedas**`
                )
                .setColor("Green");

            return interaction.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro no PAY:", erro);

            return interaction.reply({
                content:
                    "❌ Não foi possível realizar o pagamento agora. " +
                    "Tente novamente mais tarde.",
                ephemeral: true
            });
        }
    }
};
