const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("say")
        .setDescription("Faz o bot enviar uma mensagem.")
        .addStringOption(option =>
            option
                .setName("mensagem")
                .setDescription("Mensagem que o bot vai enviar.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        // 🔐 ADMINISTRADOR DO DISCORD
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ Você precisa ter a permissão de **Administrador do Discord** para usar este comando.",
                ephemeral: true
            });
        }

        const mensagem = interaction.options.getString("mensagem");

        await interaction.reply({
            content: "✅ Mensagem enviada!",
            ephemeral: true
        });

        await interaction.channel.send(mensagem);
    },

    async handlePrefix(message, args) {

        // 🔐 ADMINISTRADOR DO DISCORD
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(
                "❌ Você precisa ter a permissão de **Administrador do Discord** para usar este comando."
            );
        }

        const mensagem = args.join(" ").trim();

        if (!mensagem) {
            return message.reply(
                "❌ Você precisa informar a mensagem.\n" +
                "Exemplo: `M say Olá!`"
            );
        }

        try {
            await message.channel.send(mensagem);

            await message.reply("✅ Mensagem enviada!");

        } catch (erro) {
            console.error("❌ Erro no say:", erro);

            await message.reply(
                "❌ Não consegui enviar a mensagem."
            );
        }
    }
};
