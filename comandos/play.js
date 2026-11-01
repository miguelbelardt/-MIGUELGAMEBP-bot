const {
    SlashCommandBuilder
} = require("discord.js");

const musica = require("../musica.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription(
            "Toca uma música do SoundCloud (nome ou link) ou um link de áudio."
        )
        .addStringOption(option =>
            option
                .setName("musica")
                .setDescription(
                    "Nome da música ou link (SoundCloud ou arquivo de áudio)."
                )
                .setRequired(true)
                .setMaxLength(200)
        ),

    async execute(interaction) {
        return musica.rodarSlash(
            interaction,
            musica.tocar,
            {
                consulta:
                    interaction.options.getString("musica")
            },
            true
        );
    },

    async handlePrefix(message, args = []) {
        return musica.rodarPrefixo(
            message,
            musica.tocar,
            {
                consulta: args.join(" ")
            }
        );
    }
};
