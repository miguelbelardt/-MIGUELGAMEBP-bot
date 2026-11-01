// =====================================================
// 🛒 ECONOMIA: LOJA, INVENTÁRIO, USAR ITENS E TRABALHAR
// =====================================================
// Usa as mesmas moedas do /atm, /daily e /pay.
// As tabelas "inventario" e "trabalho" são criadas sozinhas.
//
// Para mudar a loja, edite a lista ITENS logo abaixo
// (depois de mexer nela, reinicie o bot para atualizar os slash commands).

const {
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const { getPremium } = require("./database/premium.js");
const emojis = require("./emojis.js");

// =====================================================
// ⚙️ CONFIGURAÇÕES (pode mexer)
// =====================================================

const COR = 0xF1C40F;
const MAX_POR_ITEM = 999;       // máximo de cada item no inventário
const MAX_POR_COMPRA = 20;      // máximo por compra

const TRABALHO_ESPERA_MS = 60 * 60 * 1000; // 1 hora
const TRABALHO_MIN = 80;
const TRABALHO_MAX = 250;
const BONUS_AMULETO = 0.5;      // +50%
const BONUS_PREMIUM = 0.2;      // +20%

// tipo: "consumivel" (use com /usar), "passivo" (é gasto sozinho
// por outro comando) ou "colecionavel" (só para exibir)
const ITENS = [
    {
        id: "pocao_xp",
        nome: "Poção de XP",
        emoji: "🧪",
        preco: 500,
        tipo: "consumivel",
        xp: 200,
        descricao: "Dá **+200 XP** quando usada."
    },
    {
        id: "pocao_xp_grande",
        nome: "Poção de XP Grande",
        emoji: "⚗️",
        preco: 2000,
        tipo: "consumivel",
        xp: 1000,
        descricao: "Dá **+1000 XP** quando usada."
    },
    {
        id: "amuleto",
        nome: "Amuleto da Sorte",
        emoji: "🍀",
        preco: 800,
        tipo: "passivo",
        descricao: "Gasto sozinho no próximo `/trabalhar`: **+50%** de moedas."
    },
    {
        id: "anel",
        nome: "Anel de Casamento",
        emoji: "💍",
        preco: 3000,
        tipo: "passivo",
        descricao: "Necessário para se casar com `/casar` (é gasto no casamento)."
    },
    {
        id: "trofeu",
        nome: "Troféu de Ouro",
        emoji: "🏆",
        preco: 10000,
        tipo: "colecionavel",
        descricao: "Para exibir no inventário."
    },
    {
        id: "coroa",
        nome: "Coroa Real",
        emoji: "👑",
        preco: 50000,
        tipo: "colecionavel",
        descricao: "Para quem quer mostrar que é rico."
    }
];

const TRABALHOS = [
    "programou um bot para um servidor",
    "entregou pizzas a noite toda",
    "foi moderador de um servidor grande",
    "editou vídeos para um streamer",
    "vendeu limonada na calçada",
    "passeou com cachorros do bairro",
    "ajudou numa mudança",
    "consertou computadores",
    "desenhou emojis para um servidor",
    "foi DJ numa festa"
];

const EMOJIS = {
    erro: emojis.erro,
    sucesso: emojis.sucesso,
    moedas: emojis.moedas,
    relogio: emojis.relogio
};

// =====================================================
// 🔧 AUXILIARES
// =====================================================

function formatar(n) {
    return Number(n).toLocaleString("pt-BR");
}

function erro(texto) {
    return { erro: `${EMOJIS.erro} ${texto}` };
}

function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

// Acha pelo id ("pocao_xp") ou pelo nome ("poção de xp")
function acharItem(texto) {
    const t = normalizar(texto);

    if (!t) return null;

    return (
        ITENS.find(i => normalizar(i.id) === t) ||
        ITENS.find(i => normalizar(i.nome) === t) ||
        null
    );
}

let tabelasProntas = false;

async function prepararTabelas() {
    if (tabelasProntas) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS inventario (
            user_id VARCHAR(30) NOT NULL,
            item_id VARCHAR(40) NOT NULL,
            quantidade INT NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        )
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS trabalho (
            user_id VARCHAR(30) PRIMARY KEY,
            ultimo BIGINT NOT NULL DEFAULT 0
        )
    `);

    tabelasProntas = true;
}

async function comTransacao(trabalho) {
    await prepararTabelas();

    const conexao = await mysqlPool.getConnection();

    try {
        await conexao.beginTransaction();

        const resultado = await trabalho(conexao);

        if (resultado && resultado.desfazer) {
            await conexao.rollback();
        } else {
            await conexao.commit();
        }

        return resultado;

    } catch (e) {
        try {
            await conexao.rollback();
        } catch {
            // ignora
        }

        throw e;

    } finally {
        conexao.release();
    }
}

async function garantirUsuario(conexao, userId) {
    await conexao.query(
        "INSERT IGNORE INTO usuarios (id, saldo, xp) VALUES (?, 0, 0)",
        [userId]
    );
}

// =====================================================
// 🛒 LOJA
// =====================================================

function embedLoja() {
    const linhas = ITENS.map(i =>
        `${i.emoji} **${i.nome}** — ${EMOJIS.moedas} **${formatar(i.preco)}**\n┗ ${i.descricao}`
    );

    return new EmbedBuilder()
        .setColor(COR)
        .setTitle("🛒 Loja")
        .setDescription(
            `${linhas.join("\n\n")}\n\n` +
            "Use `/comprar item quantidade` ou escolha no menu abaixo (1 unidade)."
        );
}

function loja() {
    return { resposta: { embeds: [embedLoja()] } };
}

async function comprar({ usuario, item, quantidade = 1 }) {
    const alvo = typeof item === "string" ? acharItem(item) : item;

    if (!alvo) return erro("Não achei esse item. Veja a lista em `/loja`.");

    const qtd = Math.floor(Number(quantidade));

    if (!Number.isInteger(qtd) || qtd < 1 || qtd > MAX_POR_COMPRA) {
        return erro(`Compre de **1** a **${MAX_POR_COMPRA}** por vez.`);
    }

    const total = alvo.preco * qtd;

    const r = await comTransacao(async conexao => {
        await garantirUsuario(conexao, usuario.id);

        const [linhas] = await conexao.query(
            "SELECT quantidade FROM inventario WHERE user_id = ? AND item_id = ? FOR UPDATE",
            [usuario.id, alvo.id]
        );

        const tem = linhas.length ? Number(linhas[0].quantidade) : 0;

        if (tem + qtd > MAX_POR_ITEM) {
            return { desfazer: true, motivo: "limite", tem };
        }

        const [cobranca] = await conexao.query(
            `UPDATE usuarios
             SET saldo = COALESCE(saldo, 0) - ?
             WHERE id = ? AND COALESCE(saldo, 0) >= ?`,
            [total, usuario.id, total]
        );

        if (cobranca.affectedRows === 0) {
            return { desfazer: true, motivo: "saldo" };
        }

        await conexao.query(
            `INSERT INTO inventario (user_id, item_id, quantidade)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)`,
            [usuario.id, alvo.id, qtd]
        );

        const [[saldo]] = await conexao.query(
            "SELECT COALESCE(saldo, 0) AS saldo FROM usuarios WHERE id = ?",
            [usuario.id]
        );

        return { ok: true, saldo: Number(saldo.saldo) };
    });

    if (r.motivo === "saldo") {
        return erro(`Saldo insuficiente. Você precisa de ${EMOJIS.moedas} **${formatar(total)}**.`);
    }

    if (r.motivo === "limite") {
        return erro(`Você só pode ter até **${MAX_POR_ITEM}** de cada item (já tem ${r.tem}).`);
    }

    return {
        resposta: {
            embeds: [
                new EmbedBuilder()
                    .setColor(COR)
                    .setTitle(`${EMOJIS.sucesso} Compra feita!`)
                    .setDescription(
                        `Você comprou **${qtd}x** ${alvo.emoji} **${alvo.nome}** por ${EMOJIS.moedas} **${formatar(total)}**.\n` +
                        `Saldo agora: ${EMOJIS.moedas} **${formatar(r.saldo)}**`
                    )
            ]
        }
    };
}

// =====================================================
// 🎒 INVENTÁRIO
// =====================================================

async function inventario({ usuario, alvo }) {
    await prepararTabelas();

    const dono = alvo || usuario;

    const [linhas] = await mysqlPool.query(
        "SELECT item_id, quantidade FROM inventario WHERE user_id = ? AND quantidade > 0",
        [dono.id]
    );

    const itens = linhas
        .map(l => ({ item: ITENS.find(i => i.id === l.item_id), qtd: Number(l.quantidade) }))
        .filter(x => x.item);

    if (!itens.length) {
        return {
            resposta: {
                content: dono.id === usuario.id
                    ? "🎒 Seu inventário está vazio. Veja a `/loja`!"
                    : `🎒 O inventário de **${dono.username}** está vazio.`,
                allowedMentions: { parse: [] }
            }
        };
    }

    const texto = itens
        .map(x => `${x.item.emoji} **${x.item.nome}** x${formatar(x.qtd)}`)
        .join("\n");

    return {
        resposta: {
            embeds: [
                new EmbedBuilder()
                    .setColor(COR)
                    .setTitle(`🎒 Inventário de ${dono.username}`.slice(0, 250))
                    .setDescription(texto)
            ]
        }
    };
}

async function quantidadeDoItem(userId, itemId) {
    await prepararTabelas();

    const [linhas] = await mysqlPool.query(
        "SELECT quantidade FROM inventario WHERE user_id = ? AND item_id = ?",
        [userId, itemId]
    );

    return linhas.length ? Number(linhas[0].quantidade) : 0;
}

// Gasta 1 unidade (para outros comandos, como o /casar).
// Devolve true se tinha e gastou.
async function gastarItem(userId, itemId, conexaoExterna = null) {
    await prepararTabelas();

    const executor = conexaoExterna || mysqlPool;

    const [r] = await executor.query(
        `UPDATE inventario SET quantidade = quantidade - 1
         WHERE user_id = ? AND item_id = ? AND quantidade >= 1`,
        [userId, itemId]
    );

    return r.affectedRows > 0;
}

// =====================================================
// 🧪 USAR
// =====================================================

async function usar({ usuario, item }) {
    const alvo = typeof item === "string" ? acharItem(item) : item;

    if (!alvo) return erro("Não achei esse item. Veja o seu `/inventario`.");

    if (alvo.tipo === "colecionavel") {
        return erro(`${alvo.emoji} **${alvo.nome}** é só de enfeite, não dá para usar.`);
    }

    if (alvo.tipo === "passivo") {
        return erro(`${alvo.emoji} **${alvo.nome}** é gasto sozinho: ${alvo.descricao}`);
    }

    const r = await comTransacao(async conexao => {
        const gastou = await gastarItem(usuario.id, alvo.id, conexao);

        if (!gastou) return { desfazer: true, motivo: "sem" };

        await garantirUsuario(conexao, usuario.id);

        await conexao.query(
            "UPDATE usuarios SET xp = COALESCE(xp, 0) + ? WHERE id = ?",
            [alvo.xp, usuario.id]
        );

        const [[xp]] = await conexao.query(
            "SELECT COALESCE(xp, 0) AS xp FROM usuarios WHERE id = ?",
            [usuario.id]
        );

        return { ok: true, xp: Number(xp.xp) };
    });

    if (r.motivo === "sem") {
        return erro(`Você não tem ${alvo.emoji} **${alvo.nome}**. Compre na \`/loja\`.`);
    }

    return {
        resposta:
            `${alvo.emoji} Você usou **${alvo.nome}** e ganhou **+${formatar(alvo.xp)} XP**! ` +
            `(XP total: **${formatar(r.xp)}**)`
    };
}

