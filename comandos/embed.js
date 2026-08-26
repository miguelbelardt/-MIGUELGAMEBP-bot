const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Cria e envia um embed.")
        .addStringOption(option =>
            option
                .setName("titulo")
                .setDescription("Título do embed")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("descricao")
                .setDescription("Descrição do embed")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("cor")
                .setDescription("Cor em hexadecimal, exemplo: #5865F2")
                .setRequired(false)
        ),

    async execute(interaction) {
        const titulo = interaction.options.getString("titulo");
        const descricao = interaction.options.getString("descricao");
        const cor = interaction.options.getString("cor") || "#5865F2";

        // Verifica se a cor é hexadecimal válida
        if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) {
            return interaction.reply({
                content: "❌ Cor inválida! Use o formato `#5865F2`.",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(descricao)
            .setColor(cor)
            .setTimestamp()
            .setFooter({
                text: `Enviado por ${interaction.user.username}`
            });

        await interaction.reply({
            embeds: [embed]
        });
    }
};
