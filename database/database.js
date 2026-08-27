const fs = require("fs");
const path = require("path");

const databasePath = path.join(__dirname, "data.json");

let data = {};

if (fs.existsSync(databasePath)) {
    try {
        data = JSON.parse(fs.readFileSync(databasePath, "utf8"));
    } catch (error) {
        console.error("❌ Erro ao carregar o banco de dados:", error);
        data = {};
    }
}

function salvar() {
    fs.writeFileSync(
        databasePath,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

function criarUsuario(userId) {
    if (!data[userId]) {
        data[userId] = {
            saldo: 0,
            ultimoDaily: 0,
            notificacaoDaily: false
        };

        salvar();
    }

    return data[userId];
}

function getSaldo(userId) {
    return criarUsuario(userId).saldo;
}

function adicionarSaldo(userId, quantidade) {
    const usuario = criarUsuario(userId);

    usuario.saldo += quantidade;

    salvar();

    return usuario.saldo;
}

function removerSaldo(userId, quantidade) {
    const usuario = criarUsuario(userId);

    if (usuario.saldo < quantidade) {
        return false;
    }

    usuario.saldo -= quantidade;

    salvar();

    return true;
}

function getUltimoDaily(userId) {
    return criarUsuario(userId).ultimoDaily;
}

function setUltimoDaily(userId, tempo) {
    const usuario = criarUsuario(userId);

    usuario.ultimoDaily = tempo;

    salvar();
}

function getNotificacaoDaily(userId) {
    return criarUsuario(userId).notificacaoDaily;
}

function setNotificacaoDaily(userId, ativado) {
    const usuario = criarUsuario(userId);

    usuario.notificacaoDaily = ativado;

    salvar();
}

module.exports = {
    getSaldo,
    adicionarSaldo,
    removerSaldo,
    getUltimoDaily,
    setUltimoDaily,
    getNotificacaoDaily,
    setNotificacaoDaily
};
