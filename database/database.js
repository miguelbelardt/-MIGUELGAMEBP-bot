const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Criar tabela de usuários
async function inicializarBanco() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id VARCHAR(30) PRIMARY KEY,
            saldo BIGINT NOT NULL DEFAULT 0
        )
    `);

    console.log("💾 Banco de dados conectado e tabela pronta!");
}

// Criar usuário se ainda não existir
async function criarUsuario(userId) {
    await pool.query(
        `
        INSERT INTO usuarios (id, saldo)
        VALUES ($1, 0)
        ON CONFLICT (id) DO NOTHING
        `,
        [userId]
    );
}

// Pegar saldo
async function getSaldo(userId) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        "SELECT saldo FROM usuarios WHERE id = $1",
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
        SET saldo = saldo + $1
        WHERE id = $2
        `,
        [quantidade, userId]
    );
}

module.exports = {
    pool,
    inicializarBanco,
    criarUsuario,
    getSaldo,
    alterarSaldo
};
