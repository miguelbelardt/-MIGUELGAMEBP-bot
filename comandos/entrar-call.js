const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

const {
    joinVoiceChannel
} = require("@discordjs/voice");

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
    },

    async handlePrefix(message) {
        if (message.author.id !== DONO_ID) {
            return message.reply(
                "❌ Apenas o dono do bot pode usar este comando."
            );
        }

        const args = message.content.trim().split(/\s+/);
        const comando = args[1]?.toLowerCase();

        if (comando !== "entrar-call") return;

        const canal = message.member?.voice?.channel;

        if (!canal) {
            return message.reply(
                "❌ Você precisa estar em um canal de voz para usar `M entrar-call`."
            );
        }

        if (canal.type !== ChannelType.GuildVoice) {
            return message.reply(
                "❌ Esse canal não é um canal de voz válido."
            );
        }

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

            await message.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro ao entrar na call por prefixo:", erro);

            await message.reply(
                "❌ Não consegui entrar nesse canal de voz."
            );
        }
    }
};
