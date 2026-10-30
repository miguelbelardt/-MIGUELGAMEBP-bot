const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

// =====================================================
// 😀 EMOJIS
// =====================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).
// Os outros ficam aqui: para trocar, coloque o código do emoji
// (use /emojiinfo) ou um emoji normal.

const emojis = require("../emojis.js");

const EMOJIS = {
    sucesso: emojis.sucesso,
    erro: emojis.erro
};

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
                content: `${EMOJIS.erro} Você precisa ter a permissão de **Administrador do Discord** para usar este comando.`,
                ephemeral: true
            });
        }

        const mensagem = interaction.options.getString("mensagem");

        await interaction.reply({
            content: `${EMOJIS.sucesso} Mensagem enviada!`,
            ephemeral: true
        });

        await interaction.channel.send(mensagem);
    },

    async handlePrefix(message, args) {

        // 🔐 ADMINISTRADOR DO DISCORD
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(
                `${EMOJIS.erro} Você precisa ter a permissão de **Administrador do Discord** para usar este comando.`
            );
        }

        const mensagem = args.join(" ").trim();

        if (!mensagem) {
            return message.reply(
                `${EMOJIS.erro} Você precisa informar a mensagem.\n` +
                "Exemplo: `'say Olá!`"
            );
        }

        try {
            await message.channel.send(mensagem);

            await message.reply(`${EMOJIS.sucesso} Mensagem enviada!`);

        } catch (erro) {
            console.error("❌ Erro no say:", erro);

            await message.reply(
                `${EMOJIS.erro} Não consegui enviar a mensagem.`
            );
        }
    }
};
