const {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder
} = require("discord.js");

const crypto = require("crypto");

// =====================================================
// 🖼️ BIBLIOTECA DE IMAGEM (OPCIONAL)
// =====================================================
// Se o @napi-rs/canvas não estiver instalado, o bot NÃO cai:
// o /ship continua funcionando, só que sem a imagem.

let canvasLib = null;

try {
    canvasLib = require("@napi-rs/canvas");
} catch (erro) {
    console.log(
        "⚠️ /ship: @napi-rs/canvas não instalado. O comando vai funcionar sem imagem. Instale com: npm install @napi-rs/canvas"
    );
}

const LARGURA = 900;
const ALTURA = 420;
const RAIO_AVATAR = 120;
const CENTRO_Y = 190;

// =====================================================
// 💘 PORCENTAGEM
// =====================================================
// Sempre dá o mesmo resultado para o mesmo par de pessoas,
// não importa a ordem (A + B = B + A).

function calcularPorcentagem(idA, idB) {
    if (idA === idB) {
        return 100;
    }

    const chave =
        [idA, idB].sort().join(":");

    const hash =
        crypto
            .createHash("sha256")
            .update(`ship:${chave}`)
            .digest();

    return hash.readUInt32BE(0) % 101;
}

// =====================================================
// 🎨 FAIXAS (cor + frase)
// =====================================================

function faixa(porcentagem) {
    if (porcentagem === 100) {
        return {
            cor: ["#ffd86b", "#ff9f1c"],
            hex: 0xFFC83D,
            frase: "💍 Almas gêmeas! Isso é amor de verdade!"
        };
    }

    if (porcentagem >= 90) {
        return {
            cor: ["#ff5fa2", "#ff2e63"],
            hex: 0xFF2E63,
            frase: "💞 Casal dos sonhos! Já pode marcar o casamento."
        };
    }

    if (porcentagem >= 70) {
        return {
            cor: ["#ff6fb5", "#ff4d8d"],
            hex: 0xFF4D8D,
            frase: "💕 Combinação forte! Tem tudo pra dar certo."
        };
    }

    if (porcentagem >= 50) {
        return {
            cor: ["#ffb347", "#ff7a59"],
            hex: 0xFF8C42,
            frase: "😏 Dá pra rolar algo! Só falta um empurrãozinho."
        };
    }

    if (porcentagem >= 30) {
        return {
            cor: ["#7ec8ff", "#5a8dee"],
            hex: 0x5A8DEE,
            frase: "🤔 Tem um potencial escondido por aí..."
        };
    }

    if (porcentagem >= 10) {
        return {
            cor: ["#9aa7c7", "#6b7a9e"],
            hex: 0x6B7A9E,
            frase: "😅 Melhor ficar só na amizade."
        };
    }

    return {
        cor: ["#8f9bb3", "#5b657d"],
        hex: 0x5B657D,
        frase: "💔 Nem o Wi-Fi conecta vocês dois."
    };
}

// =====================================================
// 🔤 NOMES
// =====================================================

function nomeDe(usuario) {
    return String(
        usuario.displayName ||
        usuario.globalName ||
        usuario.username ||
        "???"
    );
}

function limparNome(nome) {
    return nome
        .replace(/[^\p{L}\p{N}]/gu, "")
        .trim();
}

// Primeira metade de um + segunda metade do outro
function nomeDoCasal(nomeA, nomeB) {
    const a = limparNome(nomeA) || nomeA;
    const b = limparNome(nomeB) || nomeB;

    const parteA =
        a.slice(0, Math.max(1, Math.ceil(a.length / 2)));

    const parteB =
        b.slice(Math.floor(b.length / 2));

    const junto = parteA + parteB;

    return (
        junto.charAt(0).toUpperCase() +
        junto.slice(1).toLowerCase()
    );
}

function encurtar(texto, max) {
    const t = String(texto);

    return t.length > max
        ? `${t.slice(0, max - 1)}…`
        : t;
}

// =====================================================
// 🖌️ DESENHO
// =====================================================

function retanguloArredondado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function caminhoCoracao(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);

    ctx.bezierCurveTo(
        cx - s * 1.6, cy + s * 0.1,
        cx - s * 1.1, cy - s * 1.1,
        cx, cy - s * 0.35
    );

    ctx.bezierCurveTo(
        cx + s * 1.1, cy - s * 1.1,
        cx + s * 1.6, cy + s * 0.1,
        cx, cy + s * 0.9
    );

    ctx.closePath();
}

