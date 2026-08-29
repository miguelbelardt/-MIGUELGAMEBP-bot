const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

const {
    joinVoiceChannel
} = require("@discordjs/voice");

// COLOQUE AQUI O SEU ID DO DISCORD
const DONO_ID = "1124140396516225044";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("entrar-call")
        .setDescription("Faz o bot entrar em um canal de voz.")
        .addChannelOption(option =>
            option
                .setName("canal")
                .setDescription("Canal de voz onde o bot vai entrar.")
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== DONO_ID) {
            return interaction.reply({
                content: "❌ Apenas o dono do bot pode usar este comando.",
                ephemeral: true
            });
        }

        const canal = interaction.options.getChannel("canal");

        try {
            joinVoiceChannel({
                channelId: canal.id,
                guildId: canal.guild.id,
                adapterCreator: canal.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false
            });

            const embed = new EmbedBuilder()
                .setTitle("🔊 BOT NA CALL")
                .setDescription(
                    `✅ Entrei no canal de voz **${canal.name}**!`
                );

            await interaction.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro ao entrar na call:", erro);

            await interaction.reply({
                content: "❌ Não consegui entrar nesse canal de voz.",
                ephemeral: true
            });
        }
    }
};
