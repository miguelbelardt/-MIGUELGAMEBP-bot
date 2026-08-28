const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const http = require("http");
const fs = require("fs");
const path = require("path");
const { inicializarBanco } = require("./database/database");

// =====================================================
// 🛡️ PROTEÇÃO E LOGS DE ERROS DO NODE
// =====================================================

process.on("unhandledRejection", erro => {
    console.error("❌ UNHANDLED REJECTION:", erro);
});

process.on("uncaughtException", erro => {
    console.error("❌ UNCAUGHT EXCEPTION:", erro);
});

process.on("warning", aviso => {
    console.warn("⚠️ NODE WARNING:", aviso);
});

// =====================================================
// 🌐 SERVIDOR HTTP PARA O RENDER
// =====================================================

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

// =====================================================
// 👑 ID DO DONO DO BOT
// =====================================================

const DONO_ID = "1124140396516225044";

// =====================================================
// 🔤 PREFIXO
// =====================================================

const PREFIXO = "m";

// =====================================================
// 🤖 CLIENTE DISCORD
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =====================================================
// 📦 COLEÇÃO DE COMANDOS
// =====================================================

client.commands = new Collection();

const comandosPath = path.join(__dirname, "comandos");

const arquivosComandos = fs
    .readdirSync(comandosPath)
    .filter(arquivo => arquivo.endsWith(".js"));

for (const arquivo of arquivosComandos) {
    try {
        const caminho = path.join(comandosPath, arquivo);
        const comando = require(caminho);

        if ("data" in comando && "execute" in comando) {
            client.commands.set(comando.data.name, comando);
            console.log(`✅ Comando carregado: ${comando.data.name}`);
        } else {
            console.log(`⚠️ Comando inválido: ${arquivo}`);
        }
    } catch (erro) {
        console.error(`❌ Erro ao carregar ${arquivo}:`, erro);
    }
}

// =====================================================
// 🟢 BOT ONLINE
// =====================================================

client.once("ready", () => {
    console.log(`🤖 Bot online como ${client.user.tag}`);

    client.user.setActivity("Minecraft", {
        type: 0
    });

    console.log("🎮 Status definido: Jogando Minecraft");
});

// =====================================================
// 🔌 EVENTOS DE CONEXÃO DO DISCORD
// =====================================================

client.on("error", erro => {
    console.error("❌ Erro no cliente Discord:", erro);
});

client.on("warn", aviso => {
    console.warn("⚠️ Aviso do Discord:", aviso);
});

client.on("shardDisconnect", (evento, shardId) => {
    console.error(
        `🔴 Discord desconectou o shard ${shardId}.`,
        evento
    );
});

client.on("shardReconnecting", shardId => {
    console.log(`🔄 Tentando reconectar o shard ${shardId}...`);
});

client.on("shardResume", (replayedEvents, shardId) => {
    console.log(
        `🟢 Conexão restaurada no shard ${shardId}. Eventos recuperados: ${replayedEvents}`
    );
});

// =====================================================
// 💬 COMANDOS POR PREFIXO
// =====================================================

client.on("messageCreate", async message => {
    if (message.author.bot) return;

    const conteudo = message.content.trim();

    if (!conteudo) return;

    // Aceita M ou m
    if (conteudo.charAt(0).toLowerCase() !== PREFIXO) {
        return;
    }

    // Remove o M/m
    const depoisDoPrefixo = conteudo.slice(1).trim();

    if (!depoisDoPrefixo) return;

    // Separa comando e argumentos
    const partes = depoisDoPrefixo.split(/\s+/);
    const nomeComando = partes.shift().toLowerCase();

    const comando = client.commands.get(nomeComando);

    if (!comando) return;

    console.log(
        `📩 Comando por prefixo: ${message.content}`
    );

    // =================================================
    // 📚 CENTRAL DE AJUDA
    // =================================================

    if (nomeComando === "ajuda") {
        try {
            const embed = {
                title: "📚 CENTRAL DE AJUDA",
                description:
                    `Olá! 👋\n` +
                    `Aqui você encontra informações sobre como usar o bot.\n\n` +

                    `🔤 **PREFIXO**\n` +
                    `O prefixo do bot é \`M\` ou \`m\`.\n\n` +

                    `Você pode usar:\n` +
                    `\`M ajuda\`\n` +
                    `\`m ajuda\`\n` +
                    `\`Majuda\`\n` +
                    `\`majuda\`\n\n` +

                    `📋 **COMANDOS**\n` +
                    `Use o botão abaixo para visualizar todos os comandos disponíveis.`
            };

            const botao = {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 1,
                        label: "📋 Ver comandos",
                        custom_id: "ajuda_comandos"
                    }
                ]
            };

            await message.reply({
                embeds: [embed],
                components: [botao]
            });

        } catch (erro) {
            console.error("❌ Erro no M ajuda:", erro);
        }

        return;
    }

    // =================================================
    // ⚠️ OUTROS COMANDOS
    // =================================================

    console.log(
        `⚠️ O comando ${nomeComando} ainda não possui suporte por prefixo.`
    );
});

// =====================================================
// 📩 INTERAÇÕES
// =====================================================

client.on("interactionCreate", async interaction => {

    console.log(
        `📩 Interação recebida: ${interaction.commandName || interaction.customId || "desconhecida"}`
    );

    // =================================================
    // 🔘 BOTÕES
    // =================================================

    if (interaction.isButton()) {

        // Botão do Daily
        if (interaction.customId === "daily_notificar") {
            const comando = client.commands.get("daily");

            if (
                comando &&
                typeof comando.handleButton === "function"
            ) {
                try {
                    await comando.handleButton(interaction);
                } catch (erro) {
                    console.error(
                        "❌ Erro no botão do daily:",
                        erro
                    );

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

        // Botão da Central de Ajuda
        if (interaction.customId === "ajuda_comandos") {
            const comando = client.commands.get("ajuda");

            if (
                comando &&
                typeof comando.handleButton === "function"
            ) {
                try {
                    await comando.handleButton(interaction);
                } catch (erro) {
                    console.error(
                        "❌ Erro no botão da ajuda:",
                        erro
                    );

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

        return;
    }

    // =================================================
    // 💬 SLASH COMMANDS
    // =================================================

    if (!interaction.isChatInputCommand()) return;

    const comando = client.commands.get(interaction.commandName);

    if (!comando) {
        console.log(
            `⚠️ Comando não encontrado: ${interaction.commandName}`
        );
        return;
    }

    try {
        await comando.execute(interaction);

        console.log(
            `✅ Comando executado: /${interaction.commandName}`
        );

    } catch (erro) {
        console.error(
            `❌ Erro no comando /${interaction.commandName}:`,
            erro
        );

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

// =====================================================
// 💾 BANCO + LOGIN DO DISCORD
// =====================================================

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
