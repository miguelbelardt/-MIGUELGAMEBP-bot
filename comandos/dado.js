const { SlashCommandBuilder } = require("discord.js");

const MAX_DADOS = 10;
const MAX_LADOS = 1000;

function rolar(lados, quantidade) {
    const l = Math.floor(Number(lados));
    const q = Math.floor(Number(quantidade));

    if (!Number.isInteger(l) || l < 2 || l > MAX_LADOS) {
        return `❌ Use de **2** a **${MAX_LADOS}** lados.`;
    }

    if (!Number.isInteger(q) || q < 1 || q > MAX_DADOS) {
        return `❌ Use de **1** a **${MAX_DADOS}** dados.`;
    }

    const resultados = Array.from({ length: q }, () => 1 + Math.floor(Math.random() * l));

    if (q === 1) {
        return `🎲 Você rolou um **d${l}** e tirou **${resultados[0]}**!`;
    }

    const soma = resultados.reduce((a, b) => a + b, 0);

    return `🎲 Você rolou **${q}d${l}**: ${resultados.join(" + ")} = **${soma}**`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dado")
        .setDescription("Rola um ou mais dados. 🎲")
        .addIntegerOption(o =>
            o.setName("lados").setDescription("Lados do dado (padrão: 6).").setMinValue(2).setMaxValue(MAX_LADOS).setRequired(false)
        )
        .addIntegerOption(o =>
            o.setName("quantidade").setDescription("Quantos dados (padrão: 1).").setMinValue(1).setMaxValue(MAX_DADOS).setRequired(false)
        ),

    async execute(interaction) {
        return interaction.reply(
            rolar(
                interaction.options.getInteger("lados") ?? 6,
                interaction.options.getInteger("quantidade") ?? 1
            )
        );
    },

    // 'dado | 'dado 20 | 'dado 20 3 | 'dado 3d20
    async handlePrefix(message, args) {
        let lados = 6;
        let quantidade = 1;

        const formato = /^(\d*)d(\d+)$/i.exec(args[0] || "");

        if (formato) {
            quantidade = formato[1] ? Number(formato[1]) : 1;
            lados = Number(formato[2]);
        } else {
            if (args[0]) lados = Number(args[0]);
            if (args[1]) quantidade = Number(args[1]);
        }

        return message.reply(rolar(lados, quantidade));
    }
};
