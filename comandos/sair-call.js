const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getVoiceConnection
} = require("@discordjs/voice");

// COLOQUE AQUI O MESMO ID DO DONO
const DONO_ID = "1124140396516225044";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sair-call")
        .setDescription("Faz o bot sair do canal de voz."),

    async execute(interaction) {
        if (interaction.user.id !== DONO_ID) {
            return interaction.reply({
                content: "❌ Apenas o dono do bot pode usar este comando.",
                ephemeral: true
            });
        }

        const conexao = getVoiceConnection(interaction.guild.id);

        if (!conexao) {
            return interaction.reply({
                content: "❌ Eu não estou em nenhum canal de voz.",
                ephemeral: true
            });
        }

        conexao.destroy();

        const embed = new EmbedBuilder()
            .setTitle("🔇 BOT SAIU DA CALL")
            .setDescription("✅ Saí do canal de voz com sucesso!");

        await interaction.reply({
            embeds: [embed]
        });
    }
};
