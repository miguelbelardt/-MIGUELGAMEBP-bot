const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const {
    adicionarXP
} = require("../database/database.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add-xp")
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
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return interaction.reply({
                content:
                    "❌ Você precisa ter a permissão de **Administrador** para usar este comando.",
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
                "❌ Erro no comando /add-xp:",
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
        if (
            !message.member?.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return message.reply(
                "❌ Você precisa ter a permissão de **Administrador** para usar este comando."
            );
        }

        const usuario =
            message.mentions.users.first();

        if (!usuario) {
            return message.reply(
                "❌ Você precisa mencionar o usuário.\nExemplo: `madd-xp @usuário 100`"
            );
        }

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
                "❌ Informe uma quantidade de XP válida.\nExemplo: `madd-xp @usuário 100`"
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
                "❌ Erro no comando madd-xp:",
                erro
            );

            await message.reply(
                "❌ Não foi possível adicionar o XP."
            );
        }
    }
};
