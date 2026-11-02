const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function montar(usuario, membro) {
    // Avatar do servidor (se a pessoa tiver um) tem prioridade.
    const doServidor = membro?.avatar ? membro.displayAvatarURL({ size: 1024 }) : null;
    const global = usuario.displayAvatarURL({ size: 1024 });
    const principal = doServidor || global;

    const links = [
        `[PNG](${usuario.displayAvatarURL({ extension: "png", size: 1024 })})`,
        `[WEBP](${usuario.displayAvatarURL({ extension: "webp", size: 1024 })})`
    ];

    let texto = links.join(" • ");

    if (doServidor) texto += `\nAvatar do servidor • [perfil global](${global})`;

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🖼️ Avatar de ${usuario.displayName || usuario.username}`.slice(0, 250))
                .setDescription(texto)
                .setImage(principal)
        ],
        allowedMentions: { parse: [] }
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Mostra o avatar de alguém em tamanho grande. 🖼️")
        .addUserOption(o =>
            o.setName("usuario").setDescription("Usuário (padrão: você).").setRequired(false)
        ),

    async execute(interaction) {
        const usuario = interaction.options.getUser("usuario") || interaction.user;
        const membro = interaction.options.getMember("usuario") || (usuario.id === interaction.user.id ? interaction.member : null);

        return interaction.reply(montar(usuario, membro));
    },

    async handlePrefix(message) {
        const usuario = message.mentions.users.first() || message.author;
        const membro = message.mentions.members?.first() || (usuario.id === message.author.id ? message.member : null);

        return message.reply(montar(usuario, membro));
    }
};
