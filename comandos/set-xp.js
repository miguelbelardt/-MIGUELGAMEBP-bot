const {
    SlashCommandBuilder
} = require("discord.js");

const {
    setarXP,
    getXP,
    isAdm
} = require("../database/database.js");

// =====================================================
// 😀 EMOJIS
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    erro: "<:Danger:1536532666101538836>",
    xp: "<:FortniteXP:1528582193717182635>"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("set-xp")
        .setDescription("Define o XP de um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que terá o XP definido.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("quantidade")
                .setDescription("Quantidade exata de XP.")
                .setRequired(true)
                .setMinValue(0)
        ),

    async execute(interaction) {

        // =================================================
        // 👑 VERIFICAR ADM DO BOT
        // =================================================

        const adm = await isAdm(
            interaction.user.id
        );

        if (!adm) {
            return interaction.reply({
                content:
                    `${EMOJIS.erro} Você não tem permissão para usar este comando.`,
                ephemeral: true
            });
        }

        const usuario =
            interaction.options.getUser("usuario");

        const quantidade =
            interaction.options.getInteger("quantidade");

        try {

            const xpAnterior =
                await getXP(usuario.id);

            await setarXP(
                usuario.id,
                quantidade
            );

            await interaction.reply(
                `${EMOJIS.xp} XP de ${usuario} definido com sucesso!\n` +
                `📊 XP anterior: **${xpAnterior} XP**\n` +
                `${EMOJIS.xp} XP atual: **${quantidade} XP**`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando /setar-xp:",
                erro
            );

            await interaction.reply({
                content:
                    `${EMOJIS.erro} Não foi possível definir o XP.`,
                ephemeral: true
            });
        }
    },

    async handlePrefix(message, args) {

        // =================================================
        // 👑 VERIFICAR ADM DO BOT
        // =================================================

        const adm = await isAdm(
            message.author.id
        );

        if (!adm) {
            return message.reply(
                `${EMOJIS.erro} Você não tem permissão para usar este comando.`
            );
        }

        // =================================================
        // 👤 USUÁRIO
        // =================================================

        const usuario =
            message.mentions.users.first();

        if (!usuario) {
            return message.reply(
                `${EMOJIS.erro} Você precisa mencionar o usuário.\n` +
                "Exemplo: `'setar-xp @usuário 100`"
            );
        }

        // =================================================
        // ⭐ QUANTIDADE DE XP
        // =================================================

        const quantidadeTexto =
            args.find(arg => /^\d+$/.test(arg));

        const quantidade =
            Number(quantidadeTexto);

        if (
            !quantidadeTexto ||
            !Number.isInteger(quantidade) ||
            quantidade < 0
        ) {
            return message.reply(
                `${EMOJIS.erro} Informe uma quantidade de XP válida.\n` +
                "Exemplo: `'setar-xp @usuário 100`"
            );
        }

        try {

            const xpAnterior =
                await getXP(usuario.id);

            await setarXP(
                usuario.id,
                quantidade
            );

            await message.reply(
                `${EMOJIS.xp} XP de ${usuario} definido com sucesso!\n` +
                `📊 XP anterior: **${xpAnterior} XP**\n` +
                `${EMOJIS.xp} XP atual: **${quantidade} XP**`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando 'setar-xp':",
                erro
            );

            await message.reply(
                `${EMOJIS.erro} Não foi possível definir o XP.`
            );
        }
    }
};
