const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getVoiceConnection
} = require("@discordjs/voice");

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
            .setColor(0x5865F2)
            .setTitle("🔇 BOT SAIU DA CALL")
            .setDescription("✅ Saí do canal de voz com sucesso!");

        await interaction.reply({
            embeds: [embed]
        });
    },

    async handlePrefix(message) {
        if (message.author.id !== DONO_ID) {
            return message.reply(
                "❌ Apenas o dono do bot pode usar este comando."
            );
        }

        const args = message.content.trim().split(/\s+/);
        const comando = args[1]?.toLowerCase();

        if (comando !== "sair-call") return;

        const conexao = getVoiceConnection(message.guild.id);

        if (!conexao) {
            return message.reply(
                "❌ Eu não estou em nenhum canal de voz."
            );
        }

        try {
            conexao.destroy();

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🔇 BOT SAIU DA CALL")
                .setDescription("✅ Saí do canal de voz com sucesso!");

            await message.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro ao sair da call por prefixo:", erro);

            await message.reply(
                "❌ Não consegui sair do canal de voz."
            );
        }
    }
};
