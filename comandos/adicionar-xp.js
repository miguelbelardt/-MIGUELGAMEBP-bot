const {
    SlashCommandBuilder
} = require("discord.js");

const {
    adicionarXP,
    isAdm
} = require("../database/database.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("adicionar-xp")
        .setDescription("Adiciona XP a um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá o XP.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("quantidade")
                .setDescription("Quantidade de XP que será adicionada.")
                .setRequired(true)
                .setMinValue(1)
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

            await adicionarXP(
                usuario.id,
                quantidade
            );

            await interaction.reply(
                `⭐ ${usuario} recebeu **${quantidade} XP**!`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando /adicionar-xp:",
                erro
            );

            await interaction.reply({
                content:
                    "❌ Não foi possível adicionar o XP.",
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
                "Exemplo: `'adicionar-xp @usuário 100`"
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
            quantidade < 1
        ) {
            return message.reply(
                "❌ Informe uma quantidade de XP válida.\n" +
                "Exemplo: `'adicionar-xp @usuário 100`"
            );
        }

        try {

            await adicionarXP(
                usuario.id,
                quantidade
            );

            await message.reply(
                `⭐ ${usuario} recebeu **${quantidade} XP**!`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando 'adicionar-xp':",
                erro
            );

            await message.reply(
                "❌ Não foi possível adicionar o XP."
            );
        }
    }
};