async function baixarAvatar(usuario) {
    try {
        const url =
            usuario.displayAvatarURL({
                extension: "png",
                size: 256,
                forceStatic: true
            });

        const resposta =
            await fetch(url, {
                signal: AbortSignal.timeout(6000)
            });

        if (!resposta.ok) {
            return null;
        }

        const buffer =
            Buffer.from(
                await resposta.arrayBuffer()
            );

        return await canvasLib.loadImage(buffer);

    } catch (erro) {
        return null;
    }
}

function desenharAvatar(ctx, imagem, usuario, cx, cy, cores) {
    // Anel colorido
    const anel =
        ctx.createLinearGradient(
            cx - RAIO_AVATAR,
            cy - RAIO_AVATAR,
            cx + RAIO_AVATAR,
            cy + RAIO_AVATAR
        );

    anel.addColorStop(0, cores[0]);
    anel.addColorStop(1, cores[1]);

    ctx.beginPath();
    ctx.arc(cx, cy, RAIO_AVATAR + 9, 0, Math.PI * 2);
    ctx.fillStyle = anel;
    ctx.fill();

    // Foto recortada em círculo
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, RAIO_AVATAR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (imagem) {
        ctx.drawImage(
            imagem,
            cx - RAIO_AVATAR,
            cy - RAIO_AVATAR,
            RAIO_AVATAR * 2,
            RAIO_AVATAR * 2
        );
    } else {
        // Plano B: círculo liso com a inicial
        ctx.fillStyle = "#3a3f5c";
        ctx.fillRect(
            cx - RAIO_AVATAR,
            cy - RAIO_AVATAR,
            RAIO_AVATAR * 2,
            RAIO_AVATAR * 2
        );

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 110px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            nomeDe(usuario).charAt(0).toUpperCase(),
            cx,
            cy + 6
        );
    }

    ctx.restore();

    // Nome embaixo
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
        encurtar(nomeDe(usuario), 16),
        cx,
        cy + RAIO_AVATAR + 56
    );
}

