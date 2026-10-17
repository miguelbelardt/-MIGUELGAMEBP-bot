const {
    pool,
    mysqlPool
} = require("./database.js");

// =====================================================
// ⚙️ CONFIGURAÇÕES DO PREMIUM
// =====================================================

// Preço de cada compra (em moedas) e quantos dias ela vale.
const PRECO_PREMIUM = 50000;
const DIAS_PREMIUM = 30;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// =====================================================
// 🏗️ TABELA (criada sozinha na primeira vez)
// =====================================================

let tabelaPronta = null;

function prepararTabela() {
    if (!tabelaPronta) {
        tabelaPronta =
            mysqlPool.query(`
                CREATE TABLE IF NOT EXISTS premium_usuarios (
                    user_id VARCHAR(30) PRIMARY KEY,
                    expira_em BIGINT NOT NULL,
                    atualizado_em BIGINT NOT NULL
                )
            `).catch(erro => {
                // Se falhar, tenta de novo na próxima vez
                tabelaPronta = null;
                throw erro;
            });
    }

    return tabelaPronta;
}

// =====================================================
// 🔎 CONSULTAR PREMIUM
// =====================================================

async function getPremium(userId) {
    await prepararTabela();

    const resultado =
        await pool.query(
            `
            SELECT expira_em
            FROM premium_usuarios
            WHERE user_id = $1
            `,
            [userId]
        );

    const linha = resultado.rows[0];

    const expiraEm =
        linha
            ? Number(linha.expira_em)
            : 0;

    return {
        ativo: expiraEm > Date.now(),
        expiraEm
    };
}

// =====================================================
// 🎁 DAR PREMIUM (soma dias; se já tem, estende)
// =====================================================

async function somarDias(executor, userId, dias) {
    const agora = Date.now();
    const adicional = dias * MS_POR_DIA;

    await executor.query(
        `
        INSERT INTO premium_usuarios (
            user_id,
            expira_em,
            atualizado_em
        )
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            expira_em = GREATEST(expira_em, ?) + ?,
            atualizado_em = ?
        `,
        [
            userId,
            agora + adicional,
            agora,
            agora,
            adicional,
            agora
        ]
    );

    const [linhas] =
        await executor.query(
            `
            SELECT expira_em
            FROM premium_usuarios
            WHERE user_id = ?
            `,
            [userId]
        );

    return Number(linhas[0].expira_em);
}

async function darPremium(userId, dias) {
    await prepararTabela();

    return somarDias(
        mysqlPool,
        userId,
        dias
    );
}

// =====================================================
// 🛒 COMPRAR PREMIUM (cobra as moedas e soma os dias)
// =====================================================
// Tudo acontece numa transação: se algo falhar, nada é
// cobrado. Só cobra se o saldo for suficiente.

async function comprarPremium(
    userId,
    preco = PRECO_PREMIUM,
    dias = DIAS_PREMIUM
) {
    await prepararTabela();

    const conexao =
        await mysqlPool.getConnection();

    try {
        await conexao.beginTransaction();

        await conexao.query(
            `
            INSERT IGNORE INTO usuarios (id, saldo)
            VALUES (?, 0)
            `,
            [userId]
        );

        const [cobranca] =
            await conexao.query(
                `
                UPDATE usuarios
                SET saldo = COALESCE(saldo, 0) - ?
                WHERE id = ?
                AND COALESCE(saldo, 0) >= ?
                `,
                [
                    preco,
                    userId,
                    preco
                ]
            );

        if (cobranca.affectedRows === 0) {
            await conexao.rollback();

            return {
                ok: false,
                motivo: "saldo"
            };
        }

        const expiraEm =
            await somarDias(
                conexao,
                userId,
                dias
            );

        const [saldo] =
            await conexao.query(
                `
                SELECT COALESCE(saldo, 0) AS saldo
                FROM usuarios
                WHERE id = ?
                `,
                [userId]
            );

        await conexao.commit();

        return {
            ok: true,
            expiraEm,
            saldoNovo: Number(saldo[0].saldo)
        };

    } catch (erro) {
        try {
            await conexao.rollback();
        } catch (erroRollback) {
            console.error(
                "❌ Erro ao fazer ROLLBACK da compra de premium:",
                erroRollback
            );
        }

        throw erro;

    } finally {
        conexao.release();
    }
}

module.exports = {
    PRECO_PREMIUM,
    DIAS_PREMIUM,
    getPremium,
    darPremium,
    comprarPremium
};
