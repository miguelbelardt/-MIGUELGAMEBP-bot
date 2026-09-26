const {
    REST,
    Routes
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// =====================================================
// 🔐 CONFIGURAÇÕES
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
    console.error(
        "❌ A variável DISCORD_TOKEN não foi encontrada."
    );
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error(
        "❌ A variável CLIENT_ID não foi encontrada."
    );
    process.exit(1);
}

// =====================================================
// 📂 CARREGAR COMANDOS
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

const arquivos = fs
    .readdirSync(comandosPath)
    .filter(
        arquivo =>
            arquivo.endsWith(".js")
    );

for (const arquivo of arquivos) {
    try {
        const caminho =
            path.join(
                comandosPath,
                arquivo
            );

        const comando =
            require(caminho);

        if (
            comando.data &&
            comando.execute
        ) {
            const dados =
                comando.data.toJSON();

            // Permite comandos globais e também
            // comandos que definem seus próprios contexts.
            if (
                !dados.integration_types
            ) {
                dados.integration_types = [
                    0,
                    1
                ];
            }

            if (
                !dados.contexts
            ) {
                dados.contexts = [
                    0,
                    1,
                    2
                ];
            }

            comandos.push(dados);

            console.log(
                `✅ Carregado: /${dados.name}`
            );
        } else {
            console.log(
                `⚠️ Ignorado: ${arquivo}`
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
// 🚀 REDEPLOY
// =====================================================

async function redeploy() {
    console.log("");
    console.log(
        "🔄 Iniciando redeploy dos comandos..."
    );
    console.log(
        `📦 Total de comandos: ${comandos.length}`
    );

    const rest =
        new REST({
            version: "10"
        }).setToken(
            TOKEN
        );

    try {
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
            "✅ Comandos redeployados com sucesso!"
        );
        console.log(
            `📦 ${comandos.length} comando(s) registrado(s).`
        );

    } catch (erro) {
        console.error("");
        console.error(
            "❌ Erro ao fazer redeploy:",
            erro
        );

        process.exit(1);
    }
}

redeploy();
