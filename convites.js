// =====================================================
// 🎟️ CONVITES (quem convidou quem)
// =====================================================
// Descobre por qual link cada pessoa entrou e guarda no banco, para o
// comando /convites mostrar quantas pessoas você trouxe.
//
// Para ligar: no index.js, junto das outras linhas "iniciar", coloque:
//   require("./convites.js").iniciar(client);
//
// A tabela "convites_entradas" é criada sozinha.
//
// ⚠️ O bot precisa da permissão "Gerenciar Servidor" para ver os convites.
// A contagem começa a valer a partir do momento em que isto for ligado.
// Quem sai e volta é contado uma vez só.

const { Events } = require("discord.js");

const { mysqlPool } = require("./database/database.js");

const ATUALIZAR_A_CADA_MS = 5 * 60 * 1000;

// guildId -> Map(código -> { uses, max, inviterId })
const fotos = new Map();

// guildId -> promessa (processa um servidor de cada vez)
const filas = new Map();

const avisados = new Set();

// =====================================================
// 🗃️ BANCO
// =====================================================

let tabelaPronta = false;

async function prepararTabela() {
    if (tabelaPronta) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS convites_entradas (
            guild_id VARCHAR(30) NOT NULL,
            membro_id VARCHAR(30) NOT NULL,
            convidador_id VARCHAR(30),
            codigo VARCHAR(40),
            entrou_em BIGINT NOT NULL,
            saiu BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY (guild_id, membro_id),
            INDEX idx_convites_convidador (guild_id, convidador_id)
        )
    `);

    tabelaPronta = true;
}

// =====================================================
// 🔎 LENDO OS CONVITES DO DISCORD
// =====================================================

async function lerConvites(guild) {
    try {
        const lista = await guild.invites.fetch();
        const mapa = new Map();

        for (const convite of lista.values()) {
            mapa.set(convite.code, {
                uses: Number(convite.uses) || 0,
                max: Number(convite.maxUses) || 0,
                inviterId: convite.inviterId || convite.inviter?.id || null
            });
        }

        return mapa;
    } catch (e) {
        if (!avisados.has(guild.id)) {
            avisados.add(guild.id);

            console.warn(
                `⚠️ Convites: não consigo ver os convites de "${guild.name}". ` +
                "Dê ao bot a permissão Gerenciar Servidor."
            );
        }

        return null;
    }
}

async function atualizarFoto(guild) {
    const atuais = await lerConvites(guild);

    if (atuais) fotos.set(guild.id, atuais);

    return atuais;
}

// Compara a foto antiga com a de agora e diz qual convite foi usado.
// Se não der para ter certeza, devolve null (não chuta).
function descobrirConvite(antes, atuais) {
    if (!antes || !atuais) return null;

    const candidatos = [];

    // 1) Convite cujo número de usos subiu (ou convite novo já usado)
    for (const [codigo, info] of atuais) {
        const usosAntes = antes.get(codigo)?.uses ?? 0;

        if (info.uses > usosAntes) {
            candidatos.push({ codigo, inviterId: info.inviterId });
        }
    }

    // 2) Convite que sumiu porque chegou ao limite de usos
    for (const [codigo, info] of antes) {
        if (!atuais.has(codigo) && info.max > 0 && info.uses + 1 >= info.max) {
            candidatos.push({ codigo, inviterId: info.inviterId });
        }
    }

    return candidatos.length === 1 ? candidatos[0] : null;
}

// =====================================================
// 👋 ENTRADA E SAÍDA
// =====================================================

async function aoEntrar(membro) {
    if (membro.user?.bot) return;

    await prepararTabela();

    const antes = fotos.get(membro.guild.id);
    const atuais = await atualizarFoto(membro.guild);
    const achado = descobrirConvite(antes, atuais);

    let convidador = achado?.inviterId || null;

    // Entrar com o próprio convite não conta
    if (convidador === membro.id) convidador = null;

    await mysqlPool.query(
        `INSERT INTO convites_entradas (guild_id, membro_id, convidador_id, codigo, entrou_em, saiu)
         VALUES (?, ?, ?, ?, ?, FALSE)
         ON DUPLICATE KEY UPDATE
            convidador_id = VALUES(convidador_id),
            codigo = VALUES(codigo),
            entrou_em = VALUES(entrou_em),
            saiu = FALSE`,
        [membro.guild.id, membro.id, convidador, achado?.codigo || null, Date.now()]
    );
}

async function aoSair(membro) {
    await prepararTabela();

    await mysqlPool.query(
        "UPDATE convites_entradas SET saiu = TRUE WHERE guild_id = ? AND membro_id = ?",
        [membro.guild.id, membro.id]
    );
}

function enfileirar(guildId, tarefa) {
    const anterior = filas.get(guildId) || Promise.resolve();

    const proxima = anterior
        .then(tarefa)
        .catch(e => console.error("❌ Erro nos convites:", e));

    filas.set(guildId, proxima);

    return proxima;
}

// =====================================================
// 📊 CONSULTAS (usadas pelo /convites)
// =====================================================

async function estatisticas(guildId, usuarioId) {
    await prepararTabela();

    const [[linha]] = await mysqlPool.query(
        `SELECT COUNT(*) AS total, COALESCE(SUM(saiu = FALSE), 0) AS ativos
         FROM convites_entradas
         WHERE guild_id = ? AND convidador_id = ?`,
        [guildId, usuarioId]
    );

    const total = Number(linha.total) || 0;
    const ativos = Number(linha.ativos) || 0;

    let posicao = null;

    if (total > 0) {
        const [[acima]] = await mysqlPool.query(
            `SELECT COUNT(*) AS quantos FROM (
                SELECT convidador_id, COUNT(*) AS c
                FROM convites_entradas
                WHERE guild_id = ? AND convidador_id IS NOT NULL
                GROUP BY convidador_id
                HAVING c > ?
            ) t`,
            [guildId, total]
        );

        posicao = (Number(acima.quantos) || 0) + 1;
    }

    return { total, ativos, saidas: total - ativos, posicao };
}

// Links que a pessoa criou e ainda existem (contagem do próprio Discord)
async function linksAtuais(guild, usuarioId) {
    const convites = await lerConvites(guild);

    if (!convites) return null;

    const meus = [...convites.entries()]
        .filter(([, info]) => info.inviterId === usuarioId)
        .map(([codigo, info]) => ({ codigo, usos: info.uses }))
        .sort((a, b) => b.usos - a.usos);

    return {
        quantidade: meus.length,
        usos: meus.reduce((soma, c) => soma + c.usos, 0),
        top: meus.slice(0, 3)
    };
}

// Quem mais convidou no servidor (ordena por quem ainda está no servidor)
async function ranking(guildId, limite = 10) {
    await prepararTabela();

    const max = Math.min(Math.max(Number(limite) || 10, 1), 25);

    const [linhas] = await mysqlPool.query(
        `SELECT convidador_id, COUNT(*) AS total, COALESCE(SUM(saiu = FALSE), 0) AS ativos
         FROM convites_entradas
         WHERE guild_id = ? AND convidador_id IS NOT NULL
         GROUP BY convidador_id
         ORDER BY ativos DESC, total DESC
         LIMIT ${max}`,
        [guildId]
    );

    return linhas.map(l => ({
        usuarioId: l.convidador_id,
        total: Number(l.total) || 0,
        ativos: Number(l.ativos) || 0
    }));
}

// =====================================================
// 🚀 INICIAR
// =====================================================

function atualizarTodos(client) {
    for (const guild of client.guilds.cache.values()) {
        enfileirar(guild.id, () => atualizarFoto(guild));
    }
}

function iniciar(client) {
    const comecar = () => atualizarTodos(client);

    if (client.isReady()) comecar();
    else client.once(Events.ClientReady, comecar);

    setInterval(comecar, ATUALIZAR_A_CADA_MS);

    client.on(Events.GuildCreate, guild => {
        enfileirar(guild.id, () => atualizarFoto(guild));
    });

    client.on(Events.GuildMemberAdd, membro => {
        enfileirar(membro.guild.id, () => aoEntrar(membro));
    });

    client.on(Events.GuildMemberRemove, membro => {
        aoSair(membro).catch(e => console.error("❌ Erro nos convites (saída):", e));
    });
}

module.exports = {
    iniciar,
    estatisticas,
    linksAtuais,
    ranking,
    _teste: { descobrirConvite, aoEntrar, aoSair, fotos, atualizarFoto }
};