// =====================================================
// 💼 TRABALHAR
// =====================================================

async function trabalhar({ usuario }) {
    const premium = await getPremium(usuario.id);

    const r = await comTransacao(async conexao => {
        await garantirUsuario(conexao, usuario.id);

        await conexao.query(
            "INSERT IGNORE INTO trabalho (user_id, ultimo) VALUES (?, 0)",
            [usuario.id]
        );

        const [[linha]] = await conexao.query(
            "SELECT ultimo FROM trabalho WHERE user_id = ? FOR UPDATE",
            [usuario.id]
        );

        const agora = Date.now();
        const ultimo = Number(linha.ultimo);

        if (agora - ultimo < TRABALHO_ESPERA_MS) {
            return { desfazer: true, voltaEm: ultimo + TRABALHO_ESPERA_MS };
        }

        const base =
            TRABALHO_MIN +
            Math.floor(Math.random() * (TRABALHO_MAX - TRABALHO_MIN + 1));

        const usouAmuleto = await gastarItem(usuario.id, "amuleto", conexao);

        let multiplicador = 1;
        if (usouAmuleto) multiplicador += BONUS_AMULETO;
        if (premium.ativo) multiplicador += BONUS_PREMIUM;

        const ganho = Math.round(base * multiplicador);

        await conexao.query(
            "UPDATE trabalho SET ultimo = ? WHERE user_id = ?",
            [agora, usuario.id]
        );

        await conexao.query(
            "UPDATE usuarios SET saldo = COALESCE(saldo, 0) + ? WHERE id = ?",
            [ganho, usuario.id]
        );

        const [[saldo]] = await conexao.query(
            "SELECT COALESCE(saldo, 0) AS saldo FROM usuarios WHERE id = ?",
            [usuario.id]
        );

        return {
            ok: true,
            ganho,
            usouAmuleto,
            saldo: Number(saldo.saldo),
            proximo: agora + TRABALHO_ESPERA_MS
        };
    });

    if (r.voltaEm) {
        return {
            erro: `${EMOJIS.relogio} Você já trabalhou! Descanse e volte <t:${Math.floor(r.voltaEm / 1000)}:R>.`
        };
    }

    const trabalho = TRABALHOS[Math.floor(Math.random() * TRABALHOS.length)];

    const extras = [];
    if (r.usouAmuleto) extras.push("🍀 Amuleto da Sorte (+50%)");
    if (premium.ativo) extras.push("💎 Premium (+20%)");

    return {
        resposta: {
            embeds: [
                new EmbedBuilder()
                    .setColor(COR)
                    .setTitle("💼 Dia de trabalho")
                    .setDescription(
                        `Você ${trabalho} e ganhou ${EMOJIS.moedas} **${formatar(r.ganho)}**!\n` +
                        (extras.length ? `Bônus: ${extras.join(" • ")}\n` : "") +
                        `Saldo agora: ${EMOJIS.moedas} **${formatar(r.saldo)}**\n\n` +
                        `${EMOJIS.relogio} Pode trabalhar de novo <t:${Math.floor(r.proximo / 1000)}:R>.`
                    )
            ]
        }
    };
}

