// =====================================================
// 🏆 RANKING EM IMAGEM (usado por /moedas-ranking e /xp-ranking)
// =====================================================
// - gerarImagem(): desenha o ranking (avatar, nome, valor).
// - abrirRanking(): manda a imagem com botões (Voltar / Global /
//   Local / Próxima) e cuida dos cliques por 5 minutos.
//
// Sem o @napi-rs/canvas, o ranking sai como texto (embed simples).

const {
    EmbedBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

let canvasLib = null;

try {
    canvasLib = require("@napi-rs/canvas");
} catch {
    console.warn(
        "⚠️ @napi-rs/canvas não instalado: os rankings vão sair sem imagem."
    );
}

const FONTE = "'Inter', 'Noto Sans', 'DejaVu Sans', 'Segoe UI', sans-serif";
const TEMPO_PAINEL = 5 * 60 * 1000;

const MEDALHAS = ["#f1c40f", "#bdc3c7", "#cd7f32"]; // ouro, prata, bronze

// =====================================================
// 🔧 AUXILIARES
// =====================================================

// Tira caracteres que a fonte não desenha (viram quadradinho)
function nomeDesenhavel(nome, reserva) {
    const limpo = String(nome || "")
        .replace(/[^ -ɏͰ-ϿЀ-ӿ‐-‧]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return limpo || String(reserva || "Usuário");
}

function urlDoDiscord(url) {
    try {
        const u = new URL(url);

        return (
            u.protocol === "https:" &&
            /(^|\.)(discordapp\.com|discordapp\.net|discord\.com|discordapp\.media)$/i
                .test(u.hostname)
        );
    } catch {
        return false;
    }
}

async function baixarAvatar(url) {
    if (!canvasLib || !url || !urlDoDiscord(url)) return null;

    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), 6000);

    try {
        const resposta = await fetch(url, { signal: controle.signal });

        if (!resposta.ok) return null;

        const buffer = Buffer.from(await resposta.arrayBuffer());

        if (buffer.length > 2 * 1024 * 1024) return null;

        return await canvasLib.loadImage(buffer);
    } catch {
        return null;
    } finally {
        clearTimeout(relogio);
    }
}

// ids -> Map(id -> { nome, avatarUrl })
async function resolverUsuarios(client, ids) {
    const mapa = new Map();

    await Promise.all(
        [...new Set(ids)].map(async id => {
            let usuario = client.users.cache.get(id);

            if (!usuario) {
                try {
                    usuario = await client.users.fetch(id);
                } catch {
                    usuario = null;
                }
            }

            mapa.set(id, {
                nome: usuario
                    ? nomeDesenhavel(usuario.displayName || usuario.globalName, usuario.username)
                    : "Usuário desconhecido",
                avatarUrl: usuario
                    ? usuario.displayAvatarURL({ extension: "png", size: 64 })
                    : null
            });
        })
    );

    return mapa;
}

function retanguloArredondado(ctx, x, y, l, a, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + l, y, x + l, y + a, r);
    ctx.arcTo(x + l, y + a, x, y + a, r);
    ctx.arcTo(x, y + a, x, y, r);
    ctx.arcTo(x, y, x + l, y, r);
    ctx.closePath();
}

function cortar(ctx, texto, largura) {
    let t = String(texto);

    if (ctx.measureText(t).width <= largura) return t;

    while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) {
        t = t.slice(0, -1);
    }

    return `${t}…`;
}

