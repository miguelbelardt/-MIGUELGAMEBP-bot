const {
    SlashCommandBuilder
} = require("discord.js");

const {
    removerXP,
    getXP,
    isAdm
} = require("../database/database.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove-xp")
        .setDescription("Remove XP de um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que perderá o XP.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("quantidade")
                .setDescription("Quantidade de XP que será removida.")
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

            const xpAtual =
                await getXP(usuario.id);

            const quantidadeRemover =
                Math.min(
                    quantidade,
                    xpAtual
                );

            if (quantidadeRemover <= 0) {
                return interaction.reply({
                    content:
                        `❌ ${usuario} não possui XP para remover.`,
                    ephemeral: true
                });
            }

            await removerXP(
                usuario.id,
                quantidadeRemover
            );

            await interaction.reply(
                `⭐ Foram removidos **${quantidadeRemover} XP** de ${usuario}.\n` +
                `📊 XP atual: **${xpAtual - quantidadeRemover} XP**`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando /remove-xp:",
                erro
            );

            await interaction.reply({
                content:
                    "❌ Não foi possível remover o XP.",
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

        const usuario =
            message.mentions.users.first();

        if (!usuario) {
            return message.reply(
                "❌ Você precisa mencionar o usuário.\n" +
                "Exemplo: `mremove-xp @usuário 100`"
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
                "❌ Informe uma quantidade de XP válida.\n" +
                "Exemplo: `mremove-xp @usuário 100`"
            );
        }

        try {

            const xpAtual =
                await getXP(usuario.id);

            const quantidadeRemover =
                Math.min(
                    quantidade,
                    xpAtual
                );

            if (quantidadeRemover <= 0) {
                return message.reply(
                    `❌ ${usuario} não possui XP para remover.`
                );
            }

            await removerXP(
                usuario.id,
                quantidadeRemover
            );

            await message.reply(
                `⭐ Foram removidos **${quantidadeRemover} XP** de ${usuario}.\n` +
                `📊 XP atual: **${xpAtual - quantidadeRemover} XP**`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando mremove-xp:",
                erro
            );

            await message.reply(
                "❌ Não foi possível remover o XP."
            );
        }
    }
};