// =====================================================
// 💬 RESPONDER (slash e prefixo)
// =====================================================

async function rodarSlash(interaction, acao, extra = {}) {
    try {
        await interaction.deferReply();

        const resultado = await acao({
            usuario: interaction.user,
            guild: interaction.guild,
            ...extra
        });

        if (resultado.erro) {
            await interaction.deleteReply().catch(() => { });

            return interaction.followUp({
                content: resultado.erro,
                flags: MessageFlags.Ephemeral
            });
        }

        const payload =
            typeof resultado.resposta === "string"
                ? { content: resultado.resposta, allowedMentions: { parse: [] } }
                : { allowedMentions: { parse: [] }, ...resultado.resposta };

        return interaction.editReply(payload);

    } catch (e) {
        console.error("❌ Erro em um comando de economia:", e);

        const aviso = `${EMOJIS.erro} Não foi possível concluir o comando.`;

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: aviso, flags: MessageFlags.Ephemeral }).catch(() => { });
        } else {
            await interaction.reply({ content: aviso, flags: MessageFlags.Ephemeral }).catch(() => { });
        }
    }
}

async function rodarPrefixo(message, acao, extra = {}) {
    try {
        const resultado = await acao({
            usuario: message.author,
            guild: message.guild,
            ...extra
        });

        if (resultado.erro) {
            return message.reply({ content: resultado.erro, allowedMentions: { parse: [] } });
        }

        return message.reply(
            typeof resultado.resposta === "string"
                ? { content: resultado.resposta, allowedMentions: { parse: [] } }
                : { allowedMentions: { parse: [] }, ...resultado.resposta }
        );

    } catch (e) {
        console.error("❌ Erro em um comando de economia (prefixo):", e);

        await message.reply(`${EMOJIS.erro} Não foi possível concluir o comando.`).catch(() => { });
    }
}

module.exports = {
    ITENS,
    acharItem,
    loja,
    embedLoja,
    comprar,
    inventario,
    usar,
    trabalhar,
    quantidadeDoItem,
    gastarItem,
    comTransacao,
    rodarSlash,
    rodarPrefixo
};
