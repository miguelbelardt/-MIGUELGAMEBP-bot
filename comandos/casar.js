const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const casamento = require("../casamento.js");

const TEMPO = 2 * 60 * 1000;

function botoes(id, desativado = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`casar_sim_${id}`)
            .setLabel("Aceitar")
            .setEmoji("💍")
            .setStyle(ButtonStyle.Success)
            .setDisabled(desativado),
        new ButtonBuilder()
            .setCustomId(`casar_nao_${id}`)
            .setLabel("Recusar")
            .setEmoji("💔")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(desativado)
    );
}

async function pedir(proponente, alvo, enviar) {
    const problema = await casamento.validarPedido(proponente, alvo);

    if (problema) return { erro: `❌ ${problema}` };

    const id = Date.now().toString(36);

    const mensagem = await enviar({
        content: `💍 ${alvo}, **${proponente.username}** pediu você em casamento! Você aceita?`,
        components: [botoes(id)],
        allowedMentions: { users: [alvo.id] }
    });

    if (!mensagem || typeof mensagem.createMessageComponentCollector !== "function") return {};

    const coletor = mensagem.createMessageComponentCollector({
        filter: i => i.customId.endsWith(`_${id}`),
        time: TEMPO
    });

    coletor.on("collect", async interacao => {
        try {
            if (interacao.user.id !== alvo.id) {
                await interacao.reply({
                    content: `❌ Só ${alvo.username} pode responder a esse pedido.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            coletor.stop("respondido");

            if (interacao.customId.startsWith("casar_nao_")) {
                await interacao.update({
                    content: `💔 **${alvo.username}** recusou o pedido de **${proponente.username}**.`,
                    components: [],
                    allowedMentions: { parse: [] }
                });
                return;
            }

            const r = await casamento.casar(proponente, alvo);

            if (r.erro) {
                await interacao.update({ content: `❌ ${r.erro}`, components: [], allowedMentions: { parse: [] } });
                return;
            }

            await interacao.update({
                content: `🎉 ${proponente} e ${alvo}`,
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF69B4)
                        .setTitle("💒 Casamento!")
                        .setDescription(
                            `**${proponente.username}** e **${alvo.username}** agora estão casados! 💞\nParabéns ao casal!`
                        )
                ],
                components: [],
                allowedMentions: { users: [proponente.id, alvo.id] }
            });
        } catch (e) {
            console.error("❌ Erro no pedido de casamento:", e);
            await interacao.reply({ content: "❌ Não foi possível concluir o casamento.", flags: MessageFlags.Ephemeral }).catch(() => { });
        }
    });

    coletor.on("end", async (_, motivo) => {
        if (motivo === "respondido") return;

        await mensagem.edit({
            content: `⌛ **${alvo.username}** não respondeu ao pedido a tempo.`,
            components: [botoes(id, true)],
            allowedMentions: { parse: [] }
        }).catch(() => { });
    });

    return {};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("casar")
        .setDescription("Peça alguém em casamento (gasta 1 Anel da loja). 💍")
        .setDMPermission(false)
        .addUserOption(o =>
            o.setName("usuario").setDescription("Com quem você quer casar.").setRequired(true)
        ),

    async execute(interaction) {
        try {
            const r = await pedir(
                interaction.user,
                interaction.options.getUser("usuario"),
                async dados => {
                    await interaction.reply(dados);
                    return interaction.fetchReply();
                }
            );

            if (r.erro) {
                await interaction.reply({ content: r.erro, flags: MessageFlags.Ephemeral });
            }
        } catch (e) {
            console.error("❌ Erro no /casar:", e);
            if (!interaction.replied) {
                await interaction.reply({ content: "❌ Não foi possível fazer o pedido.", flags: MessageFlags.Ephemeral }).catch(() => { });
            }
        }
    },

    async handlePrefix(message) {
        const alvo = message.mentions.users.first();

        if (!alvo) return message.reply("💍 Marque com quem quer casar. Ex.: `'casar @fulano`");

        try {
            const r = await pedir(message.author, alvo, dados => message.reply(dados));

            if (r.erro) await message.reply(r.erro);
        } catch (e) {
            console.error("❌ Erro no 'casar:", e);
            await message.reply("❌ Não foi possível fazer o pedido.").catch(() => { });
        }
    }
};
