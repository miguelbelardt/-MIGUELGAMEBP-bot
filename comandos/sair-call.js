const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getVoiceConnection
} = require("@discordjs/voice");

const DONO_ID = "1124140396516225044";

// =====================================================
// 😀 EMOJIS
// =====================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).
// Os outros ficam aqui: para trocar, coloque o código do emoji
// (use /emojiinfo) ou um emoji normal.

const emojis = require("../emojis.js");

const EMOJIS = {
    erro: emojis.erro,
    sucesso: emojis.sucesso,
    mudo: "<:muted:1530932265985773598>"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sair-call")
        .setDescription("Faz o bot sair do canal de voz."),

    async execute(interaction) {
        if (interaction.user.id !== DONO_ID) {
            return interaction.reply({
                content: `${EMOJIS.erro} Apenas o dono do bot pode usar este comando.`,
                ephemeral: true
            });
        }

        const conexao = getVoiceConnection(interaction.guild.id);

        if (!conexao) {
            return interaction.reply({
                content: `${EMOJIS.erro} Eu não estou em nenhum canal de voz.`,
                ephemeral: true
            });
        }

        conexao.destroy();

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`${EMOJIS.mudo} BOT SAIU DA CALL`)
            .setDescription(`${EMOJIS.sucesso} Saí do canal de voz com sucesso!`);

        await interaction.reply({
            embeds: [embed]
        });
    },

    async handlePrefix(message) {
        if (message.author.id !== DONO_ID) {
            return message.reply(
                `${EMOJIS.erro} Apenas o dono do bot pode usar este comando.`
            );
        }

        const args = message.content.trim().split(/\s+/);
        const comando = args[1]?.toLowerCase();

        if (comando !== "sair-call") return;

        const conexao = getVoiceConnection(message.guild.id);

        if (!conexao) {
            return message.reply(
                `${EMOJIS.erro} Eu não estou em nenhum canal de voz.`
            );
        }

        try {
            conexao.destroy();

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${EMOJIS.mudo} BOT SAIU DA CALL`)
                .setDescription(`${EMOJIS.sucesso} Saí do canal de voz com sucesso!`);

            await message.reply({
                embeds: [embed]
            });

        } catch (erro) {
            console.error("❌ Erro ao sair da call por prefixo:", erro);

            await message.reply(
                `${EMOJIS.erro} Não consegui sair do canal de voz.`
            );
        }
    }
};
