const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require("discord.js");
const { nomeBot } = require("../botNome.js");

const COR = 0xFEE75C;

// Tamanho máximo da sugestão (o Discord aceita até 6000 no campo,
// mas 1000 já é bastante para uma sugestão).
const LIMITE_TEXTO = 1000;

// Tempo que a pessoa precisa esperar para mandar outra sugestão
// (evita spam na DM do dono).
const ESPERA_ENTRE_SUGESTOES = 60 * 1000;

const ultimaSugestao = new Map();

// =====================================================
// 😀 EMOJIS DAS SUGESTÕES
// =====================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).
// Os outros ficam aqui: para trocar, coloque o código do emoji
// (use /emojiinfo) ou um emoji normal.

const emojis = require("../emojis.js");

const EMOJIS = {
    sugestao: "💡",
    sucesso: emojis.sucesso,
    erro: emojis.erro,
    relogio: emojis.relogio
};

// =====================================================
// 👑 DESCOBRIR O DONO DO BOT
// =====================================================
// Pega o dono da aplicação direto do Discord. Se for uma
// equipe, usa o dono da equipe. Se preferir fixar um ID,
// crie a variável DONO_ID no .env / Secrets.

async function pegarDono(client) {
    const idFixo =
        String(process.env.DONO_ID || "").trim();

    try {
        if (/^\d{15,25}$/.test(idFixo)) {
            return await client.users.fetch(idFixo);
        }

        const aplicacao =
            await client.application.fetch();

        const dono = aplicacao.owner;

        if (!dono) {
            return null;
        }

        const id =
            dono.members
                ? dono.ownerId
                : dono.id;

        if (!id) {
            return null;
        }

        return await client.users.fetch(id);

    } catch (erro) {
        console.warn(
            "⚠️ /sugestao: não foi possível descobrir o dono do bot:",
            erro?.message || erro
        );

        return null;
    }
}

// =====================================================
// 📨 MONTAR E ENVIAR A SUGESTÃO
// =====================================================

function limparTexto(texto) {
    return String(texto || "")
        .trim()
        .slice(0, LIMITE_TEXTO);
}

async function enviarSugestao(client, autor, guild, canal, texto) {
    const sugestao =
        limparTexto(texto);

    if (!sugestao) {
        return {
            erro: `${EMOJIS.erro} Escreva a sua sugestão. Exemplo: \`/sugestao mensagem:Adicionar um comando de música\``
        };
    }

    const agora = Date.now();
    const ultima = ultimaSugestao.get(autor.id) || 0;
    const falta = ESPERA_ENTRE_SUGESTOES - (agora - ultima);

    if (falta > 0) {
        const liberaEm =
            Math.floor((agora + falta) / 1000);

        return {
            erro: `${EMOJIS.relogio} Calma! Você poderá enviar outra sugestão <t:${liberaEm}:R>.`
        };
    }

    const dono = await pegarDono(client);

    if (!dono) {
        return {
            erro: `${EMOJIS.erro} Não consegui descobrir o dono do bot para enviar a sugestão.`
        };
    }

    const criadoEm =
        Math.floor(agora / 1000);

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(`${EMOJIS.sugestao} Nova sugestão`)
            .setDescription(sugestao)
            .setThumbnail(
                autor.displayAvatarURL({
                    size: 256
                })
            )
            .addFields(
                {
                    name: "👤 Enviada por",
                    value: `<@${autor.id}> (@${autor.username})`,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: `\`${autor.id}\``,
                    inline: true
                },
                {
                    name: "🏰 Servidor",
                    value: guild
                        ? `${guild.name}\n\`${guild.id}\``
                        : "Mensagem direta",
                    inline: true
                },
                {
                    name: `${EMOJIS.relogio} Enviada em`,
                    value: `<t:${criadoEm}:F>\n(<t:${criadoEm}:R>)`,
                    inline: true
                }
            )
            .addFields({
                name: CAMPO_STATUS,
                value: STATUS.nova
            })
            .setFooter({
                text: nomeBot()
            });

    try {
        await dono.send({
            content: `${EMOJIS.sugestao} Sugestão de <@${autor.id}>`,
            embeds: [embed],
            components: criarBotoes(autor.id),
            allowedMentions: {
                parse: []
            }
        });

    } catch (erro) {
        console.error(
            "❌ Erro ao enviar a sugestão para a DM do dono:",
            erro
        );

        return {
            erro: `${EMOJIS.erro} Não consegui entregar a sua sugestão agora. Tente de novo mais tarde.`
        };
    }

    ultimaSugestao.set(autor.id, agora);

    return {
        sucesso: `${EMOJIS.sucesso} Sua sugestão foi enviada para o dono do bot. Obrigado por ajudar! 💡`
    };
}

