const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const musica = require("../musica.js");

const TEMPO = 5 * 60 * 1000;

function botoes(idPainel, desativado = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tocando_pausa_${idPainel}`)
            .setEmoji("⏯️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(desativado),
        new ButtonBuilder()
            .setCustomId(`tocando_pular_${idPainel}`)
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(desativado),
        new ButtonBuilder()
            .setCustomId(`tocando_parar_${idPainel}`)
            .setEmoji("⏹️")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(desativado),
        new ButtonBuilder()
            .setCustomId(`tocando_atualizar_${idPainel}`)
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(desativado)
    );
}

async function abrir(origem, enviar) {
    const contexto = {
        guild: origem.guild,
        membro: origem.member,
        canalTexto: origem.channel
    };

    if (!contexto.guild) return;

    const estado = musica.tocando(contexto);

    if (estado.erro) {
        return enviar({ content: estado.erro, flags: MessageFlags.Ephemeral }, true);
    }

    const idPainel = Date.now().toString(36);

    const mensagem = await enviar({
        ...estado.resposta,
        components: [botoes(idPainel)]
    });

    if (!mensagem || typeof mensagem.createMessageComponentCollector !== "function") return;

    const coletor = mensagem.createMessageComponentCollector({
        filter: i => i.customId.endsWith(`_${idPainel}`),
        time: TEMPO
    });

    coletor.on("collect", async interacao => {
        try {
            const ctx = {
                guild: interacao.guild,
                membro: interacao.member,
                canalTexto: interacao.channel
            };

            const acao = interacao.customId.split("_")[1];
            let resultado = {};

            if (acao === "pausa") {
                resultado = musica.pausar(ctx);
                if (resultado.erro) resultado = musica.retomar(ctx);
            } else if (acao === "pular") {
                resultado = musica.pular(ctx);
            } else if (acao === "parar") {
                resultado = musica.parar(ctx);
            }

            if (resultado.erro) {
                await interacao.reply({
                    content: resultado.erro,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (acao === "parar") {
                coletor.stop("parado");
                await interacao.update({
                    content: resultado.resposta,
                    embeds: [],
                    components: []
                });
                return;
            }

            // Pular troca de música com um pequeno atraso
            if (acao === "pular") {
                await new Promise(r => setTimeout(r, 1500));
            }

            const novo = musica.tocando(ctx);

            if (novo.erro) {
                coletor.stop("vazio");
                await interacao.update({
                    content: novo.erro,
                    embeds: [],
                    components: []
                });
                return;
            }

            await interacao.update({
                ...novo.resposta,
                components: [botoes(idPainel)]
            });
        } catch (erro) {
            console.error("❌ Erro nos botões do /tocando:", erro);
        }
    });

    coletor.on("end", async (_, motivo) => {
        if (motivo === "parado" || motivo === "vazio") return;
        await mensagem.edit({ components: [botoes(idPainel, true)] }).catch(() => { });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tocando")
        .setDescription("Mostra a música que está tocando agora. 🎵"),

    async execute(interaction) {
        await abrir(interaction, async (dados, erro) => {
            await interaction.reply(dados);
            return erro ? null : interaction.fetchReply();
        });
    },

    async handlePrefix(message) {
        await abrir(message, async dados => {
            if (dados.flags) return message.reply(dados.content);
            return message.reply(dados);
        });
    }
};
