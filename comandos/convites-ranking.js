const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const convites = require("../convites.js");

const MEDALHAS = ["🥇", "🥈", "🥉"];

async function montar(guild) {
    const top = await convites.ranking(guild.id, 10);

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(`🏆 Quem mais convidou em ${guild.name}`.slice(0, 250));

    if (!top.length) {
        embed.setDescription("Ninguém convidou ninguém ainda. Crie um link de convite e chame seus amigos! 🎟️");
    } else {
        embed.setDescription(
            top
                .map((p, i) =>
                    `${MEDALHAS[i] || `**${i + 1}º**`} <@${p.usuarioId}> — **${p.ativos}** no servidor` +
                    ` • ${p.total} convidado(s) no total`
                )
                .join("\n")
        );
    }

    embed.setFooter({ text: "Ordenado por quem ainda está no servidor. Veja o seu com /convites." });

    return { embeds: [embed], allowedMentions: { parse: [] } };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("convites-ranking")
        .setDescription("Mostra quem mais convidou pessoas para o servidor. 🏆")
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ Esse comando só funciona dentro de um servidor.",
                ephemeral: true
            });
        }

        await interaction.deferReply();

        return interaction.editReply(await montar(interaction.guild));
    },

    async handlePrefix(message) {
        if (!message.guild) {
            return message.reply("❌ Esse comando só funciona dentro de um servidor.");
        }

        return message.reply(await montar(message.guild));
    }
};
