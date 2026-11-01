const { SlashCommandBuilder } = require("discord.js");
const economia = require("../economia.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("comprar")
        .setDescription("Compra um item da loja. 🛒")
        .addStringOption(o =>
            o.setName("item")
                .setDescription("Item da loja.")
                .setRequired(true)
                .addChoices(...economia.ITENS.map(i => ({ name: i.nome, value: i.id })))
        )
        .addIntegerOption(o =>
            o.setName("quantidade")
                .setDescription("Quantidade (padrão: 1).")
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)
        ),

    async execute(interaction) {
        return economia.rodarSlash(interaction, economia.comprar, {
            item: interaction.options.getString("item"),
            quantidade: interaction.options.getInteger("quantidade") ?? 1
        });
    },

    // 'comprar poção de xp 3
    async handlePrefix(message, args) {
        const partes = [...args];
        let quantidade = 1;

        if (partes.length > 1 && /^\d+$/.test(partes[partes.length - 1])) {
            quantidade = Number(partes.pop());
        }

        return economia.rodarPrefixo(message, economia.comprar, {
            item: partes.join(" "),
            quantidade
        });
    }
};
