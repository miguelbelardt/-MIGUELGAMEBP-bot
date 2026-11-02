const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const utilidade = require("../utilidade.js");

const NUMEROS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
const PADRAO_MS = 60 * 60 * 1000;
const MAX_MS = 24 * 60 * 60 * 1000;

function limpar(t) {
    return String(t).replace(/@/g, "@​");
}

function embed(pergunta, opcoes, votos, autor, fimEm, encerrada) {
    const total = votos.size;
    const contagem = opcoes.map((_, i) => [...votos.values()].filter(v => v === i).length);

    const linhas = opcoes.map((texto, i) => {
        const pct = total ? Math.round((contagem[i] / total) * 100) : 0;
        const cheio = Math.round(pct / 10);
        return `${NUMEROS[i]} **${limpar(texto)}**\n${"▓".repeat(cheio)}${"░".repeat(10 - cheio)} ${pct}% (${contagem[i]})`;
    });

    return new EmbedBuilder()
        .setColor(encerrada ? 0x747F8D : 0x5865F2)
        .setTitle(`📊 ${limpar(pergunta)}`.slice(0, 250))
        .setDescription(linhas.join("\n\n"))
        .setFooter({
            text: `${total} voto${total === 1 ? "" : "s"} • por ${autor}${encerrada ? " • encerrada" : ""}`
        })
        .setTimestamp(encerrada ? null : fimEm);
}

function botoes(idEnquete, opcoes, desativado) {
    return [
        new ActionRowBuilder().addComponents(
            opcoes.map((texto, i) =>
                new ButtonBuilder()
                    .setCustomId(`enquete_${i}_${idEnquete}`)
                    .setLabel(limpar(texto).slice(0, 70))
                    .setEmoji(NUMEROS[i])
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(desativado)
            )
        )
    ];
}

async function abrir({ pergunta, textoOpcoes, duracao, autor, enviar }) {
    const opcoes = String(textoOpcoes || "")
        .split(/[;|]/)
        .map(o => o.trim())
        .filter(Boolean);

    if (opcoes.length < 2 || opcoes.length > 5) {
        return { erro: "❌ Informe de **2 a 5** opções separadas por `;`. Ex.: `Pizza; Hambúrguer; Sushi`" };
    }

    if (opcoes.some(o => o.length > 70)) {
        return { erro: "❌ Cada opção pode ter no máximo 70 caracteres." };
    }

    let ms = PADRAO_MS;

    if (duracao) {
        ms = utilidade.lerTempo(duracao);

        if (!ms || ms < 30 * 1000 || ms > MAX_MS) {
            return { erro: "❌ Duração inválida. Use de `30s` até `24h`. Ex.: `30m`, `2h`." };
        }
    }

    const fimEm = new Date(Date.now() + ms);
    const votos = new Map(); // userId -> índice da opção
    const idEnquete = Date.now().toString(36);

    const mensagem = await enviar({
        embeds: [embed(pergunta, opcoes, votos, autor, fimEm, false)],
        components: botoes(idEnquete, opcoes, false),
        allowedMentions: { parse: [] }
    });

    if (!mensagem || typeof mensagem.createMessageComponentCollector !== "function") return {};

    const coletor = mensagem.createMessageComponentCollector({
        filter: i => i.customId.endsWith(`_${idEnquete}`),
        time: ms
    });

    coletor.on("collect", async interacao => {
        try {
            const indice = Number(interacao.customId.split("_")[1]);
            const antes = votos.get(interacao.user.id);

            if (antes === indice) {
                votos.delete(interacao.user.id); // clicar de novo tira o voto
            } else {
                votos.set(interacao.user.id, indice);
            }

            await interacao.update({
                embeds: [embed(pergunta, opcoes, votos, autor, fimEm, false)]
            });
        } catch (e) {
            console.error("❌ Erro na enquete:", e);
            await interacao.reply({ content: "❌ Não consegui registrar o voto.", flags: MessageFlags.Ephemeral }).catch(() => { });
        }
    });

    coletor.on("end", async () => {
        await mensagem.edit({
            embeds: [embed(pergunta, opcoes, votos, autor, fimEm, true)],
            components: botoes(idEnquete, opcoes, true)
        }).catch(() => { });
    });

    return {};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("enquete")
        .setDescription("Cria uma votação com botões. 📊")
        .setDMPermission(false)
        .addStringOption(o =>
            o.setName("pergunta").setDescription("A pergunta da enquete.").setMaxLength(200).setRequired(true)
        )
        .addStringOption(o =>
            o.setName("opcoes").setDescription("De 2 a 5 opções separadas por ; (ex.: Sim; Não; Talvez)").setMaxLength(350).setRequired(true)
        )
        .addStringOption(o =>
            o.setName("duracao").setDescription("Quanto tempo fica aberta (30s a 24h). Padrão: 1h.").setRequired(false)
        ),

    async execute(interaction) {
        const r = await abrir({
            pergunta: interaction.options.getString("pergunta"),
            textoOpcoes: interaction.options.getString("opcoes"),
            duracao: interaction.options.getString("duracao"),
            autor: interaction.user.username,
            enviar: async dados => {
                await interaction.reply(dados);
                return interaction.fetchReply();
            }
        });

        if (r.erro) {
            return interaction.reply({ content: r.erro, flags: MessageFlags.Ephemeral });
        }
    },

    // 'enquete Qual comida? ; Pizza ; Sushi ; Hambúrguer
    async handlePrefix(message, args) {
        const partes = args.join(" ").split(/[;|]/);
        const pergunta = (partes.shift() || "").trim();

        if (!pergunta) {
            return message.reply("📊 Use: `'enquete Qual comida? ; Pizza ; Sushi`");
        }

        const r = await abrir({
            pergunta,
            textoOpcoes: partes.join(";"),
            duracao: null,
            autor: message.author.username,
            enviar: dados => message.reply(dados)
        });

        if (r.erro) return message.reply(r.erro);
    }
};
