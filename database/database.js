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

module.exports = {
    pool,
    inicializarBanco,
    criarUsuario,
    getSaldo,
    alterarSaldo,
    getUltimoDaily,
    salvarUltimoDaily,
    getNotificacaoDaily,
    salvarNotificacaoDaily
};
