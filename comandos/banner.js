const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// O banner só vem na busca "completa" do usuário (force: true).
async function montar(client, usuario) {
    let completo;

    try {
        completo = await client.users.fetch(usuario.id, { force: true });
    } catch {
        return { content: "❌ Não consegui buscar o banner agora. Tente de novo em instantes." };
    }

    const nome = completo.displayName || completo.username;
    const url = completo.bannerURL({ size: 1024 });

    if (!url) {
        const cor = completo.hexAccentColor;

        return {
            content:
                `🖼️ **${String(nome).replace(/@/g, "@​")}** não tem banner.` +
                (cor ? ` A cor do perfil é \`${cor}\`.` : ""),
            allowedMentions: { parse: [] }
        };
    }

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(completo.accentColor || 0x5865F2)
                .setTitle(`🖼️ Banner de ${nome}`.slice(0, 250))
                .setDescription(
                    `[PNG](${completo.bannerURL({ extension: "png", size: 1024 })}) • ` +
                    `[WEBP](${completo.bannerURL({ extension: "webp", size: 1024 })})`
                )
                .setImage(url)
        ],
        allowedMentions: { parse: [] }
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("banner")
        .setDescription("Mostra o banner de perfil de alguém. 🖼️")
        .addUserOption(o =>
            o.setName("usuario").setDescription("Usuário (padrão: você).").setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const usuario = interaction.options.getUser("usuario") || interaction.user;

        return interaction.editReply(await montar(interaction.client, usuario));
    },

    async handlePrefix(message) {
        const usuario = message.mentions.users.first() || message.author;

        return message.reply(await montar(message.client, usuario));
    }
};
