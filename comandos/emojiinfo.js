const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const { nomeBot } = require("../botNome.js");

const COR = 0xFEE75C;

// =====================================================
// 🕐 DATA DE CRIAÇÃO (vem dentro do ID)
// =====================================================

function dataDoId(id) {
    try {
        return Number(
            (BigInt(id) >> 22n) + 1420070400000n
        );
    } catch (erro) {
        return null;
    }
}

// =====================================================
// 🔎 DESCOBRIR QUAL EMOJI A PESSOA ESCREVEU
// =====================================================
// Aceita:
//   <:nome:ID> ou <a:nome:ID>   (emoji personalizado)
//   somente o ID
//   :nome: ou nome              (emoji que o bot enxerga)
//   😀                          (emoji normal)

function urlDoEmoji(id, animado, tamanho = 512) {
    return `https://cdn.discordapp.com/emojis/${id}.${animado ? "gif" : "png"}?size=${tamanho}`;
}

function procurarEmoji(texto, client, guild) {
    const valor = String(texto || "").trim();

    if (!valor) {
        return { erro: "vazio" };
    }

    // 1) <:nome:123> ou <a:nome:123>
    const completo =
        /<(a?):(\w{2,32}):(\d{15,25})>/.exec(valor);

    if (completo) {
        const conhecido =
            client.emojis.cache.get(completo[3]) || null;

        return {
            tipo: "personalizado",
            id: completo[3],
            nome: completo[2],
            animado: completo[1] === "a",
            conhecido
        };
    }

    // 2) só o ID
    if (/^\d{15,25}$/.test(valor)) {
        const conhecido =
            client.emojis.cache.get(valor) || null;

        if (conhecido) {
            return {
                tipo: "personalizado",
                id: conhecido.id,
                nome: conhecido.name,
                animado: Boolean(conhecido.animated),
                conhecido
            };
        }

        return {
            tipo: "personalizado",
            id: valor,
            nome: null,
            animado: null,
            conhecido: null
        };
    }

    // 3) emoji normal (Unicode)
    if (
        /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u.test(valor) &&
        [...valor].length <= 30
    ) {
        return {
            tipo: "padrao",
            texto: valor
        };
    }

    // 4) pelo nome: :nome: ou nome
    const nome =
        valor.replace(/^:+|:+$/g, "").toLowerCase();

    if (/^\w{2,32}$/.test(nome)) {
        const igual = e =>
            e.name && e.name.toLowerCase() === nome;

        const conhecido =
            (guild && guild.emojis.cache.find(igual)) ||
            client.emojis.cache.find(igual) ||
            null;

        if (conhecido) {
            return {
                tipo: "personalizado",
                id: conhecido.id,
                nome: conhecido.name,
                animado: Boolean(conhecido.animated),
                conhecido
            };
        }

        return { erro: "nome-nao-encontrado" };
    }

    return { erro: "nao-reconhecido" };
}

// =====================================================
// 😀 EMBED: EMOJI PERSONALIZADO
// =====================================================

async function criarRespostaPersonalizado(info, guild) {
    const { id, nome, animado, conhecido } = info;

    const urlImagem = urlDoEmoji(id, animado, 512);
    const urlGrande = urlDoEmoji(id, animado, 1024);

    const criadoMs = dataDoId(id);

    const doMesmoServidor =
        Boolean(
            conhecido &&
            conhecido.guild &&
            guild &&
            conhecido.guild.id === guild.id
        );

    let tipo = "Não sei (não conheço esse emoji)";

    if (animado === true) tipo = "Animado";
    if (animado === false) tipo = "Estático";

    let servidor = "Não sei (o bot não está nesse servidor)";

    if (conhecido && conhecido.guild) {
        servidor = doMesmoServidor
            ? conhecido.guild.name
            : "Outro servidor (que o bot também está)";
    }

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(`😀 Emoji: ${nome || "desconhecido"}`)
            .setThumbnail(urlImagem)
            .addFields(
                {
                    name: "🏷️ Nome",
                    value: nome || "desconhecido",
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: `\`${id}\``,
                    inline: true
                },
                {
                    name: "🎞️ Tipo",
                    value: tipo,
                    inline: true
                }
            )
            .setFooter({
                text: nomeBot()
            });

    if (criadoMs) {
        const criado = Math.floor(criadoMs / 1000);

        embed.addFields({
            name: "📅 Criado em",
            value: `<t:${criado}:D>\n(<t:${criado}:R>)`,
            inline: true
        });
    }

    embed.addFields({
        name: "🏰 Servidor",
        value: servidor,
        inline: true
    });

    if (nome) {
        const codigo =
            `<${animado ? "a" : ""}:${nome}:${id}>`;

        embed.addFields({
            name: "🧾 Código (para copiar)",
            value: `\`${codigo}\``
        });
    }

    if (doMesmoServidor) {
        try {
            const autor = await conhecido.fetchAuthor();

            if (autor) {
                embed.addFields({
                    name: "👤 Adicionado por",
                    value: `${autor}`,
                    inline: true
                });
            }
        } catch (erro) {
            // sem permissão para ver quem adicionou: ignora
        }

        if (
            conhecido.roles &&
            conhecido.roles.cache &&
            conhecido.roles.cache.size > 0
        ) {
            const cargos =
                [...conhecido.roles.cache.values()]
                    .map(r => `<@&${r.id}>`)
                    .join(" ")
                    .slice(0, 1000);

            embed.addFields({
                name: "🔒 Restrito aos cargos",
                value: cargos,
                inline: true
            });
        }
    }

    if (conhecido && conhecido.available === false) {
        embed.addFields({
            name: "⚠️ Disponibilidade",
            value: "Indisponível no momento (o servidor perdeu impulsos).",
            inline: true
        });
    }

    if (animado === null) {
        embed.setDescription(
            "Não conheço esse emoji, então não sei se é animado. " +
            `Se for, use o link de GIF: ${urlDoEmoji(id, true, 1024)}`
        );
    }

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("Abrir imagem")
                        .setEmoji("🖼️")
                        .setStyle(ButtonStyle.Link)
                        .setURL(urlGrande)
                )
        ]
    };
}