// =====================================================
// 🖼️ DESENHO
// =====================================================
// dados: {
//   titulo, subtitulo, corDestaque (hex),
//   linhas: [{ posicao, nome, avatarUrl, valor, detalhe? }],
//   voce: { posicao, nome, avatarUrl, valor, detalhe? } | null
// }
async function gerarImagem(dados) {
    if (!canvasLib) return null;

    const L = 900;
    const ALTURA_CABECALHO = 120;
    const ALTURA_LINHA = 66;
    const MARGEM = 26;

    const linhas = dados.linhas;
    const extra = dados.voce ? 1 : 0;

    const A =
        ALTURA_CABECALHO +
        linhas.length * ALTURA_LINHA +
        (extra ? ALTURA_LINHA + 24 : 0) +
        MARGEM;

    const canvas = canvasLib.createCanvas(L, A);
    const ctx = canvas.getContext("2d");
    const destaque = dados.corDestaque || "#1abc9c";

    // Fundo
    const fundo = ctx.createLinearGradient(0, 0, L, A);
    fundo.addColorStop(0, "#14161a");
    fundo.addColorStop(1, "#1d2530");
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, L, A);

    // Cabeçalho
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 40px ${FONTE}`;
    ctx.fillText(dados.titulo, MARGEM + 6, 62);

    ctx.fillStyle = "#9aa4b2";
    ctx.font = `500 22px ${FONTE}`;
    ctx.fillText(dados.subtitulo || "", MARGEM + 6, 96);

    ctx.fillStyle = destaque;
    retanguloArredondado(ctx, MARGEM + 6, 106, 90, 4, 2);
    ctx.fill();

    // Avatares (baixa todos ao mesmo tempo)
    const todas = extra ? [...linhas, dados.voce] : linhas;
    const avatares = await Promise.all(todas.map(l => baixarAvatar(l.avatarUrl)));

    function desenharLinha(linha, avatar, y, ehVoce) {
        const x = MARGEM;
        const l = L - MARGEM * 2;
        const a = ALTURA_LINHA - 8;

        ctx.fillStyle = ehVoce ? "rgba(26,188,156,0.16)" : "rgba(255,255,255,0.05)";
        retanguloArredondado(ctx, x, y, l, a, 14);
        ctx.fill();

        if (ehVoce) {
            ctx.strokeStyle = destaque;
            ctx.lineWidth = 2;
            retanguloArredondado(ctx, x, y, l, a, 14);
            ctx.stroke();
        }

        // Posição (medalha nos 3 primeiros)
        const cx = x + 38;
        const cy = y + a / 2;
        const medalha = linha.posicao >= 1 && linha.posicao <= 3 ? MEDALHAS[linha.posicao - 1] : null;

        if (medalha) {
            ctx.fillStyle = medalha;
            ctx.beginPath();
            ctx.arc(cx, cy, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#1b1b1b";
        } else {
            ctx.fillStyle = "#9aa4b2";
        }

        ctx.textAlign = "center";
        ctx.font = `bold ${linha.posicao > 999 ? 15 : 20}px ${FONTE}`;
        ctx.textBaseline = "middle";
        ctx.fillText(String(linha.posicao), cx, cy + 1);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // Avatar
        const ar = 21;
        const ax = x + 80;

        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, cy, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        if (avatar) {
            ctx.drawImage(avatar, ax, cy - ar, ar * 2, ar * 2);
        } else {
            ctx.fillStyle = "#2b2d31";
            ctx.fillRect(ax, cy - ar, ar * 2, ar * 2);
        }

        ctx.restore();

        // Nome e detalhe
        const nx = ax + ar * 2 + 16;

        ctx.fillStyle = "#ffffff";
        ctx.font = `600 24px ${FONTE}`;
        ctx.fillText(cortar(ctx, linha.nome, 400), nx, linha.detalhe ? cy - 3 : cy + 9);

        if (linha.detalhe) {
            ctx.fillStyle = "#9aa4b2";
            ctx.font = `500 16px ${FONTE}`;
            ctx.fillText(linha.detalhe, nx, cy + 19);
        }

        // Valor
        ctx.textAlign = "right";
        ctx.fillStyle = medalha || destaque;
        ctx.font = `bold 26px ${FONTE}`;
        ctx.fillText(linha.valor, x + l - 22, cy + 9);
        ctx.textAlign = "left";
    }

    linhas.forEach((linha, i) => {
        desenharLinha(linha, avatares[i], ALTURA_CABECALHO + i * ALTURA_LINHA, false);
    });

    if (extra) {
        const y = ALTURA_CABECALHO + linhas.length * ALTURA_LINHA + 24;

        ctx.fillStyle = "#9aa4b2";
        ctx.font = `600 15px ${FONTE}`;
        ctx.fillText("SUA POSIÇÃO", MARGEM + 6, y - 8);

        desenharLinha(dados.voce, avatares[avatares.length - 1], y, true);
    }

    return canvas.toBuffer("image/png");
}

// =====================================================
// 🔘 PAINEL COM BOTÕES
// =====================================================

function botoes(prefixo, userId, tipo, pagina, totalPaginas, desativado = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefixo}_anterior_${userId}`)
            .setLabel("Voltar")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(desativado || pagina <= 1),
        new ButtonBuilder()
            .setCustomId(`${prefixo}_global_${userId}`)
            .setLabel("Global")
            .setEmoji("🌎")
            .setStyle(tipo === "global" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(desativado),
        new ButtonBuilder()
            .setCustomId(`${prefixo}_local_${userId}`)
            .setLabel("Local")
            .setEmoji("🏠")
            .setStyle(tipo === "local" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(desativado),
        new ButtonBuilder()
            .setCustomId(`${prefixo}_proxima_${userId}`)
            .setLabel("Próxima")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(desativado || pagina >= totalPaginas)
    );
}

