const {
    SlashCommandBuilder
} = require("discord.js");

const {
    adicionarAdm,
    removerAdm,
    isAdm
} = require("../database/database.js");

const DONO_ID = "1124140396516225044";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dar-adm")
        .setDescription("Dá ou remove a permissão de ADM do bot.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá ou perderá a permissão de ADM")
                .setRequired(true)
        ),

    async execute(interaction) {
        // 👑 Somente o dono pode alterar ADMs
        if (interaction.user.id !== DONO_ID) {
            return interaction.reply({
                content: "❌ Você não tem permissão para usar este comando.",
                ephemeral: true
            });
        }

        const usuario = interaction.options.getUser("usuario");

        // 👑 O dono sempre possui ADM
        if (usuario.id === DONO_ID) {
            return interaction.reply({
                content: "👑 O dono do bot já possui ADM permanente.",
                ephemeral: true
            });
        }

        try {
            // 🔎 Verifica no banco se já é ADM
            const jaEhAdm = await isAdm(usuario.id);

            // 🔴 Se já for ADM, remove
            if (jaEhAdm) {
                await removerAdm(usuario.id);

                return interaction.reply({
                    content: `🔴 ${usuario} perdeu a permissão de **ADM do bot**.`
                });
            }

            // 🟢 Se não for ADM, adiciona
            await adicionarAdm(usuario.id);

            return interaction.reply({
                content: `🟢 ${usuario} agora é **ADM do bot**! 👑`
            });

        } catch (erro) {
            console.error("❌ Erro ao alterar ADM:", erro);

            return interaction.reply({
                content: "❌ Ocorreu um erro ao alterar a permissão de ADM.",
                ephemeral: true
            });
        }
    },

    // 🔐 Verificar se o usuário é ADM do bot
    async isAdmin(userId) {
        if (userId === DONO_ID) return true;

        return await isAdm(userId);
    }
};
