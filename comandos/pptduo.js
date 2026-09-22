const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder
} = require("discord.js");

const desafios = new Map();

function criarBotoesJogada(id) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pptduo_pedra_${id}`)
            .setLabel("Pedra")
            .setEmoji("🪨")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId(`pptduo_papel_${id}`)
            .setLabel("Papel")
            .setEmoji("📄")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`pptduo_tesoura_${id}`)
            .setLabel("Tesoura")
            .setEmoji("✂️")
            .setStyle(ButtonStyle.Danger)
    );
}

function descobrirVencedor(jogada1, jogada2) {
    if (jogada1 === jogada2) {
        return "empate";
    }

    if (
        (jogada1 === "pedra" && jogada2 === "tesoura") ||
        (jogada1 === "papel" && jogada2 === "pedra") ||
        (jogada1 === "tesoura" && jogada2 === "papel")
    ) {
        return "jogador1";
    }

    return "jogador2";
}

function emojiJogada(jogada) {
    if (jogada === "pedra") return "🪨";
    if (jogada === "papel") return "📄";
    if (jogada === "tesoura") return "✂️";
    return "❓";
}

function extrairDadosBotao(customId) {
    const prefixo = "pptduo_";
    const restante = customId.slice(prefixo.length);

    const separador = restante.indexOf("_");

    if (separador === -1) {
        return null;
    }

    const jogada = restante.slice(0, separador);
    const id = restante.slice(separador + 1);

    return {
        jogada,
        id
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pptduo")
        .setDescription(
            "Desafia outro jogador para uma partida de Pedra, Papel e Tesoura."
        ),

    async execute(interaction) {
        const menu = new UserSelectMenuBuilder()
            .setCustomId("pptduo_escolher_usuario")
            .setPlaceholder("👤 Escolha o jogador que você quer desafiar")
            .setMinValues(1)
            .setMaxValues(1);

        const row = new ActionRowBuilder()
            .addComponents(menu);

        await interaction.reply({
            content:
                "🎮 **PPT Duo**\n\n" +
                "👤 Escolha o jogador que você quer desafiar:",
            components: [row],
            ephemeral: true
        });
    },

    async handleSelect(interaction) {
        if (interaction.customId !== "pptduo_escolher_usuario") {
            return;
        }

        const adversarioId = interaction.values[0];

        if (adversarioId === interaction.user.id) {
            return interaction.reply({
                content:
                    "❌ Você não pode desafiar você mesmo!",
                ephemeral: true
            });
        }

        const id = `${interaction.user.id}_${adversarioId}_${Date.now()}`;

        const desafio = {
            id,
            jogador1: interaction.user.id,
            jogador2: adversarioId,
            jogador1Jogada: null,
            jogador2Jogada: null,
            guildId: interaction.guildId,
            canalId: interaction.channelId,
            mensagemId: null
        };

        desafios.set(id, desafio);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🎮 PPT Duo")
            .setDescription(
                `<@${interaction.user.id}> desafiou <@${adversarioId}> para uma partida de **Pedra, Papel e Tesoura!**`
            )
            .addFields(
                {
                    name: "🎯 Desafiante",
                    value: `<@${interaction.user.id}>`,
                    inline: true
                },
                {
                    name: "👤 Desafiado",
                    value: `<@${adversarioId}>`,
                    inline: true
                }
            )
            .setFooter({
                text: "O desafiante precisa escolher sua jogada primeiro."
            });

        await interaction.update({
            content: "🎯 **Agora escolha sua jogada:**",
            components: [
                criarBotoesJogada(id)
            ]
        });

        const mensagem = await interaction.channel.send({
            content: `<@${adversarioId}>`,
            embeds: [embed]
        });

        desafio.mensagemId = mensagem.id;
    },

    async handleButton(interaction) {
        if (!interaction.customId.startsWith("pptduo_")) {
            return;
        }

        const dados = extrairDadosBotao(interaction.customId);

        if (!dados) {
            return;
        }

        const { jogada, id } = dados;

        if (
            jogada !== "pedra" &&
            jogada !== "papel" &&
            jogada !== "tesoura"
        ) {
            return;
        }

        const desafio = desafios.get(id);

        if (!desafio) {
            return interaction.reply({
                content:
                    "❌ Esse desafio não existe mais ou expirou.",
                ephemeral: true
            });
        }

        if (
            interaction.user.id !== desafio.jogador1 &&
            interaction.user.id !== desafio.jogador2
        ) {
            return interaction.reply({
                content:
                    "❌ Você não faz parte desse desafio.",
                ephemeral: true
            });
        }

        // JOGADOR 1
        if (interaction.user.id === desafio.jogador1) {
            if (desafio.jogador1Jogada) {
                return interaction.reply({
                    content:
                        "⚠️ Você já escolheu sua jogada!",
                    ephemeral: true
                });
            }

            desafio.jogador1Jogada = jogada;

            await interaction.reply({
                content:
                    `✅ Você escolheu ${emojiJogada(jogada)} **${jogada}**!\n\n` +
                    "⏳ Agora aguarde o outro jogador.",
                ephemeral: true
            });

            // Libera os botões para o jogador 2 na mensagem pública
            if (desafio.mensagemId && desafio.canalId) {
                const canal = await interaction.client.channels
                    .fetch(desafio.canalId)
                    .catch(() => null);

                if (canal) {
                    const mensagem = await canal.messages
                        .fetch(desafio.mensagemId)
                        .catch(() => null);

                    if (mensagem) {
                        const embed = new EmbedBuilder()
                            .setColor(0x5865F2)
                            .setTitle("🎮 PPT Duo")
                            .setDescription(
                                `<@${desafio.jogador1}> escolheu sua jogada!\n\n` +
                                `👉 <@${desafio.jogador2}>, agora é sua vez!`
                            )
                            .addFields(
                                {
                                    name: "🎯 Desafiante",
                                    value: `<@${desafio.jogador1}>\n✅ Jogada escolhida`,
                                    inline: true
                                },
                                {
                                    name: "👤 Desafiado",
                                    value: `<@${desafio.jogador2}>\n⏳ Escolha sua jogada`,
                                    inline: true
                                }
                            )
                            .setFooter({
                                text: "Somente o jogador desafiado pode escolher agora."
                            });

                        await mensagem.edit({
                            content: `<@${desafio.jogador2}>`,
                            embeds: [embed],
                            components: [
                                criarBotoesJogada(id)
                            ]
                        });
                    }
                }
            }

            return;
        }

        // JOGADOR 2
        if (interaction.user.id === desafio.jogador2) {
            if (!desafio.jogador1Jogada) {
                return interaction.reply({
                    content:
                        "⏳ O desafiante ainda não escolheu a jogada.",
                    ephemeral: true
                });
            }

            if (desafio.jogador2Jogada) {
                return interaction.reply({
                    content:
                        "⚠️ Você já escolheu sua jogada!",
                    ephemeral: true
                });
            }

            desafio.jogador2Jogada = jogada;

            await interaction.reply({
                content:
                    `✅ Você escolheu ${emojiJogada(jogada)} **${jogada}**!`,
                ephemeral: true
            });
        }

        if (
            !desafio.jogador1Jogada ||
            !desafio.jogador2Jogada
        ) {
            return;
        }

        const resultado = descobrirVencedor(
            desafio.jogador1Jogada,
            desafio.jogador2Jogada
        );

        let titulo;
        let descricao;

        if (resultado === "empate") {
            titulo = "🤝 Empate!";
            descricao =
                "Os dois jogadores escolheram a mesma coisa!";
        } else if (resultado === "jogador1") {
            titulo = "🏆 Temos um vencedor!";
            descricao =
                `<@${desafio.jogador1}> venceu a partida!`;
        } else {
            titulo = "🏆 Temos um vencedor!";
            descricao =
                `<@${desafio.jogador2}> venceu a partida!`;
        }

        const embed = new EmbedBuilder()
            .setColor(
                resultado === "empate"
                    ? 0xFEE75C
                    : 0x57F287
            )
            .setTitle(titulo)
            .setDescription(descricao)
            .addFields(
                {
                    name: "🎮 Jogador 1",
                    value:
                        `<@${desafio.jogador1}>\n` +
                        `${emojiJogada(desafio.jogador1Jogada)} ${desafio.jogador1Jogada}`,
                    inline: true
                },
                {
                    name: "🎮 Jogador 2",
                    value:
                        `<@${desafio.jogador2}>\n` +
                        `${emojiJogada(desafio.jogador2Jogada)} ${desafio.jogador2Jogada}`,
                    inline: true
                }
            )
            .setFooter({
                text: "🎮 PPT Duo"
            });

        const canal = await interaction.client.channels
            .fetch(desafio.canalId)
            .catch(() => null);

        if (canal) {
            if (desafio.mensagemId) {
                const mensagem = await canal.messages
                    .fetch(desafio.mensagemId)
                    .catch(() => null);

                if (mensagem) {
                    await mensagem.edit({
                        content: null,
                        embeds: [embed],
                        components: []
                    });
                } else {
                    await canal.send({
                        embeds: [embed]
                    });
                }
            } else {
                await canal.send({
                    embeds: [embed]
                });
            }
        }

        desafios.delete(id);
    }
};
