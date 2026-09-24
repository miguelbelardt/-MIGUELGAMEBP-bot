const {
    SlashCommandBuilder
} = require("discord.js");

const {
    setarXP,
    getXP,
    isAdm
} = require("../database/database.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setar-xp")
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
                    "❌ Você não tem permissão para usar este comando.",
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
                `⭐ XP de ${usuario} definido com sucesso!\n` +
                `📊 XP anterior: **${xpAnterior} XP**\n` +
                `✨ XP atual: **${quantidade} XP**`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando /setar-xp:",
                erro
            );

            await interaction.reply({
                content:
                    "❌ Não foi possível definir o XP.",
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
                "❌ Você não tem permissão para usar este comando."
            );
        }

        // =================================================
        // 👤 USUÁRIO
        // =================================================

        const usuario =
            message.mentions.users.first();

        if (!usuario) {
            return message.reply(
                "❌ Você precisa mencionar o usuário.\n" +
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
                "❌ Informe uma quantidade de XP válida.\n" +
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
                `⭐ XP de ${usuario} definido com sucesso!\n` +
                `📊 XP anterior: **${xpAnterior} XP**\n` +
                `✨ XP atual: **${quantidade} XP**`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando 'setar-xp':",
                erro
            );

            await message.reply(
                "❌ Não foi possível definir o XP."
            );
        }
    }
};
