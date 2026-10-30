const {
    SlashCommandBuilder,
    EmbedBuilder
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
// Para trocar, coloque o código do emoji (use /emojiinfo)
// ou um emoji normal.

const EMOJIS = {
    sugestao: "💡",
    sucesso: "<:activ:1528228344263348394>",
    erro: "<:Danger:1536532666101538836>",
    relogio: "<:clock:1542945408865534002>"
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
            .setFooter({
                text: nomeBot()
            });

    try {
        await dono.send({
            content: `${EMOJIS.sugestao} Sugestão de <@${autor.id}>`,
            embeds: [embed],
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
