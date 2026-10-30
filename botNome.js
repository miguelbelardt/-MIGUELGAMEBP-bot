// =====================================================
// 🤖 NOME DO BOT
// =====================================================
// O nome vem direto do Discord (o nome do bot no Developer
// Portal). Se você mudar o nome lá, todos os rodapés e
// textos que usam nomeBot() mudam sozinhos, sem mexer no código.
//
// O index.js chama definirBot(client) quando o bot fica online.

let nome = "Bot";

function definirBot(client) {
    const username =
        client?.user?.displayName ||
        client?.user?.username;

    if (username) {
        nome = username;
    }
}

function nomeBot() {
    return nome;
}

module.exports = {
    definirBot,
    nomeBot
};
