const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// =====================================================
// 😀 EMOJIS
// =====================================================
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    pedra: "<:rock:1543416296547549227>",
    papel: "<:book:1543415786171928716>",
    tesoura: "<:ScissorsIcon:1543416443981533285>"
};

const opcoes = {
    pedra: {
        nome: "Pedra",
        emoji: EMOJIS.pedra
    },
    papel: {
        nome: "Papel",
        emoji: EMOJIS.papel
    },
    tesoura: {
        nome: "Tesoura",
        emoji: EMOJIS.tesoura
    }
};

function escolherBot() {
    const escolhas = Object.keys(opcoes);

    return escolhas[
        Math.floor(
            Math.random() * escolhas.length
        )
    ];
}

function verificarVencedor(jogador, bot) {
    if (jogador === bot) {
        return "empate";
    }

    if (
        (jogador === "pedra" && bot === "tesoura") ||
        (jogador === "papel" && bot === "pedra") ||
        (jogador === "tesoura" && bot === "papel")
    ) {
        return "jogador";
    }

    return "bot";
}

function criarBotoes() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ppt_pedra")
            .setLabel("Pedra")
            .setEmoji(EMOJIS.pedra)
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("ppt_papel")
            .setLabel("Papel")
            .setEmoji(EMOJIS.papel)
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("ppt_tesoura")
            .setLabel("Tesoura")
            .setEmoji(EMOJIS.tesoura)
            .setStyle(ButtonStyle.Danger)
    );
}

function criarEmbed(jogador, bot, resultado) {
    let titulo;
    let cor;

    if (resultado === "jogador") {
        titulo = "🏆 Você venceu!";
        cor = 0x57F287;
    } else if (resultado === "bot") {
        titulo = "🤖 Eu venci!";
        cor = 0xED4245;
    } else {
        titulo = "🤝 Empate!";
        cor = 0xFEE75C;
    }

    return new EmbedBuilder()
        .setColor(cor)
        .setTitle(`${EMOJIS.pedra} Pedra, Papel e Tesoura`)
        .setDescription(`## ${titulo}`)
        .addFields(
            {
                name: "👤 Você",
                value:
                    `${opcoes[jogador].emoji} ${opcoes[jogador].nome}`,
                inline: true
            },
            {
                name: "🤖 Bot",
                value:
                    `${opcoes[bot].emoji} ${opcoes[bot].nome}`,
                inline: true
            }
        )
        .setFooter({
            text: "Escolha novamente para jogar outra rodada!"
        });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ppt")
        .setDescription(
            "Jogue Pedra, Papel e Tesoura contra o bot!"
        ),

    async execute(interaction) {
        const embed =
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${EMOJIS.pedra}${EMOJIS.papel}${EMOJIS.tesoura} Pedra, Papel e Tesoura`)
                .setDescription(
                    "Escolha uma opção para jogar contra mim!"
                )
                .setFooter({
                    text: "Boa sorte! 😈"
                });

        await interaction.reply({
            embeds: [embed],
            components: [criarBotoes()]
        });
    },

    async handlePrefix(message) {
        const embed =
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${EMOJIS.pedra}${EMOJIS.papel}${EMOJIS.tesoura} Pedra, Papel e Tesoura`)
                .setDescription(
                    "Escolha uma opção para jogar contra mim!"
                )
                .setFooter({
                    text: "Boa sorte! 😈"
                });

        await message.reply({
            embeds: [embed],
            components: [criarBotoes()]
        });
    },

    async handleButton(interaction) {
        if (
            !interaction.customId.startsWith(
                "ppt_"
            )
        ) {
            return;
        }

        const jogador =
            interaction.customId.replace(
                "ppt_",
                ""
            );

        if (!opcoes[jogador]) {
            return;
        }

        const bot = escolherBot();

        const resultado =
            verificarVencedor(
                jogador,
                bot
            );

        const embed =
            criarEmbed(
                jogador,
                bot,
                resultado
            );

        await interaction.update({
            embeds: [embed],
            components: [criarBotoes()]
        });
    }
};
