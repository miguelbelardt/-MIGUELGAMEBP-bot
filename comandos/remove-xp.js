const {
    SlashCommandBuilder
} = require("discord.js");

const {
    removerXP,
    getXP,
    isAdm
} = require("../database/database.js");

// =====================================================
// 😀 EMOJIS
// =====================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).
// Os outros ficam aqui: para trocar, coloque o código do emoji
// (use /emojiinfo) ou um emoji normal.

const emojis = require("../emojis.js");

const EMOJIS = {
    erro: emojis.erro,
    xp: emojis.xp
};

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
                    `${EMOJIS.erro} Você não tem permissão para usar este comando.`,
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
                        `${EMOJIS.erro} ${usuario} não possui XP para remover.`,
                    ephemeral: true
                });
            }

            await removerXP(
                usuario.id,
                quantidadeRemover
            );

            await interaction.reply(
                `${EMOJIS.xp} Foram removidos **${quantidadeRemover} XP** de ${usuario}.\n` +
                `📊 XP atual: **${xpAtual - quantidadeRemover} XP**`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando /remove-xp:",
                erro
            );

            await interaction.reply({
                content:
                    `${EMOJIS.erro} Não foi possível remover o XP.`,
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

        const usuario =
            message.mentions.users.first();

        if (!usuario) {
            return message.reply(
                `${EMOJIS.erro} Você precisa mencionar o usuário.\n` +
                "Exemplo: `'remove-xp @usuário 100`"
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
                `${EMOJIS.erro} Informe uma quantidade de XP válida.\n` +
                "Exemplo: `'remove-xp @usuário 100`"
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
                    `${EMOJIS.erro} ${usuario} não possui XP para remover.`
                );
            }

            await removerXP(
                usuario.id,
                quantidadeRemover
            );

            await message.reply(
                `${EMOJIS.xp} Foram removidos **${quantidadeRemover} XP** de ${usuario}.\n` +
                `📊 XP atual: **${xpAtual - quantidadeRemover} XP**`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no comando remove-xp por prefixo:",
                erro
            );

            await message.reply(
                `${EMOJIS.erro} Não foi possível remover o XP.`
            );
        }
    }
};
