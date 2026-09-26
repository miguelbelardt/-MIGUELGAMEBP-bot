require("dotenv").config({
    path: ".secrets/.env"
});

const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

// =====================================================
// 🔐 CONFIGURAÇÕES
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// =====================================================
// 🛡️ VERIFICAR VARIÁVEIS
// =====================================================

if (!TOKEN) {
    console.error("❌ DISCORD_TOKEN não foi encontrado.");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("❌ CLIENT_ID não foi encontrado.");
    process.exit(1);
}

// =====================================================
// 📦 CARREGAR COMANDOS
// =====================================================

const comandos = [];

const comandosPath = path.join(
    __dirname,
    "comandos"
);

if (!fs.existsSync(comandosPath)) {
    console.error(
        "❌ A pasta 'comandos' não foi encontrada."
    );

    process.exit(1);
}

const arquivosComandos = fs
    .readdirSync(comandosPath)
    .filter(
        arquivo =>
            arquivo.endsWith(".js") &&
            !arquivo.startsWith("_")
    );

for (const arquivo of arquivosComandos) {
    try {
        const caminho = path.join(
            comandosPath,
            arquivo
        );

        const comando = require(caminho);

        if (
            "data" in comando &&
            "execute" in comando
        ) {
            const dados = comando.data.toJSON();

            // Só define os padrões se o comando
            // ainda não tiver esses valores.
            if (!dados.integration_types) {
                dados.integration_types = [0, 1];
            }

            if (!dados.contexts) {
                dados.contexts = [0, 1, 2];
            }

            comandos.push(dados);

            console.log(
                `📦 Preparado: /${dados.name}`
            );
        } else {
            console.log(
                `⚠️ Ignorado: ${arquivo} não possui data ou execute.`
            );
        }

    } catch (erro) {
        console.error(
            `❌ Erro ao carregar ${arquivo}:`,
            erro
        );
    }
}

// =====================================================
// 🔎 VERIFICAR DUPLICADOS
// =====================================================

const nomesComandos = comandos.map(
    comando => comando.name
);

const duplicados = nomesComandos.filter(
    (nome, index) =>
        nomesComandos.indexOf(nome) !== index
);

if (duplicados.length > 0) {
    console.error(
        `❌ Existem comandos duplicados: ${[
            ...new Set(duplicados)
        ].join(", ")}`
    );

    process.exit(1);
}

// =====================================================
// 🚀 REGISTRAR COMANDOS GLOBAIS
// =====================================================

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

(async () => {
    try {
        console.log("");

        console.log(
            `🔄 Limpando e registrando ${comandos.length} comandos globais...`
        );

        console.log(
            `🤖 Aplicação: ${CLIENT_ID}`
        );

        await rest.put(
            Routes.applicationCommands(
                CLIENT_ID
            ),
            {
                body: comandos
            }
        );

        console.log("");

        console.log(
            "✅ Comandos Slash globais registrados com sucesso!"
        );

        console.log(
            `📋 Total atual: ${comandos.length} comandos`
        );

        console.log(
            "🌐 Contextos: cada comando mantém sua configuração própria."
        );

        console.log(
            "👤 Instalação: servidor + usuário."
        );

    } catch (erro) {
        console.error("");

        console.error(
            "❌ Erro ao registrar comandos:"
        );

        console.error(erro);

        process.exit(1);
    }
})();
