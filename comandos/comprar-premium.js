const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    getPremium,
    comprarPremium,
    PRECO_PREMIUM,
    DIAS_PREMIUM
} = require("../database/premium.js");

const {
    getSaldo
} = require("../database/database.js");

const COR = 0xFEE75C;

const TEMPO_CONFIRMACAO = 60 * 1000;

// =====================================================
// 😀 EMOJIS DO PREMIUM
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    premium: "<a:diamante:1561210993772855356>",
    moedas: "<:Coin:1528228277913784340>",
    saldo: "<:cash:1542933882452578415>",
    relogio: "<:clock:1542945408865534002>",
    sucesso: "<:activ:1528228344263348394>",
    erro: "<:Danger:1536532666101538836>"
};

function formatar(numero) {
    return Number(numero).toLocaleString("pt-BR");
}

function criarBotoes(desativados = false) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("premium_confirmar")
                .setLabel(`Comprar por ${formatar(PRECO_PREMIUM)} moedas`)
                .setEmoji(EMOJIS.moedas)
                .setStyle(ButtonStyle.Success)
                .setDisabled(desativados),

            new ButtonBuilder()
                .setCustomId("premium_cancelar")
                .setLabel("Cancelar")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(desativados)
        );
}

// =====================================================
// 🛒 FLUXO DE COMPRA
// =====================================================
// `enviar` manda a primeira mensagem (slash ou prefixo) e
// devolve a mensagem criada, para podermos esperar o clique.

async function iniciar(usuario, enviar) {
    const [premium, saldo] =
        await Promise.all([
            getPremium(usuario.id),
            getSaldo(usuario.id)
        ]);

    let situacao =
        `${EMOJIS.premium} Você ainda não tem premium.`;

    if (premium.ativo) {
        const segundos =
            Math.floor(premium.expiraEm / 1000);

        situacao =
            `${EMOJIS.premium} Seu premium está ativo até <t:${segundos}:F> (<t:${segundos}:R>).\n` +
            `Comprar de novo soma mais **${DIAS_PREMIUM} dias**.`;
    }

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(`${EMOJIS.premium} COMPRAR PREMIUM`)
            .setDescription(
                `${situacao}\n\n` +
                `${EMOJIS.relogio} Duração: **${DIAS_PREMIUM} dias**\n` +
                `${EMOJIS.moedas} Preço: **${formatar(PRECO_PREMIUM)} moedas**\n` +
                `${EMOJIS.saldo} Seu saldo: **${formatar(saldo)} moedas**`
            )
            .setFooter({
                text: "Clique em comprar para confirmar. Este pedido expira em 1 minuto."
            });

    const mensagem =
        await enviar({
            embeds: [embed],
            components: [criarBotoes()]
        });

    const coletor =
        mensagem.createMessageComponentCollector({
            time: TEMPO_CONFIRMACAO
        });

    coletor.on("collect", async botao => {
        if (botao.user.id !== usuario.id) {
            return botao.reply({
                content: `${EMOJIS.erro} Apenas quem pediu pode usar estes botões.`,
                ephemeral: true
            });
        }

        coletor.stop("respondido");

        if (botao.customId === "premium_cancelar") {
            return botao.update({
                content: "Compra cancelada.",
                embeds: [],
                components: []
            });
        }

        try {
            const resultado =
                await comprarPremium(usuario.id);

            if (!resultado.ok) {
                const atual =
                    await getSaldo(usuario.id);

                return botao.update({
                    content:
                        `${EMOJIS.erro} Você não tem moedas suficientes.\n` +
                        `${EMOJIS.moedas} Preço: **${formatar(PRECO_PREMIUM)} moedas**\n` +
                        `${EMOJIS.saldo} Seu saldo: **${formatar(atual)} moedas**`,
                    embeds: [],
                    components: []
                });
            }

            const segundos =
                Math.floor(resultado.expiraEm / 1000);

            const sucesso =
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(`${EMOJIS.sucesso} PREMIUM ATIVADO`)
                    .setDescription(
                        `${usuario}, obrigado pela compra! ${EMOJIS.premium}\n\n` +
                        `${EMOJIS.relogio} Seu premium vai até <t:${segundos}:F> (<t:${segundos}:R>).\n` +
                        `${EMOJIS.saldo} Novo saldo: **${formatar(resultado.saldoNovo)} moedas**`
                    );

            await botao.update({
                content: "",
                embeds: [sucesso],
                components: []
            });

        } catch (erro) {
            console.error(
                "❌ Erro ao comprar premium:",
                erro
            );

            await botao.update({
                content: `${EMOJIS.erro} Não foi possível concluir a compra. Nenhuma moeda foi cobrada.`,
                embeds: [],
                components: []
            }).catch(() => { });
        }
    });

    coletor.on("end", async (_, motivo) => {
        if (motivo === "respondido") {
            return;
        }

        try {
            await mensagem.edit({
                components: [criarBotoes(true)]
            });
        } catch (erro) {
            // mensagem apagada ou sem permissão: ignora
        }
    });
}

// =====================================================
// 🛒 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("premium")
        .setDescription(
            `Compre ${DIAS_PREMIUM} dias de premium com moedas. 💎`
        ),

    async execute(interaction) {
        try {
            await iniciar(
                interaction.user,
                dados =>
                    interaction.reply({
                        ...dados,
                        fetchReply: true
                    })
            );

        } catch (erro) {
            console.error(
                "❌ Erro no comando /premium:",
                erro
            );

            const aviso = {
                content: `${EMOJIS.erro} Não foi possível abrir a compra do premium.`,
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(aviso).catch(() => { });
            } else {
                await interaction.reply(aviso).catch(() => { });
            }
        }
    },

    async handlePrefix(message) {
        try {
            await iniciar(
                message.author,
                dados => message.reply(dados)
            );

        } catch (erro) {
            console.error(
                "❌ Erro no comando premium por prefixo:",
                erro
            );

            await message.reply(
                `${EMOJIS.erro} Não foi possível abrir a compra do premium.`
            ).catch(() => { });
        }
    }
};