// =====================================================
// 🔘 BOTÕES DA SUGESTÃO (na DM do dono)
// =====================================================
// Responder: o dono escreve e o bot entrega a resposta para quem sugeriu.
// Marcar como lida / Feito: só mudam o status do embed.
// Tudo fica guardado no próprio embed, então continua funcionando
// mesmo depois de reiniciar o bot.

const CAMPO_STATUS = "📌 Status";
const CAMPO_RESPOSTA = "💬 Sua resposta";

const COR_LIDA = 0x5865F2;
const COR_FEITO = 0x57F287;

const STATUS = {
    nova: "🆕 Nova",
    lida: "👁️ Lida",
    feito: "✅ Feito"
};

function criarBotoes(autorId, estado = "nova") {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sugestao_responder_${autorId}`)
                .setLabel("Responder")
                .setEmoji("💬")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("sugestao_lida")
                .setLabel("Marcar como lida")
                .setEmoji("👁️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(estado !== "nova"),
            new ButtonBuilder()
                .setCustomId("sugestao_feito")
                .setLabel("Feito")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Success)
                .setDisabled(estado === "feito")
        )
    ];
}

// Descobre o estado atual pelo campo de status do embed
function estadoDoEmbed(embed) {
    const valor = embed?.fields?.find(f => f.name === CAMPO_STATUS)?.value || "";

    if (valor.startsWith("✅")) return "feito";
    if (valor.startsWith("👁️")) return "lida";

    return "nova";
}

// Troca (ou cria) um campo do embed pelo nome
function definirCampo(embedBuilder, nome, valor) {
    const campos = [...(embedBuilder.data.fields || [])];
    const i = campos.findIndex(f => f.name === nome);

    if (i >= 0) {
        campos[i] = { ...campos[i], value: valor };
    } else {
        campos.push({ name: nome, value: valor, inline: false });
    }

    embedBuilder.setFields(campos);
}

async function ehDono(interaction) {
    const dono = await pegarDono(interaction.client);

    return Boolean(dono && dono.id === interaction.user.id);
}

async function mudarStatus(interaction, estado) {
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const agora = Math.floor(Date.now() / 1000);

    definirCampo(embed, CAMPO_STATUS, `${STATUS[estado]} em <t:${agora}:f>`);
    embed.setColor(estado === "feito" ? COR_FEITO : COR_LIDA);

    return interaction.update({
        embeds: [embed],
        components: criarBotoes(interaction.customId.split("_")[2] || idDoAutor(interaction.message), estado)
    });
}

// O ID de quem sugeriu fica no botão "Responder" (e também no campo "ID" do embed)
function idDoAutor(mensagem) {
    const botao = mensagem.components?.[0]?.components?.find(c =>
        String(c.customId || c.data?.customId || "").startsWith("sugestao_responder_")
    );

    const doBotao = String(botao?.customId || botao?.data?.customId || "").split("_")[2];

    if (/^\d{15,25}$/.test(doBotao || "")) return doBotao;

    const campo = mensagem.embeds?.[0]?.fields?.find(f => f.name === "🆔 ID")?.value || "";

    return campo.replace(/\D/g, "") || "0";
}

async function tratarInteracao(interaction) {
    const id = interaction.customId || "";

    if (!id.startsWith("sugestao_")) return false;

    if (!(await ehDono(interaction))) {
        await interaction.reply({
            content: `${EMOJIS.erro} Só o dono do bot pode usar esses botões.`,
            flags: MessageFlags.Ephemeral
        }).catch(() => { });

        return true;
    }

    // ----- botões -----
    if (interaction.isButton()) {
        if (id === "sugestao_lida") {
            if (estadoDoEmbed(interaction.message.embeds[0]) !== "nova") {
                return interaction.deferUpdate().catch(() => { }), true;
            }

            await mudarStatus(interaction, "lida");

            return true;
        }

        if (id === "sugestao_feito") {
            const original = interaction.message.embeds[0];
            const autorId = idDoAutor(interaction.message);

            // Avisa quem sugeriu (se a DM estiver fechada, só marca como feito mesmo)
            let avisou = true;

            try {
                const autor = await interaction.client.users.fetch(autorId);

                await autor.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(COR_FEITO)
                            .setTitle(`${EMOJIS.sucesso} Sua sugestão foi feita!`)
                            .setDescription("Obrigado por ajudar a melhorar o bot! 💡")
                            .addFields({
                                name: "Sua sugestão",
                                value: String(original?.description || "—").slice(0, 1000)
                            })
                            .setFooter({ text: nomeBot() })
                    ]
                });
            } catch {
                avisou = false;
            }

            await mudarStatus(interaction, "feito");

            if (!avisou) {
                await interaction.followUp({
                    content: `${EMOJIS.erro} Marquei como feito, mas não consegui avisar a pessoa: ela está com as DMs fechadas (ou não divide servidor com o bot).`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => { });
            }

            return true;
        }

        if (id.startsWith("sugestao_responder_")) {
            const autorId = id.split("_")[2];

            const modal = new ModalBuilder()
                .setCustomId(`sugestao_modal_${autorId}`)
                .setTitle("Responder à sugestão")
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("resposta")
                            .setLabel("Sua resposta (vai por DM para quem sugeriu)")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                            .setMaxLength(1000)
                    )
                );

            await interaction.showModal(modal);

            return true;
        }

        return true;
    }

    // ----- resposta enviada pelo modal -----
    if (interaction.isModalSubmit() && id.startsWith("sugestao_modal_")) {
        const autorId = id.split("_")[2];
        const resposta = interaction.fields.getTextInputValue("resposta").trim();

        if (!resposta) {
            await interaction.reply({
                content: `${EMOJIS.erro} Escreva a resposta.`,
                flags: MessageFlags.Ephemeral
            });

            return true;
        }

        const original = interaction.message?.embeds?.[0];
        const textoOriginal = String(original?.description || "").slice(0, 1000);

        let autor = null;

        try {
            autor = await interaction.client.users.fetch(autorId);

            await autor.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(COR)
                        .setTitle(`${EMOJIS.sugestao} Resposta à sua sugestão`)
                        .setDescription(resposta)
                        .addFields({
                            name: "Sua sugestão",
                            value: textoOriginal || "—"
                        })
                        .setFooter({ text: nomeBot() })
                ]
            });
        } catch {
            await interaction.reply({
                content: `${EMOJIS.erro} Não consegui mandar a resposta: ${autor ? `**${autor.username}**` : "essa pessoa"} está com as DMs fechadas (ou não divide servidor com o bot).`,
                flags: MessageFlags.Ephemeral
            }).catch(() => { });

            return true;
        }

        // Atualiza o embed da DM do dono: guarda a resposta e marca como lida
        if (interaction.isFromMessage() && original) {
            const embed = EmbedBuilder.from(original);
            const agora = Math.floor(Date.now() / 1000);
            let estado = estadoDoEmbed(original);

            if (estado === "nova") {
                estado = "lida";
                definirCampo(embed, CAMPO_STATUS, `${STATUS.lida} em <t:${agora}:f>`);
                embed.setColor(COR_LIDA);
            }

            definirCampo(embed, CAMPO_RESPOSTA, `${resposta.slice(0, 900)}\n*(enviada <t:${agora}:R>)*`);

            await interaction.update({
                embeds: [embed],
                components: criarBotoes(autorId, estado)
            });
        } else {
            await interaction.reply({
                content: `${EMOJIS.sucesso} Resposta enviada.`,
                flags: MessageFlags.Ephemeral
            });
        }

        return true;
    }

    return true;
}

// =====================================================
// 💡 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sugestao")
        .setDescription(
            "Envie uma sugestão para o dono do bot. 💡"
        )
        .addStringOption(option =>
            option
                .setName("mensagem")
                .setDescription("Escreva a sua sugestão.")
                .setRequired(true)
                .setMaxLength(LIMITE_TEXTO)
        ),

    pegarDono,
    enviarSugestao,
    tratarInteracao,

    async execute(interaction) {
        try {
            await interaction.deferReply({
                ephemeral: true
            });

            const resultado =
                await enviarSugestao(
                    interaction.client,
                    interaction.user,
                    interaction.guild,
                    interaction.channel,
                    interaction.options.getString("mensagem")
                );

            await interaction.editReply({
                content: resultado.erro || resultado.sucesso
            });

        } catch (erro) {
            console.error(
                "❌ Erro no comando /sugestao:",
                erro
            );

            const aviso = {
                content: `${EMOJIS.erro} Não foi possível enviar a sua sugestão.`
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(aviso).catch(() => { });
            } else {
                await interaction.reply({
                    ...aviso,
                    ephemeral: true
                }).catch(() => { });
            }
        }
    },

    async handlePrefix(message, args = []) {
        try {
            const resultado =
                await enviarSugestao(
                    message.client,
                    message.author,
                    message.guild,
                    message.channel,
                    args.join(" ")
                );

            await message.reply(
                resultado.erro || resultado.sucesso
            );

        } catch (erro) {
            console.error(
                "❌ Erro no comando sugestao por prefixo:",
                erro
            );

            await message.reply(
                `${EMOJIS.erro} Não foi possível enviar a sua sugestão.`
            ).catch(() => { });
        }
    }
};
