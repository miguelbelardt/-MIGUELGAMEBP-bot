const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const DONO_ID = "1124140396516225044";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dar-adm")
        .setDescription("Dá o cargo de administrador para um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá o cargo de administrador")
                .setRequired(true)
        ),

    async execute(interaction) {
        // 👑 Somente o dono do bot pode usar
        if (interaction.user.id !== DONO_ID) {
            return interaction.reply({
                content: "❌ Você não tem permissão para usar este comando.",
                ephemeral: true
            });
        }

        const usuario = interaction.options.getUser("usuario");
        const membro = await interaction.guild.members.fetch(usuario.id);

        // Procura um cargo chamado "Administrador"
        const cargo = interaction.guild.roles.cache.find(
            role => role.name.toLowerCase() === "administrador"
        );

        if (!cargo) {
            return interaction.reply({
                content: "❌ Não encontrei um cargo chamado **Administrador** neste servidor.",
                ephemeral: true
            });
        }

        if (cargo.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({
                content: "❌ Não consigo dar esse cargo porque ele está acima ou no mesmo nível do meu cargo.",
                ephemeral: true
            });
        }

        try {
            await membro.roles.add(cargo);

            await interaction.reply({
                content: `✅ ${usuario} recebeu o cargo **Administrador**! 👑`
            });
        } catch (erro) {
            console.error(erro);

            await interaction.reply({
                content: "❌ Não consegui dar o cargo. Verifique minhas permissões.",
                ephemeral: true
            });
        }
    }
};
