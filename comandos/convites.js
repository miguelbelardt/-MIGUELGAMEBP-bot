const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const convites = require("../convites.js");

async function montar(guild, usuario) {
    const [stats, links] = await Promise.all([
        convites.estatisticas(guild.id, usuario.id),
        convites.linksAtuais(guild, usuario.id)
    ]);

    const nome = usuario.displayName || usuario.username;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎟️ Convites de ${nome}`.slice(0, 250))
        .setThumbnail(usuario.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: "👥 Pessoas convidadas", value: `**${stats.total}**`, inline: true },
            { name: "✅ Ainda no servidor", value: `**${stats.ativos}**`, inline: true },
            { name: "🚪 Já saíram", value: `**${stats.saidas}**`, inline: true }
        );

    if (stats.posicao) {
        embed.addFields({
            name: "🏆 Posição no servidor",
            value: `**#${stats.posicao}** entre quem mais convidou`,
            inline: false
        });
    }

    if (links) {
        const lista = links.top.length
            ? "\n" + links.top.map(l => `• \`discord.gg/${l.codigo}\` — ${l.usos} uso(s)`).join("\n")
            : "";

        embed.addFields({
            name: "🔗 Links ativos",
            value: links.quantidade
                ? `${links.quantidade} link(s) • ${links.usos} uso(s) no total (contagem do Discord)${lista}`
                : "Nenhum link ativo.",
            inline: false
        });
    }

    embed.setFooter({
        text: "A contagem começa quando o rastreamento foi ligado. Quem sai e volta conta uma vez."
    });

    return { embeds: [embed], allowedMentions: { parse: [] } };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("convites")
        .setDescription("Mostra quantas pessoas você (ou outra pessoa) convidou. 🎟️")
        .addUserOption(o =>
            o.setName("usuario").setDescription("Usuário (padrão: você).").setRequired(false)
        )
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ Esse comando só funciona dentro de um servidor.",
                ephemeral: true
            });
        }

        const usuario = interaction.options.getUser("usuario") || interaction.user;

        await interaction.deferReply();

        return interaction.editReply(await montar(interaction.guild, usuario));
    },

    async handlePrefix(message) {
        if (!message.guild) {
            return message.reply("❌ Esse comando só funciona dentro de um servidor.");
        }

        const usuario = message.mentions.users.first() || message.author;

        return message.reply(await montar(message.guild, usuario));
    }
};
