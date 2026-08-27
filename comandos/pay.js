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

        // ❌ Não pode pagar para si mesmo
        if (destinatario.id === remetenteId) {
            return interaction.reply({
                content: "❌ Você não pode enviar moedas para si mesmo.",
                ephemeral: true
            });
        }

        // ❌ Não pode pagar bots
        if (destinatario.bot) {
            return interaction.reply({
                content: "❌ Você não pode enviar moedas para um bot.",
                ephemeral: true
            });
        }

        try {
            const saldo = await getSaldo(remetenteId);

            // ❌ Saldo insuficiente
            if (saldo < quantidade) {
                return interaction.reply({
                    content:
                        `❌ Você não tem moedas suficientes.\n` +
                        `💰 Seu saldo: **${saldo} moedas**\n` +
                        `💸 Tentativa: **${quantidade} moedas**`,
                    ephemeral: true
                });
            }

            // 💸 Retira do remetente
            await alterarSaldo(remetenteId, -quantidade);

            // 💰 Adiciona ao destinatário
            await alterarSaldo(destinatario.id, quantidade);

            const embed = new EmbedBuilder()
                .setTitle("💸 PAGAMENTO")
                .setDescription(
                    `💰 ${interaction.user} enviou **${quantidade} moedas** para ${destinatario}!\n\n` +
                    `💳 Seu novo saldo: **${saldo - quantidade} moedas**`
                )
                .setColor("Green");

            await interaction.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("Erro no PAY:", erro);

            await interaction.reply({
                content: "❌ Não foi possível realizar o pagamento.",
                ephemeral: true
            });
        }
    }
};
