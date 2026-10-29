const {
    SlashCommandBuilder
} = require("discord.js");

const comandoDarAdm = require("./dar-adm");

// =====================================================
// 😀 EMOJIS
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    sucesso: "<:activ:1528228344263348394>",
    erro: "<:Danger:1536532666101538836>"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("say-adm")
        .setDescription("Envia uma mensagem privada para um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá a mensagem.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("mensagem")
                .setDescription("Mensagem que será enviada.")
                .setRequired(true)
        ),

    async execute(interaction) {
        // 🔐 ADM DO BOT
        if (!comandoDarAdm.isAdmin(interaction.user.id)) {
            return interaction.reply({
                content: `${EMOJIS.erro} Você não é administrador do bot.`,
                ephemeral: true
            });
        }

        const usuario = interaction.options.getUser("usuario");
        const mensagem = interaction.options.getString("mensagem");

        try {
            await usuario.send(mensagem);

            await interaction.reply({
                content: `${EMOJIS.sucesso} Mensagem enviada para ${usuario}.`,
                ephemeral: true
            });

        } catch (erro) {
            console.error("❌ Erro no say-adm:", erro);

            await interaction.reply({
                content:
                    `${EMOJIS.erro} Não consegui enviar a mensagem. ` +
                    "O usuário pode estar com as DMs fechadas.",
                ephemeral: true
            });
        }
    },

    async handlePrefix(message, args) {
        // 🔐 ADM DO BOT
        if (!comandoDarAdm.isAdmin(message.author.id)) {
            return message.reply(
                `${EMOJIS.erro} Você não é administrador do bot.`
            );
        }

        const usuario = message.mentions.users.first();

        if (!usuario) {
            return message.reply(
                `${EMOJIS.erro} Use: \`'say-adm @usuário mensagem\``
            );
        }

        const mensagem = args
            .filter(arg => !arg.startsWith("<@"))
            .join(" ")
            .trim();

        if (!mensagem) {
            return message.reply(
                `${EMOJIS.erro} Você precisa informar a mensagem.\n` +
                "Exemplo: `'say-adm @usuário Olá!`"
            );
        }

        try {
            await usuario.send(mensagem);

            await message.reply(
                `${EMOJIS.sucesso} Mensagem enviada para ${usuario}.`
            );

        } catch (erro) {
            console.error("❌ Erro no say-adm:", erro);

            await message.reply(
                `${EMOJIS.erro} Não consegui enviar a mensagem. ` +
                "O usuário pode estar com as DMs fechadas."
            );
        }
    }
};
