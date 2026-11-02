const { SlashCommandBuilder } = require("discord.js");
const economia = require("../economia.js");
const casamento = require("../casamento.js");

async function acao({ usuario }) {
    const r = await casamento.divorciar(usuario.id);

    if (r.erro) return { erro: `❌ ${r.erro}` };

    return { resposta: `💔 Você se divorciou de <@${r.exId}>. O anel não volta, infelizmente.` };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("divorciar")
        .setDescription("Termina o seu casamento. 💔"),

    async execute(interaction) {
        return economia.rodarSlash(interaction, acao);
    },

    async handlePrefix(message) {
        return economia.rodarPrefixo(message, acao);
    }
};
