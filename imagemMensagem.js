// =====================================================
// 🖼️ IMAGEM DA MENSAGEM (logs de mensagem editada/apagada)
// =====================================================
// Desenha um "print" da mensagem: avatar, nome, horário, texto,
// anexos e IDs. Usado pelo index.js nos logs.
//
// Se o @napi-rs/canvas não estiver instalado, nada quebra:
// gerarImagemDaMensagem() só devolve null e o log sai sem imagem.

let canvasLib = null;

try {
    canvasLib = require("@napi-rs/canvas");
} catch {
    console.warn(
        "⚠️ @napi-rs/canvas não instalado: os logs de mensagem vão sair sem imagem."
    );
}

// =====================================================
// ⚙️ CONFIGURAÇÕES
// =====================================================

const FONTE = "'Inter', 'Noto Sans', 'DejaVu Sans', 'Segoe UI', sans-serif";

const CORES = {
    fundo: "#17181b",
    painel: "#313338",
    pilula: "#2b2d31",
    nome: "#f2f3f5",
    texto: "#dbdee1",
    cinza: "#949ba4",
    cinzaClaro: "#b5bac1",
    erro: "#ed4245",
    aviso: "#fee75c",
    sucesso: "#57f287",
    caixa: "#2b2d31"
};

const LARGURA = 900;
const MARGEM = 24;
const PADDING = 22;
const AVATAR = 52;
const LARGURA_TEXTO = LARGURA - MARGEM * 2 - PADDING * 2 - AVATAR - 16;

const MAX_LINHAS_TEXTO = 18;
const MAX_CARACTERES = 1500;
const MAX_ANEXOS_DESENHADOS = 4;
const CELULA_ANEXO_L = 400;
const CELULA_ANEXO_A = 250;

const TAMANHO_MAXIMO_DOWNLOAD = 8 * 1024 * 1024;
const TEMPO_LIMITE_DOWNLOAD = 10 * 1000;
const ALTURA_MAXIMA = 3000;

// =====================================================
// 🔧 FUNÇÕES AUXILIARES
// =====================================================

function urlDoDiscord(url) {
    try {
        const endereco = new URL(url);

        return (
            endereco.protocol === "https:" &&
            /(^|\.)(discordapp\.com|discordapp\.net|discord\.com|discordapp\.media)$/i
                .test(endereco.hostname)
        );

    } catch {
        return false;
    }
}

async function baixarImagem(url) {
    if (!canvasLib || !urlDoDiscord(url)) {
        return null;
    }

    const controle = new AbortController();

    const relogio =
        setTimeout(
            () => controle.abort(),
            TEMPO_LIMITE_DOWNLOAD
        );

    try {
        const resposta =
            await fetch(url, {
                signal: controle.signal
            });

        if (!resposta.ok) {
            return null;
        }

        const tipo =
            resposta.headers.get("content-type") || "";

        if (!tipo.startsWith("image/")) {
            return null;
        }

        const buffer =
            Buffer.from(await resposta.arrayBuffer());

        if (buffer.length > TAMANHO_MAXIMO_DOWNLOAD) {
            return null;
        }

        return await canvasLib.loadImage(buffer);

    } catch {
        return null;

    } finally {
        clearTimeout(relogio);
    }
}

function anexoEhImagem(anexo) {
    if (!anexo?.url) {
        return false;
    }

    return (
        String(anexo.tipo || "")
            .toLowerCase()
            .startsWith("image/") ||
        /\.(png|jpe?g|gif|webp|bmp)$/i
            .test(String(anexo.nome || ""))
    );
}

