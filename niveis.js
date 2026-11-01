// =====================================================
// 📈 SISTEMA DE NÍVEIS
// =====================================================
// - Quem conversa ganha XP sozinho (usa o mesmo XP do /xp e /set-xp).
// - O nível é calculado a partir do XP, então não precisa de tabela nova.
// - Desenha os cartões do /rank e do /perfil.
//
// Para ligar: no index.js, logo depois de `criarcall.iniciar(client);`
// coloque:  require("./niveis.js").iniciar(client);

const { Events } = require("discord.js");

const {
    pool,
    getXP,
    adicionarXP
} = require("./database/database.js");

let canvasLib = null;

try {
    canvasLib = require("@napi-rs/canvas");
} catch {
    console.warn(
        "⚠️ @napi-rs/canvas não instalado: /rank e /perfil vão responder sem imagem."
    );
}

// =====================================================
// ⚙️ CONFIGURAÇÕES (pode mexer)
// =====================================================

const PREFIXO = "'";
const XP_MINIMO = 15;          // XP mínimo por mensagem
const XP_MAXIMO = 25;          // XP máximo por mensagem
const INTERVALO_MS = 60 * 1000; // 1 mensagem por minuto conta XP
const XP_BASE = 50;            // dificuldade: XP total do nível N = XP_BASE * N * N
const AVISAR_NIVEL = true;     // avisar no chat quando alguém sobe de nível

const FONTE = "'Inter', 'Noto Sans', 'DejaVu Sans', 'Segoe UI', sans-serif";

// =====================================================
// 🧮 CONTAS DE NÍVEL
// =====================================================

function xpTotalDoNivel(nivel) {
    return XP_BASE * nivel * nivel;
}

function calcularNivel(xp) {
    return Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / XP_BASE));
}

function progresso(xp) {
    const total = Math.max(0, Number(xp) || 0);
    const nivel = calcularNivel(total);
    const inicio = xpTotalDoNivel(nivel);
    const fim = xpTotalDoNivel(nivel + 1);

    return {
        nivel,
        xp: total,
        noNivel: total - inicio,
        faltaParaProximo: fim - total,
        tamanhoDoNivel: fim - inicio,
        porcentagem: Math.min(1, (total - inicio) / (fim - inicio))
    };
}

async function posicaoNoRanking(xp) {
    const resultado = await pool.query(
        "SELECT COUNT(*) AS total FROM usuarios WHERE xp > $1",
        [xp]
    );

    return Number(resultado.rows[0].total) + 1;
}

// =====================================================
// 💬 XP POR MENSAGEM
// =====================================================

const ultimaMensagem = new Map();

function iniciar(client) {
    client.on(Events.MessageCreate, async mensagem => {
        try {
            if (!mensagem.guild || mensagem.author.bot || mensagem.webhookId) return;
            if (mensagem.content.startsWith(PREFIXO)) return;
            if (!mensagem.content && mensagem.attachments.size === 0) return;

            const agora = Date.now();
            const ultima = ultimaMensagem.get(mensagem.author.id) || 0;

            if (agora - ultima < INTERVALO_MS) return;

            ultimaMensagem.set(mensagem.author.id, agora);

            // Evita o mapa crescer para sempre
            if (ultimaMensagem.size > 5000) {
                for (const [id, quando] of ultimaMensagem) {
                    if (agora - quando > INTERVALO_MS) ultimaMensagem.delete(id);
                }
            }

            const ganho =
                XP_MINIMO + Math.floor(Math.random() * (XP_MAXIMO - XP_MINIMO + 1));

            const antes = await getXP(mensagem.author.id);
            await adicionarXP(mensagem.author.id, ganho);

            const nivelAntes = calcularNivel(antes);
            const nivelDepois = calcularNivel(antes + ganho);

            if (AVISAR_NIVEL && nivelDepois > nivelAntes) {
                await mensagem.channel.send({
                    content: `🎉 ${mensagem.author} subiu para o **nível ${nivelDepois}**!`,
                    allowedMentions: { users: [mensagem.author.id] }
                });
            }
        } catch (erro) {
            console.error("❌ Erro no XP por mensagem:", erro);
        }
    });
}

// =====================================================
// 🖼️ CARTÕES
// =====================================================

function formatar(n) {
    return Number(n).toLocaleString("pt-BR");
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
    if (!canvasLib || !urlDoDiscord(url)) return null;

    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), 8000);

    try {
        const resposta = await fetch(url, { signal: controle.signal });
        if (!resposta.ok) return null;

        const buffer = Buffer.from(await resposta.arrayBuffer());
        if (buffer.length > 4 * 1024 * 1024) return null;

        return await canvasLib.loadImage(buffer);
    } catch {
        return null;
    } finally {
        clearTimeout(relogio);
    }
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

function cortarTexto(ctx, texto, largura) {
    let t = String(texto);
    if (ctx.measureText(t).width <= largura) return t;

    while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) {
        t = t.slice(0, -1);
    }

    return `${t}…`;
}

