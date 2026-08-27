const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const http = require("http");
const fs = require("fs");
const path = require("path");

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
});

// Executar comandos Slash
client.on("interactionCreate", async interaction => {
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

// 🌐 Servidor HTTP para o Render
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("MIGUELGAMEBP-bot está online! 🤖");
}).listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

// 🔑 Token
client.login(process.env.DISCORD_TOKEN);
