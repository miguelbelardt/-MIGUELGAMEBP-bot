const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    isAdm
} = require("../database/database.js");

const {
    darPremium,
    DIAS_PREMIUM
} = require("../database/premium.js");

const COR = 0xFEE75C;

const DIAS_MAXIMO = 3650;

// =====================================================
// 😀 EMOJIS DO PREMIUM
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    premium: "💎",
    relogio: "<:clock:1542945408865534002>",
    erro: "<:Danger:1536532666101538836>"
};

// =====================================================
// 🎁 DAR O PREMIUM
// =====================================================

async function entregar(autorId, usuario, dias) {
    if (!(await isAdm(autorId))) {
        return {
            erro: `${EMOJIS.erro} Você não tem permissão para usar este comando.`
        };
    }

    if (!usuario) {
        return {
            erro: `${EMOJIS.erro} Você precisa informar o usuário que receberá o premium.`
        };
    }

    if (usuario.bot) {
        return {
            erro: `${EMOJIS.erro} Bots não podem ter premium.`
        };
    }

    if (
        !Number.isInteger(dias) ||
        dias < 1 ||
        dias > DIAS_MAXIMO
    ) {
        return {
            erro: `${EMOJIS.erro} Os dias precisam ser um número inteiro entre 1 e ${DIAS_MAXIMO}.`
        };
    }

    const expiraEm =
        await darPremium(
            usuario.id,
            dias
        );

    const segundos =
        Math.floor(expiraEm / 1000);

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(`${EMOJIS.premium} PREMIUM ENTREGUE`)
            .setDescription(
                `${usuario} recebeu **${dias} dias** de premium!\n\n` +
                `${EMOJIS.relogio} Expira <t:${segundos}:R>.\n` +
                `<t:${segundos}:F>`
            )
            .setFooter({
                text: "Se já tinha premium, os dias foram somados."
            });

    return { embed };
}

// =====================================================
// 💎 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dar-premium")
        .setDescription("Dá dias de premium a um usuário. 💎")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá o premium.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("dias")
                .setDescription(
                    `Quantos dias (padrão: ${DIAS_PREMIUM}).`
                )
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(DIAS_MAXIMO)
        ),

    async execute(interaction) {
        try {
            const dias =
                interaction.options.getInteger("dias") ??
                DIAS_PREMIUM;

            const resultado =
                await entregar(
                    interaction.user.id,
                    interaction.options.getUser("usuario"),
                    dias
                );

            if (resultado.erro) {
                return interaction.reply({
                    content: resultado.erro,
                    ephemeral: true
                });
            }

            await interaction.reply({
                embeds: [resultado.embed]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando /dar-premium:",
                erro
            );

            const aviso = {
                content: `${EMOJIS.erro} Não foi possível dar o premium.`,
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(aviso).catch(() => { });
            } else {
                await interaction.reply(aviso).catch(() => { });
            }
        }
    },

    async handlePrefix(message, args = []) {
        try {
            const usuario =
                message.mentions.users.first();

            const diasTexto =
                args.find(arg => /^\d+$/.test(arg));

            const dias =
                diasTexto
                    ? Number(diasTexto)
                    : DIAS_PREMIUM;

            const resultado =
                await entregar(
                    message.author.id,
                    usuario,
                    dias
                );

            if (resultado.erro) {
                return message.reply(resultado.erro);
            }

            await message.reply({
                embeds: [resultado.embed]
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando dar-premium por prefixo:",
                erro
            );

            await message.reply(
                `${EMOJIS.erro} Não foi possível dar o premium. Exemplo: \`'dar-premium @usuário 30\``
            ).catch(() => { });
        }
    }
};
