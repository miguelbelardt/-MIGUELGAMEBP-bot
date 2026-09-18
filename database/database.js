const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Criar tabela e corrigir dados antigos
async function inicializarBanco() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id VARCHAR(30) PRIMARY KEY,
            saldo BIGINT NOT NULL DEFAULT 0,
            ultimo_daily BIGINT,
            notificacao_daily BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS ultimo_daily BIGINT
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS notificacao_daily BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        UPDATE usuarios
        SET saldo = 0
        WHERE saldo IS NULL
    `);

    await pool.query(`
        UPDATE usuarios
        SET notificacao_daily = FALSE
        WHERE notificacao_daily IS NULL
    `);

    console.log("💾 Banco de dados conectado e tabela pronta!");
}

// Criar usuário se não existir
async function criarUsuario(userId) {
    await pool.query(
        `
        INSERT INTO usuarios (
            id,
            saldo,
            ultimo_daily,
            notificacao_daily
        )
        VALUES ($1, 0, NULL, FALSE)
        ON CONFLICT (id) DO NOTHING
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET saldo = 0
        WHERE id = $1 AND saldo IS NULL
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET notificacao_daily = FALSE
        WHERE id = $1 AND notificacao_daily IS NULL
        `,
        [userId]
    );
}

// Pegar saldo
async function getSaldo(userId) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        `
        SELECT COALESCE(saldo, 0) AS saldo
        FROM usuarios
        WHERE id = $1
        `,
        [userId]
    );

    return Number(resultado.rows[0].saldo);
}

// Alterar saldo
async function alterarSaldo(userId, quantidade) {
    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET saldo = COALESCE(saldo, 0) + $1
        WHERE id = $2
        `,
        [quantidade, userId]
    );
}

// Pegar horário do último Daily
async function getUltimoDaily(userId) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        `
        SELECT ultimo_daily
        FROM usuarios
        WHERE id = $1
        `,
        [userId]
    );

    return resultado.rows[0]?.ultimo_daily
        ? Number(resultado.rows[0].ultimo_daily)
        : null;
}

// Salvar horário do último Daily
async function salvarUltimoDaily(userId, timestamp) {
    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET ultimo_daily = $1
        WHERE id = $2
        `,
        [timestamp, userId]
    );
}

// Pegar estado da notificação do Daily
async function getNotificacaoDaily(userId) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        `
        SELECT notificacao_daily
        FROM usuarios
        WHERE id = $1
        `,
        [userId]
    );

    return resultado.rows[0]?.notificacao_daily === true;
}

// Salvar estado da notificação do Daily
async function salvarNotificacaoDaily(userId, ativada) {
    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET notificacao_daily = $1
        WHERE id = $2
        `,
        [ativada, userId]
    );
}

// Pegar usuários com notificação do Daily ativada
async function getUsuariosComNotificacaoDaily() {
    const resultado = await pool.query(
        `
        SELECT id, ultimo_daily
        FROM usuarios
        WHERE notificacao_daily = TRUE
        AND ultimo_daily IS NOT NULL
        `
    );

    return resultado.rows.map(usuario => ({
        id: usuario.id,
        ultimo_daily: Number(usuario.ultimo_daily)
    }));
}

// Pegar ranking de moedas
async function getRankingMoedas(userId, limite = 10) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        `
        SELECT id, saldo
        FROM usuarios
        ORDER BY saldo DESC, id ASC
        LIMIT $1
        `,
        [limite]
    );

    const ranking = resultado.rows.map((usuario, index) => ({
        id: usuario.id,
        saldo: Number(usuario.saldo),
        posicao: index + 1
    }));

    const usuarioAtual = await pool.query(
        `
        SELECT id, saldo
        FROM usuarios
        WHERE id = $1
        `,
        [userId]
    );

    let posicaoUsuario = null;
    let saldoUsuario = 0;

    if (usuarioAtual.rows.length > 0) {
        saldoUsuario = Number(
            usuarioAtual.rows[0].saldo
        );

        const posicao = await pool.query(
            `
            SELECT COUNT(*) + 1 AS posicao
            FROM usuarios
            WHERE saldo > $1
            OR (saldo = $1 AND id < $2)
            `,
            [
                saldoUsuario,
                userId
            ]
        );

        posicaoUsuario = Number(
            posicao.rows[0].posicao
        );
    }

    return {
        ranking,
        usuario: {
            id: userId,
            saldo: saldoUsuario,
            posicao: posicaoUsuario
        }
    };
}

module.exports = {
    pool,
    inicializarBanco,
    criarUsuario,
    getSaldo,
    alterarSaldo,
    getUltimoDaily,
    salvarUltimoDaily,
    getNotificacaoDaily,
    salvarNotificacaoDaily,
    getUsuariosComNotificacaoDaily,
    getRankingMoedas
};