// dados: { nome, avatarUrl, xp, posicao, saldo?, premiumDias? }
// completo = true  -> cartão do /perfil (com moedas e premium)
// completo = false -> cartão do /rank
async function gerarCartao(dados, completo) {
    if (!canvasLib) return null;

    const L = 900;
    const A = completo ? 330 : 260;
    const canvas = canvasLib.createCanvas(L, A);
    const ctx = canvas.getContext("2d");
    const p = progresso(dados.xp);

    // Fundo
    const fundo = ctx.createLinearGradient(0, 0, L, A);
    fundo.addColorStop(0, "#0f2027");
    fundo.addColorStop(1, "#1b3a3a");
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, L, A);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    retanguloArredondado(ctx, 20, 20, L - 40, A - 40, 24);
    ctx.fill();

    // Avatar
    const avatar = await baixarAvatar(dados.avatarUrl);
    const ax = 52, ay = 52, ar = 70;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatar) {
        ctx.drawImage(avatar, ax, ay, ar * 2, ar * 2);
    } else {
        ctx.fillStyle = "#2b2d31";
        ctx.fillRect(ax, ay, ar * 2, ar * 2);
    }

    ctx.restore();

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#1abc9c";
    ctx.beginPath();
    ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2);
    ctx.stroke();

    // Nome
    const x0 = 240;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 38px ${FONTE}`;
    ctx.fillText(cortarTexto(ctx, dados.nome, 400), x0, 98);

    // Posição e nível (direita)
    ctx.textAlign = "right";
    ctx.fillStyle = "#9fb3b3";
    ctx.font = `600 22px ${FONTE}`;
    ctx.fillText("POSIÇÃO", L - 56, 62);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 34px ${FONTE}`;
    ctx.fillText(`#${formatar(dados.posicao)}`, L - 56, 98);
    ctx.textAlign = "left";

    // Nível
    ctx.fillStyle = "#1abc9c";
    ctx.font = `bold 30px ${FONTE}`;
    ctx.fillText(`NÍVEL ${p.nivel}`, x0, 145);

    ctx.fillStyle = "#9fb3b3";
    ctx.font = `500 22px ${FONTE}`;
    ctx.textAlign = "right";
    ctx.fillText(
        `${formatar(p.noNivel)} / ${formatar(p.tamanhoDoNivel)} XP`,
        L - 56,
        145
    );
    ctx.textAlign = "left";

    // Barra de XP
    const bx = x0, by = 165, bl = L - 56 - x0, ba = 30;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    retanguloArredondado(ctx, bx, by, bl, ba, ba / 2);
    ctx.fill();

    const preenchido = Math.max(ba, bl * p.porcentagem);
    const barra = ctx.createLinearGradient(bx, 0, bx + bl, 0);
    barra.addColorStop(0, "#1abc9c");
    barra.addColorStop(1, "#3498db");
    ctx.fillStyle = barra;
    retanguloArredondado(ctx, bx, by, preenchido, ba, ba / 2);
    ctx.fill();

    ctx.fillStyle = "#9fb3b3";
    ctx.font = `500 20px ${FONTE}`;
    ctx.fillText(
        `XP total: ${formatar(p.xp)}  •  faltam ${formatar(p.faltaParaProximo)} para o nível ${p.nivel + 1}`,
        x0,
        by + ba + 32
    );

    // Caixinhas do perfil
    if (completo) {
        const caixas = [
            { titulo: "MOEDAS", valor: formatar(dados.saldo ?? 0) },
            {
                titulo: "PREMIUM",
                valor: dados.premiumDias > 0
                    ? `${dados.premiumDias} dia${dados.premiumDias === 1 ? "" : "s"}`
                    : "Inativo"
            }
        ];

        const largura = (L - 2 * 52 - 20) / 2;

        caixas.forEach((caixa, i) => {
            const cx = 52 + i * (largura + 20);
            const cy = 245;

            ctx.fillStyle = "rgba(255,255,255,0.08)";
            retanguloArredondado(ctx, cx, cy, largura, 60, 14);
            ctx.fill();

            ctx.fillStyle = "#9fb3b3";
            ctx.font = `600 16px ${FONTE}`;
            ctx.fillText(caixa.titulo, cx + 18, cy + 24);

            ctx.fillStyle = "#ffffff";
            ctx.font = `bold 24px ${FONTE}`;
            ctx.fillText(cortarTexto(ctx, caixa.valor, largura - 36), cx + 18, cy + 50);
        });
    }

    return canvas.toBuffer("image/png");
}

// Tira caracteres que a fonte não desenha (viram quadradinho na imagem)
function nomeDesenhavel(nome, reserva) {
    const limpo = String(nome || "")
        .replace(/[^\u0020-\u024F\u0370-\u03FF\u0400-\u04FF\u2010-\u2027]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return limpo || String(reserva || "Usuário");
}

// Monta a resposta pronta (imagem, ou texto se não houver canvas)
async function respostaDoUsuario(usuario, completo) {
    const { AttachmentBuilder } = require("discord.js");
    const xp = await getXP(usuario.id);
    const posicao = await posicaoNoRanking(xp);
    const p = progresso(xp);

    const dados = {
        nome: nomeDesenhavel(usuario.displayName, usuario.username),
        avatarUrl: usuario.displayAvatarURL({ extension: "png", size: 256 }),
        xp,
        posicao
    };

    if (completo) {
        const { getSaldo } = require("./database/database.js");
        const { getPremium } = require("./database/premium.js");

        dados.saldo = await getSaldo(usuario.id);

        const premium = await getPremium(usuario.id);
        dados.premiumDias = premium.ativo
            ? Math.ceil((premium.expiraEm - Date.now()) / 86400000)
            : 0;
    }

    const imagem = await gerarCartao(dados, completo);

    if (imagem) {
        return {
            files: [new AttachmentBuilder(imagem, { name: "cartao.png" })],
            allowedMentions: { parse: [] }
        };
    }

    let texto =
        `**${dados.nome}**\nNível **${p.nivel}** • ${formatar(xp)} XP • posição **#${formatar(posicao)}**`;

    if (completo) {
        texto += `\nMoedas: **${formatar(dados.saldo)}** • Premium: **${dados.premiumDias > 0 ? dados.premiumDias + " dia(s)" : "inativo"}**`;
    }

    return { content: texto, allowedMentions: { parse: [] } };
}

module.exports = {
    iniciar,
    respostaDoUsuario,
    calcularNivel,
    progresso,
    posicaoNoRanking,
    gerarCartao,
    formatar
};