// Monta o conteúdo (embed + imagem) de uma página do ranking.
async function montarPagina(client, opcoes, tipo, resultado) {
    const ids = resultado.linhas.map(l => l.id);

    if (resultado.voce) ids.push(resultado.voce.id);

    const usuarios = await resolverUsuarios(client, ids);

    const completar = l => ({
        posicao: l.posicao,
        nome: usuarios.get(l.id)?.nome || "Usuário desconhecido",
        avatarUrl: usuarios.get(l.id)?.avatarUrl || null,
        valor: opcoes.formatarValor(l.valor),
        detalhe: opcoes.detalhe ? opcoes.detalhe(l.valor) : null
    });

    const nomeTipo = tipo === "local" ? "LOCAL" : "GLOBAL";

    const imagem = await gerarImagem({
        titulo: opcoes.titulo,
        subtitulo: `Ranking ${nomeTipo}  •  Página ${resultado.pagina} de ${resultado.totalPaginas}  •  ${resultado.total} usuários`,
        corDestaque: opcoes.corDestaque,
        linhas: resultado.linhas.map(completar),
        voce: resultado.voce ? completar(resultado.voce) : null
    });

    const embed = new EmbedBuilder()
        .setColor(opcoes.cor)
        .setFooter({
            text: `Página ${resultado.pagina}/${resultado.totalPaginas} • ${resultado.total} usuários`
        });

    if (!imagem) {
        // Sem canvas: lista em texto
        const texto = resultado.linhas
            .map(l => `**${l.posicao}.** <@${l.id}> — **${opcoes.formatarValor(l.valor)}**`)
            .join("\n");

        embed
            .setTitle(`${opcoes.titulo} (${nomeTipo})`)
            .setDescription(texto || "Ninguém por aqui ainda.");

        return { embeds: [embed], files: [], attachments: [] };
    }

    embed.setImage("attachment://ranking.png");

    return {
        embeds: [embed],
        files: [new AttachmentBuilder(imagem, { name: "ranking.png" })],
        attachments: []
    };
}

// opcoes: {
//   client, userId, tipo, prefixo ("moedas"), titulo, cor, corDestaque,
//   formatarValor(valor), detalhe?(valor),
//   carregar(tipo, pagina) -> { linhas:[{id,posicao,valor}], pagina, totalPaginas, total, voce:{id,posicao,valor}|null },
//   enviar(payload) -> Message
// }
async function abrirRanking(opcoes) {
    const estado = { tipo: opcoes.tipo, pagina: 1, totalPaginas: 1 };

    const primeiro = await opcoes.carregar(estado.tipo, 1);

    if (!primeiro.linhas.length) {
        return { vazio: true };
    }

    estado.pagina = primeiro.pagina;
    estado.totalPaginas = primeiro.totalPaginas;

    const conteudo = await montarPagina(opcoes.client, opcoes, estado.tipo, primeiro);

    const mensagem = await opcoes.enviar({
        ...conteudo,
        components: [
            botoes(opcoes.prefixo, opcoes.userId, estado.tipo, estado.pagina, estado.totalPaginas)
        ]
    });

    if (!mensagem || typeof mensagem.createMessageComponentCollector !== "function") {
        return {};
    }

    const coletor = mensagem.createMessageComponentCollector({ time: TEMPO_PAINEL });

    coletor.on("collect", async botao => {
        if (botao.user.id !== opcoes.userId) {
            await botao.reply({
                content: "❌ Esse ranking pertence a outra pessoa. Abra o seu!",
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
            return;
        }

        try {
            const acao = botao.customId.split("_")[1];

            let tipo = estado.tipo;
            let pagina = estado.pagina;

            if (acao === "anterior") pagina = Math.max(1, pagina - 1);
            else if (acao === "proxima") pagina = Math.min(estado.totalPaginas, pagina + 1);
            else if (acao === "global" || acao === "local") {
                tipo = acao;
                pagina = 1;
            }

            // A imagem demora um pouco: avisa o Discord para esperar.
            await botao.deferUpdate();

            const resultado = await opcoes.carregar(tipo, pagina);

            if (!resultado.linhas.length) {
                await botao.editReply({
                    content: "❌ Ainda não existem usuários nesse ranking.",
                    embeds: [],
                    files: [],
                    attachments: [],
                    components: []
                });
                return;
            }

            estado.tipo = tipo;
            estado.pagina = resultado.pagina;
            estado.totalPaginas = resultado.totalPaginas;

            const novo = await montarPagina(opcoes.client, opcoes, tipo, resultado);

            await botao.editReply({
                content: null,
                ...novo,
                components: [
                    botoes(opcoes.prefixo, opcoes.userId, tipo, estado.pagina, estado.totalPaginas)
                ]
            });
        } catch (erro) {
            console.error("❌ Erro ao atualizar o ranking:", erro);

            await botao.followUp({
                content: "❌ Não foi possível atualizar o ranking.",
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
        }
    });

    coletor.on("end", async () => {
        await mensagem.edit({
            components: [
                botoes(opcoes.prefixo, opcoes.userId, estado.tipo, estado.pagina, estado.totalPaginas, true)
            ]
        }).catch(() => { });
    });

    return {};
}

module.exports = {
    gerarImagem,
    resolverUsuarios,
    abrirRanking,
    nomeDesenhavel
};
