const { SlashCommandBuilder } = require("discord.js");
const niveis = require("./niveis.js");
const emojis = require("../emojis.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Veja seu nível, XP e posição no ranking. 📈")
        .addUserOption(opcao =>
            opcao
                .setName("usuario")
                .setDescription("Usuário que você quer ver (padrão: você).")
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const usuario = interaction.options.getUser("usuario") || interaction.user;
            await interaction.editReply(await niveis.respostaDoUsuario(usuario, false));
        } catch (erro) {
            console.error("❌ Erro no comando /rank:", erro);
            await interaction.editReply({
                content: `${emojis.erro} Não foi possível carregar o cartão.`
            });
        }
    },

    async handlePrefix(message) {
        try {
            const usuario = message.mentions.users.first() || message.author;
            await message.reply(await niveis.respostaDoUsuario(usuario, false));
        } catch (erro) {
            console.error("❌ Erro no comando 'rank:", erro);
            await message.reply(`${emojis.erro} Não foi possível carregar o cartão.`);
        }
    }
};