// =====================================================
// 😀 EMBED: EMOJI NORMAL (UNICODE)
// =====================================================

function criarRespostaPadrao(info) {
    const caracteres = [...info.texto];

    const codigos =
        caracteres
            .slice(0, 20)
            .map(c =>
                "U+" +
                c.codePointAt(0)
                    .toString(16)
                    .toUpperCase()
                    .padStart(4, "0")
            )
            .join(" ");

    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle("😀 Emoji padrão")
            .setDescription(`# ${info.texto}`)
            .addFields(
                {
                    name: "🔤 Para copiar",
                    value: `\`${info.texto}\``,
                    inline: true
                },
                {
                    name: "🔢 Caracteres",
                    value: String(caracteres.length),
                    inline: true
                },
                {
                    name: "🧬 Códigos Unicode",
                    value:
                        codigos +
                        (caracteres.length > 20 ? " ..." : "")
                }
            )
            .setFooter({
                text: nomeBot()
            });

    return { embeds: [embed] };
}

// =====================================================
// 💬 MONTAR RESPOSTA
// =====================================================

const MENSAGENS_ERRO = {
    vazio:
        "❌ Escreva um emoji. Exemplos: `:fogo:`, `<:nome:123456789012345678>` ou 😀",
    "nome-nao-encontrado":
        "❌ Não encontrei nenhum emoji com esse nome. Tente colar o emoji direto ou o ID dele.",
    "nao-reconhecido":
        "❌ Não reconheci esse emoji. Cole o emoji, o ID ou o nome dele."
};

async function responder(texto, client, guild) {
    const info = procurarEmoji(texto, client, guild);

    if (info.erro) {
        return {
            conteudo: MENSAGENS_ERRO[info.erro],
            erro: true
        };
    }

    if (info.tipo === "padrao") {
        return { resposta: criarRespostaPadrao(info) };
    }

    return {
        resposta:
            await criarRespostaPersonalizado(info, guild)
    };
}

// =====================================================
// 😀 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("emojiinfo")
        .setDescription(
            "Veja as informações de um emoji. 😀"
        )
        .addStringOption(option =>
            option
                .setName("emoji")
                .setDescription(
                    "O emoji, o ID ou o nome dele (ex.: :fogo:)."
                )
                .setRequired(true)
        ),

    procurarEmoji,
    dataDoId,

    async execute(interaction) {
        try {
            const resultado =
                await responder(
                    interaction.options.getString("emoji"),
                    interaction.client,
                    interaction.guild
                );

            if (resultado.erro) {
                return interaction.reply({
                    content: resultado.conteudo,
                    ephemeral: true
                });
            }

            await interaction.reply(resultado.resposta);

        } catch (erro) {
            console.error(
                "❌ Erro no comando /emojiinfo:",
                erro
            );

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Não foi possível mostrar as informações do emoji.",
                    ephemeral: true
                }).catch(() => { });
            }
        }
    },

    async handlePrefix(message, args = []) {
        try {
            const resultado =
                await responder(
                    args.join(" "),
                    message.client,
                    message.guild
                );

            if (resultado.erro) {
                return message.reply(resultado.conteudo);
            }

            await message.reply(resultado.resposta);

        } catch (erro) {
            console.error(
                "❌ Erro no comando emojiinfo por prefixo:",
                erro
            );

            await message.reply(
                "❌ Não foi possível mostrar as informações do emoji."
            ).catch(() => { });
        }
    }
};