// Deixa o texto legível: menções e emojis customizados viram texto.
function limparTexto(texto) {
    return String(texto || "")
        .replace(/<@!?(\d+)>/g, "@usuário")
        .replace(/<@&(\d+)>/g, "@cargo")
        .replace(/<#(\d+)>/g, "#canal")
        .replace(/<a?:(\w+):\d+>/g, ":$1:")
        .slice(0, MAX_CARACTERES);
}

function formatarHorario(timestamp) {
    const data =
        new Date(Number(timestamp) || Date.now());

    return new Intl.DateTimeFormat(
        "pt-BR",
        {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }
    ).format(data).replace(",", "");
}

function quebrarLinhas(ctx, texto, larguraMax) {
    const linhas = [];

    for (const paragrafo of String(texto).split("\n")) {
        if (paragrafo.trim() === "") {
            linhas.push("");
            continue;
        }

        let atual = "";

        for (const palavra of paragrafo.split(/\s+/)) {
            if (!palavra) {
                continue;
            }

            const tentativa =
                atual ? `${atual} ${palavra}` : palavra;

            if (ctx.measureText(tentativa).width <= larguraMax) {
                atual = tentativa;
                continue;
            }

            if (atual) {
                linhas.push(atual);
                atual = "";
            }

            // Palavra maior que a linha: quebra por caracteres.
            let pedaco = "";

            for (const letra of palavra) {
                if (
                    ctx.measureText(pedaco + letra).width >
                    larguraMax
                ) {
                    linhas.push(pedaco);
                    pedaco = letra;
                } else {
                    pedaco += letra;
                }
            }

            atual = pedaco;
        }

        if (atual) {
            linhas.push(atual);
        }
    }

    if (linhas.length > MAX_LINHAS_TEXTO) {
        const cortadas = linhas.slice(0, MAX_LINHAS_TEXTO);

        cortadas[MAX_LINHAS_TEXTO - 1] =
            `${cortadas[MAX_LINHAS_TEXTO - 1]} …`;

        return cortadas;
    }

    return linhas;
}

function retanguloArredondado(ctx, x, y, l, a, raio) {
    ctx.beginPath();
    ctx.moveTo(x + raio, y);
    ctx.lineTo(x + l - raio, y);
    ctx.quadraticCurveTo(x + l, y, x + l, y + raio);
    ctx.lineTo(x + l, y + a - raio);
    ctx.quadraticCurveTo(x + l, y + a, x + l - raio, y + a);
    ctx.lineTo(x + raio, y + a);
    ctx.quadraticCurveTo(x, y + a, x, y + a - raio);
    ctx.lineTo(x, y + raio);
    ctx.quadraticCurveTo(x, y, x + raio, y);
    ctx.closePath();
}

function cortarTexto(ctx, texto, larguraMax) {
    let resultado = String(texto);

    if (ctx.measureText(resultado).width <= larguraMax) {
        return resultado;
    }

    while (
        resultado.length > 1 &&
        ctx.measureText(`${resultado}…`).width > larguraMax
    ) {
        resultado = resultado.slice(0, -1);
    }

    return `${resultado}…`;
}

// =====================================================
// 🎨 DESENHAR
// =====================================================
// dados = {
//   tipo: "apagada" | "editada",
//   guildNome, canalNome,
//   autor: { id, nome, avatar },
//   ids: { usuario, servidor, canal, mensagem },
//   mensagens: [{ rotulo?, conteudo, criadoEm, anexos: [{nome,url,tipo}] }],
//   nomeBot
// }

async function gerarImagemDaMensagem(dados) {
    if (!canvasLib) {
        return null;
    }

    try {
        const { createCanvas } = canvasLib;

        const medidor =
            createCanvas(10, 10).getContext("2d");

        medidor.font = `21px ${FONTE}`;

        const corDestaque =
            dados.tipo === "editada"
                ? CORES.aviso
                : CORES.erro;

        // ---- baixa avatar e imagens dos anexos
        const [avatar, ...imagensPorMensagem] =
            await Promise.all([
                dados.autor?.avatar
                    ? baixarImagem(dados.autor.avatar)
                    : null,

                ...dados.mensagens.map(async mensagem => {
                    const lista =
                        (mensagem.anexos || [])
                            .slice(0, MAX_ANEXOS_DESENHADOS);

                    return Promise.all(
                        lista.map(async anexo => ({
                            anexo,
                            imagem:
                                anexoEhImagem(anexo)
                                    ? await baixarImagem(anexo.url)
                                    : null
                        }))
                    );
                })
            ]);

        // ---- mede cada mensagem
        const blocos =
            dados.mensagens.map((mensagem, i) => {
                const texto =
                    limparTexto(mensagem.conteudo);

                const linhas =
                    texto
                        ? quebrarLinhas(
                            medidor,
                            texto,
                            LARGURA_TEXTO
                        )
                        : [
                            (mensagem.anexos || []).length > 0
                                ? "(sem texto, só anexo)"
                                : "[Conteúdo não disponível]"
                        ];

                const itens = imagensPorMensagem[i] || [];

                // anexos: 2 por linha
                const linhasAnexos = Math.ceil(itens.length / 2);

                let alturaAnexos = 0;

                for (let l = 0; l < linhasAnexos; l++) {
                    const par = itens.slice(l * 2, l * 2 + 2);

                    alturaAnexos +=
                        Math.max(
                            ...par.map(item =>
                                item.imagem
                                    ? CELULA_ANEXO_A
                                    : 52
                            )
                        ) + 10;
                }

                const alturaTexto = linhas.length * 29;

                return {
                    mensagem,
                    linhas,
                    itens,
                    alturaAnexos,
                    altura:
                        PADDING * 2 +
                        (mensagem.rotulo ? 34 : 0) +
                        28 +
                        alturaTexto +
                        (alturaAnexos ? alturaAnexos + 6 : 0)
                };
            });

        const alturaPilula = 44;
        const alturaIds = 110;

        let altura =
            MARGEM +
            alturaPilula +
            16 +
            blocos.reduce(
                (soma, bloco) => soma + bloco.altura + 12,
                0
            ) +
            alturaIds +
            MARGEM;

        altura = Math.min(altura, ALTURA_MAXIMA);

        const canvas = createCanvas(LARGURA, altura);
        const ctx = canvas.getContext("2d");

        // ---- fundo
        retanguloArredondado(ctx, 0, 0, LARGURA, altura, 26);
        ctx.fillStyle = CORES.fundo;
        ctx.fill();

        // ---- cabeçalho
        const titulo =
            dados.tipo === "editada"
                ? "Mensagem editada no servidor"
                : "Mensagem apagada no servidor";

        const cabecalho =
            `${titulo} → ${dados.guildNome || "desconhecido"} no canal #${dados.canalNome || "desconhecido"}`;

        ctx.font = `600 16px ${FONTE}`;

        const textoCabecalho =
            cortarTexto(
                ctx,
                cabecalho,
                LARGURA - MARGEM * 2 - 44
            );

        const larguraPilula =
            Math.min(
                ctx.measureText(textoCabecalho).width + 44,
                LARGURA - MARGEM * 2
            );

        retanguloArredondado(
            ctx,
            MARGEM,
            MARGEM,
            larguraPilula,
            alturaPilula,
            alturaPilula / 2
        );

        ctx.fillStyle = CORES.pilula;
        ctx.fill();

        ctx.fillStyle = corDestaque;
        ctx.beginPath();
        ctx.arc(MARGEM + 22, MARGEM + alturaPilula / 2, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = CORES.cinzaClaro;
        ctx.textBaseline = "middle";
        ctx.fillText(
            textoCabecalho,
            MARGEM + 38,
            MARGEM + alturaPilula / 2 + 1
        );

        // ---- mensagens
        let y = MARGEM + alturaPilula + 16;

        for (const bloco of blocos) {
            const x = MARGEM;
            const l = LARGURA - MARGEM * 2;

            retanguloArredondado(ctx, x, y, l, bloco.altura, 18);
            ctx.fillStyle = CORES.painel;
            ctx.fill();

            let topo = y + PADDING;

            // rótulo (Antes / Depois)
            if (bloco.mensagem.rotulo) {
                ctx.font = `700 14px ${FONTE}`;

                const larguraRotulo =
                    ctx.measureText(bloco.mensagem.rotulo).width + 24;

                retanguloArredondado(
                    ctx,
                    x + PADDING,
                    topo - 4,
                    larguraRotulo,
                    26,
                    13
                );

                ctx.fillStyle =
                    bloco.mensagem.rotulo === "ANTES"
                        ? CORES.cinza
                        : corDestaque;
                ctx.fill();

                ctx.fillStyle = "#1e1f22";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    bloco.mensagem.rotulo,
                    x + PADDING + 12,
                    topo + 9
                );

                topo += 34;
            }

            // avatar
            const ax = x + PADDING;
            const ay = topo;

            ctx.save();
            ctx.beginPath();
            ctx.arc(
                ax + AVATAR / 2,
                ay + AVATAR / 2,
                AVATAR / 2,
                0,
                Math.PI * 2
            );
            ctx.clip();

            if (avatar) {
                ctx.drawImage(avatar, ax, ay, AVATAR, AVATAR);
            } else {
                ctx.fillStyle = "#5865f2";
                ctx.fillRect(ax, ay, AVATAR, AVATAR);

                ctx.fillStyle = "#ffffff";
                ctx.font = `700 26px ${FONTE}`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    String(dados.autor?.nome || "?")
                        .charAt(0)
                        .toUpperCase(),
                    ax + AVATAR / 2,
                    ay + AVATAR / 2 + 1
                );
                ctx.textAlign = "left";
            }

            ctx.restore();

            // nome + horário
            const tx = ax + AVATAR + 16;

            ctx.textBaseline = "alphabetic";
            ctx.font = `700 22px ${FONTE}`;
            ctx.fillStyle = CORES.nome;

            const nome =
                cortarTexto(
                    ctx,
                    dados.autor?.nome || "Usuário desconhecido",
                    330
                );

            ctx.fillText(nome, tx, topo + 22);

            const larguraNome = ctx.measureText(nome).width;

            ctx.font = `15px ${FONTE}`;
            ctx.fillStyle = CORES.cinza;
            ctx.fillText(
                formatarHorario(bloco.mensagem.criadoEm),
                tx + larguraNome + 12,
                topo + 22
            );

            // texto
            ctx.font = `21px ${FONTE}`;
            ctx.fillStyle = CORES.texto;

            let ty = topo + 28 + 22;

            for (const linha of bloco.linhas) {
                ctx.fillText(linha, tx, ty);
                ty += 29;
            }

            // anexos
            if (bloco.itens.length > 0) {
                let ay2 = ty - 14;

                for (let linha = 0; linha < Math.ceil(bloco.itens.length / 2); linha++) {
                    const par =
                        bloco.itens.slice(linha * 2, linha * 2 + 2);

                    const alturaLinha =
                        Math.max(
                            ...par.map(item =>
                                item.imagem
                                    ? CELULA_ANEXO_A
                                    : 52
                            )
                        );

                    par.forEach((item, coluna) => {
                        const cx = tx + coluna * (CELULA_ANEXO_L + 10);

                        if (item.imagem) {
                            const escala =
                                Math.min(
                                    CELULA_ANEXO_L / item.imagem.width,
                                    CELULA_ANEXO_A / item.imagem.height,
                                    1
                                );

                            const w = item.imagem.width * escala;
                            const h = item.imagem.height * escala;

                            ctx.save();
                            retanguloArredondado(ctx, cx, ay2, w, h, 10);
                            ctx.clip();
                            ctx.drawImage(item.imagem, cx, ay2, w, h);
                            ctx.restore();

                        } else {
                            retanguloArredondado(
                                ctx,
                                cx,
                                ay2,
                                CELULA_ANEXO_L,
                                44,
                                10
                            );

                            ctx.fillStyle = CORES.caixa;
                            ctx.fill();

                            ctx.fillStyle = CORES.cinzaClaro;
                            ctx.font = `16px ${FONTE}`;
                            ctx.textBaseline = "middle";
                            ctx.fillText(
                                cortarTexto(
                                    ctx,
                                    `Arquivo: ${item.anexo.nome || "anexo"}`,
                                    CELULA_ANEXO_L - 28
                                ),
                                cx + 14,
                                ay2 + 23
                            );
                            ctx.textBaseline = "alphabetic";
                        }
                    });

                    ay2 += alturaLinha + 10;
                }
            }

            y += bloco.altura + 12;
        }

        // ---- IDs
        ctx.textBaseline = "alphabetic";

        const ids = [
            ["ID do usuário", dados.ids?.usuario],
            ["ID do servidor", dados.ids?.servidor],
            ["ID do canal", dados.ids?.canal],
            ["ID da mensagem", dados.ids?.mensagem]
        ];

        ids.forEach(([rotulo, valor], i) => {
            const coluna = i % 2;
            const linha = Math.floor(i / 2);

            const ix = MARGEM + 6 + coluna * 290;
            const iy = y + 14 + linha * 48;

            ctx.font = `600 14px ${FONTE}`;
            ctx.fillStyle = CORES.cinza;
            ctx.fillText(rotulo, ix, iy);

            ctx.font = `15px ${FONTE}`;
            ctx.fillStyle = CORES.cinzaClaro;
            ctx.fillText(String(valor || "—"), ix, iy + 21);
        });

        ctx.font = `600 20px ${FONTE}`;
        ctx.fillStyle = CORES.texto;
        ctx.textAlign = "right";
        ctx.fillText(
            `Feito com ${dados.nomeBot || "o bot"}`,
            LARGURA - MARGEM - 6,
            y + 70
        );
        ctx.textAlign = "left";

        return canvas.toBuffer("image/png");

    } catch (erro) {
        console.warn(
            "⚠️ Não consegui gerar a imagem da mensagem para o log:",
            erro?.message || erro
        );

        return null;
    }
}

module.exports = {
    gerarImagemDaMensagem
};
