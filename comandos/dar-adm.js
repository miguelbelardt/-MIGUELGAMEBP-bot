const {
    SlashCommandBuilder
} = require("discord.js");

const DONO_ID = "1124140396516225044";

// Lista de usuários que são ADM do bot
const adms = new Set();

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
        // 👑 Somente o dono do bot pode alterar ADMs
        if (interaction.user.id !== DONO_ID) {
            return interaction.reply({
                content: "❌ Você não tem permissão para usar este comando.",
                ephemeral: true
            });
        }

        const usuario = interaction.options.getUser("usuario");

        // 👑 O dono sempre continua sendo ADM
        if (usuario.id === DONO_ID) {
            return interaction.reply({
                content: "👑 O dono do bot já possui ADM permanente.",
                ephemeral: true
            });
        }

        // 🔄 Se já for ADM, remove
        if (adms.has(usuario.id)) {
            adms.delete(usuario.id);

            return interaction.reply({
                content: `🔴 ${usuario} perdeu a permissão de **ADM do bot**.`
            });
        }

        // 🟢 Se não for ADM, adiciona
        adms.add(usuario.id);

        return interaction.reply({
            content: `🟢 ${usuario} agora é **ADM do bot**! 👑`
        });
    },

    // 🔐 Verificar se o usuário é ADM do bot
    isAdmin(userId) {
        return userId === DONO_ID || adms.has(userId);
    }
};
