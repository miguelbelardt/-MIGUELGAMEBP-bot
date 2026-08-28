const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const http = require("http");
const fs = require("fs");
const path = require("path");
const { inicializarBanco } = require("./database/database");

// 🌐 Servidor HTTP para o Render
// Inicia primeiro para o Render detectar a porta imediatamente.
const PORT = process.env.PORT || 3000;

const servidor = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("MIGUELGAMEBP-bot está online! 🤖");
});

servidor.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

// 👑 ID DO DONO DO BOT
const DONO_ID = "1124140396516225044";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Coleção de comandos
client.commands = new Collection();

// Pasta dos comandos
const comandosPath = path.join(__dirname, "comandos");

// Carregar todos os arquivos .js da pasta comandos
const arquivosComandos = fs
    .readdirSync(comandosPath)
    .filter(arquivo => arquivo.endsWith(".js"));

for (const arquivo of arquivosComandos) {
    const caminho = path.join(comandosPath, arquivo);
    const comando = require(caminho);

    if ("data" in comando && "execute" in comando) {
        client.commands.set(comando.data.name, comando);
        console.log(`✅ Comando carregado: ${comando.data.name}`);
    } else {
        console.log(`⚠️ Comando inválido: ${arquivo}`);
    }
}

// Quando o bot estiver online
client.once("ready", () => {
    console.log(`🤖 Bot online como ${client.user.tag}`);

    // 🎮 Status do bot
    client.user.setActivity("Minecraft", {
        type: 0
    });

    console.log("🎮 Status definido: Jogando Minecraft");
});

// Erros do cliente Discord
client.on("error", erro => {
    console.error("❌ Erro no cliente Discord:", erro);
});

client.on("warn", aviso => {
    console.warn("⚠️ Aviso do Discord:", aviso);
});

// Interações
client.on("interactionCreate", async interaction => {

    // 🔘 Botões
    if (interaction.isButton()) {
        const comando = client.commands.get("daily");

        if (
            comando &&
            typeof comando.handleButton === "function"
        ) {
            try {
                await comando.handleButton(interaction);
            } catch (erro) {
                console.error(erro);

                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "❌ Ocorreu um erro ao processar o botão.",
                        ephemeral: true
                    });
                }
            }
        }

        return;
    }

    // Slash Commands
    if (!interaction.isChatInputCommand()) return;

    const comando = client.commands.get(interaction.commandName);

    if (!comando) return;

    try {
        await comando.execute(interaction);
    } catch (erro) {
        console.error(erro);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "❌ Ocorreu um erro ao executar esse comando.",
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: "❌ Ocorreu um erro ao executar esse comando.",
                ephemeral: true
            });
        }
    }
});

// 💾 Inicializar banco e conectar o bot
async function iniciar() {
    try {
        console.log("🚀 Iniciando bot...");

        console.log("💾 Conectando ao banco...");
        await inicializarBanco();
        console.log("💾 Banco de dados inicializado!");

        console.log("🔑 Tentando conectar ao Discord...");

        await client.login(process.env.DISCORD_TOKEN);

        console.log("🔑 Login do Discord concluído!");
    } catch (erro) {
        console.error("❌ Erro ao iniciar o bot:", erro);
        process.exit(1);
    }
}

iniciar();
