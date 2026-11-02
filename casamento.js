// =====================================================
// 💍 CASAMENTO
// =====================================================
// Cada pessoa só pode estar casada com uma pessoa (vale em todos os
// servidores). Casar gasta 1 💍 Anel de Casamento de quem pediu
// (compre na /loja). A tabela "casamentos" é criada sozinha.

const { mysqlPool } = require("./database/database.js");
const economia = require("./economia.js");

let tabelaPronta = false;

async function prepararTabela() {
    if (tabelaPronta) return;

    // Uma linha para cada pessoa (duas por casal): a chave primária
    // garante que ninguém fique casado duas vezes.
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS casamentos (
            user_id VARCHAR(30) PRIMARY KEY,
            parceiro_id VARCHAR(30) NOT NULL,
            desde BIGINT NOT NULL
        )
    `);

    tabelaPronta = true;
}

async function estado(userId) {
    await prepararTabela();

    const [linhas] = await mysqlPool.query(
        "SELECT parceiro_id, desde FROM casamentos WHERE user_id = ?",
        [userId]
    );

    if (!linhas.length) return null;

    return {
        parceiroId: linhas[0].parceiro_id,
        desde: Number(linhas[0].desde)
    };
}

// Confere antes de mandar o pedido. Devolve texto de erro ou null.
async function validarPedido(proponente, alvo) {
    if (alvo.id === proponente.id) {
        return "Você não pode se casar consigo mesmo.";
    }

    if (alvo.bot) {
        return "Bots não casam (ainda).";
    }

    if (await estado(proponente.id)) {
        return "Você já está casado(a). Use `/divorciar` primeiro.";
    }

    if (await estado(alvo.id)) {
        return "Essa pessoa já está casada.";
    }

    if ((await economia.quantidadeDoItem(proponente.id, "anel")) < 1) {
        return "Você precisa de um 💍 **Anel de Casamento**. Compre na `/loja`.";
    }

    return null;
}

// Depois que a pessoa aceitou: gasta o anel e casa, tudo junto.
async function casar(proponente, alvo) {
    await prepararTabela();

    try {
        const r = await economia.comTransacao(async conexao => {
            const gastou = await economia.gastarItem(proponente.id, "anel", conexao);

            if (!gastou) return { desfazer: true, motivo: "anel" };

            const agora = Date.now();

            await conexao.query(
                "INSERT INTO casamentos (user_id, parceiro_id, desde) VALUES (?, ?, ?), (?, ?, ?)",
                [proponente.id, alvo.id, agora, alvo.id, proponente.id, agora]
            );

            return { ok: true, desde: agora };
        });

        if (r.motivo === "anel") {
            return { erro: "O anel acabou: você não tem mais o 💍 **Anel de Casamento**." };
        }

        return { ok: true, desde: r.desde };

    } catch (e) {
        if (e && e.code === "ER_DUP_ENTRY") {
            return { erro: "Alguém dessa história acabou de se casar com outra pessoa." };
        }

        throw e;
    }
}

async function divorciar(userId) {
    const atual = await estado(userId);

    if (!atual) return { erro: "Você não está casado(a)." };

    await mysqlPool.query(
        "DELETE FROM casamentos WHERE user_id IN (?, ?)",
        [userId, atual.parceiroId]
    );

    return { ok: true, exId: atual.parceiroId, desde: atual.desde };
}

module.exports = {
    estado,
    validarPedido,
    casar,
    divorciar
};
