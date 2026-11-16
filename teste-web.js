// =====================================================
// 🌐 TESTE WEB (temporário)
// =====================================================
// Só serve para descobrir se a FadeHost dá um endereço público
// para a porta do bot. Depois do teste, pode apagar este arquivo
// e a linha dele no index.js.
//
// Para ligar: no index.js, junto das outras linhas "iniciar", coloque:
//   require("./teste-web.js").iniciar(client);

const http = require("http");

function iniciar(client) {
    const porta = Number(process.env.PORT) || 8080;

    const servidor = http.createServer((req, res) => {
        if (req.url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });

            return res.end(JSON.stringify({
                ok: true,
                bot: client.user?.tag || null,
                pronto: client.isReady?.() ?? false
            }));
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

        res.end(
            "<!doctype html><meta charset=utf-8><title>Bot online</title>" +
            "<body style=\"font-family:system-ui;text-align:center;padding:60px\">" +
            "<h1>🌙 Funcionando!</h1>" +
            `<p>O bot ${client.user?.tag || ""} respondeu pela web.</p></body>`
        );
    });

    servidor.on("error", erro => {
        console.error("⚠️ Teste web não conseguiu ligar:", erro.message);
    });

    servidor.listen(porta, "0.0.0.0", () => {
        console.log(`🌐 Teste web ligado na porta ${porta}.`);
    });
}

module.exports = { iniciar };
