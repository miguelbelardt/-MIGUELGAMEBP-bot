const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

const economia = require("../economia.js");

const TEMPO = 5 * 60 * 1000;

function menu(idPainel, desativado = false) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`loja_comprar_${idPainel}`)
            .setPlaceholder("🛒 Comprar 1 unidade de...")
            .setDisabled(desativado)
            .addOptions(
                economia.ITENS.map(item => ({
                    label: item.nome,
                    description: `${item.preco.toLocaleString("pt-BR")} moedas`,
                    value: item.id,
                    emoji: item.emoji
                }))
            )
    );
}

async function abrir(enviar) {
    const idPainel = Date.now().toString(36);

    const mensagem = await enviar({
        embeds: [economia.embedLoja()],
        components: [menu(idPainel)],
        allowedMentions: { parse: [] }
    });

    if (!mensagem || typeof mensagem.createMessageComponentCollector !== "function") return;

    const coletor = mensagem.createMessageComponentCollector({
        filter: i => i.customId === `loja_comprar_${idPainel}`,
        time: TEMPO
    });

    // Cada pessoa compra para si mesma; a resposta é só para ela.
    coletor.on("collect", async interacao => {
        try {
            const resultado = await economia.comprar({
                usuario: interacao.user,
                item: economia.acharItem(interacao.values[0]),
                quantidade: 1
            });

            if (resultado.erro) {
                await interacao.reply({ content: resultado.erro, flags: MessageFlags.Ephemeral });
                return;
            }

            await interacao.reply({ ...resultado.resposta, flags: MessageFlags.Ephemeral });
        } catch (erro) {
            console.error("❌ Erro na compra pela loja:", erro);

            await interacao.reply({
                content: "❌ Não foi possível concluir a compra.",
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
        }
    });

    coletor.on("end", async () => {
        await mensagem.edit({ components: [menu(idPainel, true)] }).catch(() => { });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loja")
        .setDescription("Veja a loja de itens. 🛒"),

    async execute(interaction) {
        await abrir(async dados => {
            await interaction.reply(dados);
            return interaction.fetchReply();
        });
    },

    async handlePrefix(message) {
        await abrir(dados => message.reply(dados));
    }
};