async function criarImagem(usuarioA, usuarioB, porcentagem) {
    const { cor } = faixa(porcentagem);

    const canvas =
        canvasLib.createCanvas(LARGURA, ALTURA);

    const ctx = canvas.getContext("2d");

    const [imagemA, imagemB] =
        await Promise.all([
            baixarAvatar(usuarioA),
            baixarAvatar(usuarioB)
        ]);

    // Fundo
    const fundo =
        ctx.createLinearGradient(0, 0, LARGURA, ALTURA);

    fundo.addColorStop(0, "#150d2b");
    fundo.addColorStop(1, "#2f1a52");

    retanguloArredondado(ctx, 0, 0, LARGURA, ALTURA, 34);
    ctx.fillStyle = fundo;
    ctx.fill();

    // Brilhos suaves atrás de cada pessoa
    for (const x of [180, LARGURA - 180]) {
        const brilho =
            ctx.createRadialGradient(
                x, CENTRO_Y, 20,
                x, CENTRO_Y, 220
            );

        brilho.addColorStop(0, `${cor[0]}55`);
        brilho.addColorStop(1, `${cor[0]}00`);

        ctx.fillStyle = brilho;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
    }

    // Borda da imagem (muda de cor conforme a porcentagem)
    const borda =
        ctx.createLinearGradient(0, 0, LARGURA, ALTURA);

    borda.addColorStop(0, cor[0]);
    borda.addColorStop(1, cor[1]);

    retanguloArredondado(
        ctx, 8, 8, LARGURA - 16, ALTURA - 16, 28
    );
    ctx.lineWidth = 8;
    ctx.strokeStyle = borda;
    ctx.stroke();

    // Pessoas
    desenharAvatar(ctx, imagemA, usuarioA, 180, CENTRO_Y, cor);
    desenharAvatar(ctx, imagemB, usuarioB, LARGURA - 180, CENTRO_Y, cor);

    // Coração no centro, enchendo de baixo pra cima
    const cx = LARGURA / 2;
    const tamanho = 98;

    caminhoCoracao(ctx, cx, CENTRO_Y, tamanho);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();

    const base = CENTRO_Y + tamanho * 0.9;
    const topo = CENTRO_Y - tamanho * 0.85;
    const nivel = base - (base - topo) * (porcentagem / 100);

    ctx.save();
    caminhoCoracao(ctx, cx, CENTRO_Y, tamanho);
    ctx.clip();

    const enchimento =
        ctx.createLinearGradient(0, topo, 0, base);

    enchimento.addColorStop(0, cor[0]);
    enchimento.addColorStop(1, cor[1]);

    ctx.fillStyle = enchimento;
    ctx.fillRect(cx - 200, nivel, 400, base - nivel + 5);
    ctx.restore();

    caminhoCoracao(ctx, cx, CENTRO_Y, tamanho);
    ctx.lineWidth = 6;
    ctx.strokeStyle = borda;
    ctx.stroke();

    // Porcentagem no meio do coração
    const texto = `${porcentagem}%`;

    ctx.font = "bold 60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(20,10,40,0.9)";
    ctx.strokeText(texto, cx, CENTRO_Y - 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(texto, cx, CENTRO_Y - 4);

    return canvas.toBuffer("image/png");
}

// =====================================================
// 💬 MONTAR A RESPOSTA
// =====================================================

function barra(porcentagem) {
    const cheios = Math.round(porcentagem / 10);

    return "▰".repeat(cheios) + "▱".repeat(10 - cheios);
}

async function montarResposta(usuarioA, usuarioB) {
    const porcentagem =
        calcularPorcentagem(usuarioA.id, usuarioB.id);

    const { hex, frase } = faixa(porcentagem);

    const casal =
        nomeDoCasal(nomeDe(usuarioA), nomeDe(usuarioB));

    const embed =
        new EmbedBuilder()
            .setColor(hex)
            .setTitle("💘 SHIP")
            .setDescription(
                `${usuarioA} ❤️ ${usuarioB}\n\n` +
                `**${porcentagem}%** ${barra(porcentagem)}\n\n` +
                `${frase}\n\n` +
                `💞 Nome do casal: **${casal}**`
            )
            .setFooter({
                text: "MIGUELGAMEBP-bot"
            });

    const resposta = { embeds: [embed] };

    if (canvasLib) {
        try {
            const buffer =
                await criarImagem(
                    usuarioA,
                    usuarioB,
                    porcentagem
                );

            resposta.files = [
                new AttachmentBuilder(buffer, {
                    name: "ship.png"
                })
            ];

            embed.setImage("attachment://ship.png");

            return resposta;

        } catch (erro) {
            console.error(
                "❌ /ship: erro ao desenhar a imagem:",
                erro
            );
        }
    }

    // Plano B: sem imagem, mostra as fotos pequenas
    embed.setThumbnail(
        usuarioB.displayAvatarURL()
    );

    return resposta;
}

// =====================================================
// 🤖 COMANDO
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ship")
        .setDescription(
            "Veja a chance de duas pessoas darem match! 💘"
        )
        .addUserOption(option =>
            option
                .setName("pessoa1")
                .setDescription("Primeira pessoa.")
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName("pessoa2")
                .setDescription(
                    "Segunda pessoa (se vazio, é você)."
                )
                .setRequired(false)
        ),

    calcularPorcentagem,
    nomeDoCasal,

    async execute(interaction) {
        try {
            const pessoa1 =
                interaction.options.getUser("pessoa1");

            const pessoa2 =
                interaction.options.getUser("pessoa2");

            // Com uma pessoa só: você + ela
            const usuarioA = pessoa2 ? pessoa1 : interaction.user;
            const usuarioB = pessoa2 ? pessoa2 : pessoa1;

            await interaction.deferReply();

            const resposta =
                await montarResposta(usuarioA, usuarioB);

            await interaction.editReply(resposta);

        } catch (erro) {
            console.error("❌ Erro no comando /ship:", erro);

            const aviso = {
                content: "❌ Não foi possível calcular o ship."
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

    async handlePrefix(message) {
        try {
            const mencionados =
                [...message.mentions.users.values()];

            if (mencionados.length === 0) {
                return message.reply(
                    "💘 Use: `ship @pessoa` ou `ship @pessoa1 @pessoa2`"
                );
            }

            const usuarioA =
                mencionados.length >= 2
                    ? mencionados[0]
                    : message.author;

            const usuarioB =
                mencionados.length >= 2
                    ? mencionados[1]
                    : mencionados[0];

            const resposta =
                await montarResposta(usuarioA, usuarioB);

            await message.reply(resposta);

        } catch (erro) {
            console.error(
                "❌ Erro no comando ship por prefixo:",
                erro
            );

            await message.reply(
                "❌ Não foi possível calcular o ship."
            ).catch(() => { });
        }
    }
};
