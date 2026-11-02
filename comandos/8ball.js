const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const RESPOSTAS = [
    "Com certeza.", "Sem dúvida nenhuma.", "Pode apostar que sim.", "Tudo indica que sim.",
    "Sim.", "Provavelmente sim.", "As perspectivas são boas.",
    "Pergunte de novo mais tarde.", "Melhor não te contar agora.", "Não consigo prever agora.",
    "Concentre-se e pergunte de novo.", "Não conte com isso.", "Minha resposta é não.",
    "Minhas fontes dizem que não.", "As perspectivas não são boas.", "Muito duvidoso.",
    "Nem pensar.", "Hmm... eu diria que talvez.", "Só se a lua ajudar.", "Claro que não!"
];

function resposta(pergunta) {
    const texto = String(pergunta || "").trim().slice(0, 250);

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x2B2D31)
                .setTitle("🎱 Bola 8 Mágica")
                .addFields(
                    { name: "Pergunta", value: texto || "..." },
                    { name: "Resposta", value: `**${RESPOSTAS[Math.floor(Math.random() * RESPOSTAS.length)]}**` }
                )
        ],
        allowedMentions: { parse: [] }
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Faça uma pergunta para a bola 8 mágica. 🎱")
        .addStringOption(o =>
            o.setName("pergunta").setDescription("Sua pergunta.").setMaxLength(250).setRequired(true)
        ),

    async execute(interaction) {
        return interaction.reply(resposta(interaction.options.getString("pergunta")));
    },

    async handlePrefix(message, args) {
        if (!args.length) {
            return message.reply("🎱 Faça uma pergunta. Ex.: `'8ball vou ficar rico?`");
        }

        return message.reply(resposta(args.join(" ")));
    }
};
