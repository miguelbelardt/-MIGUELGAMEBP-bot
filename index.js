const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const http = require("http");
const fs = require("fs");
const path = require("path");
const {
    inicializarBanco,
    adicionarXP
} = require("./database/database");

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
// 🌐 SERVIDOR HTTP
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
// ⭐ SISTEMA DE XP
// =====================================================

const XP_MIN = 5;
const XP_MAX = 15;

// =====================================================
// 🤖 CLIENTE DISCORD
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
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

        const caminho =
            path.join(
                comandosPath,
                arquivo
            );

        const comando =
            require(caminho);

        if (
            "data" in comando &&
            "execute" in comando
        ) {

            client.commands.set(
                comando.data.name,
                comando
            );

            console.log(
                `✅ Comando carregado: ${comando.data.name}`
            );

        } else {

            console.log(
                `⚠️ Comando inválido: ${arquivo}`
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
// 🟢 BOT ONLINE
// =====================================================

client.once(
    "clientReady",
    async () => {

        console.log(
            `🤖 Bot online como ${client.user.tag}`
        );

        // =================================================
        // 🔔 SISTEMA AUTOMÁTICO DO DAILY
        // =================================================

        const comandoDaily =
            client.commands.get("daily");

        if (
            comandoDaily &&
            typeof comandoDaily.iniciarSistemaNotificacoes ===
                "function"
        ) {

            comandoDaily.iniciarSistemaNotificacoes(
                client
            );

        } else {

            console.log(
                "⚠️ Sistema automático de notificações do Daily não foi encontrado."
            );
        }

        // =================================================
        // 🎉 SISTEMA AUTOMÁTICO DOS SORTEIOS
        // =================================================

        const comandoSorteio =
            client.commands.get("sorteio");

        if (
            comandoSorteio &&
            typeof comandoSorteio.iniciarSistemaSorteios ===
                "function"
        ) {

            comandoSorteio.iniciarSistemaSorteios(
                client
            );

        } else {

            console.log(
                "⚠️ Sistema automático de sorteios não foi encontrado."
            );
        }

        // =================================================
        // 📋 REGISTRAR SLASH COMMANDS
        // =================================================

        try {

            const comandosSlash =
                [...client.commands.values()]
                    .map(
                        comando =>
                            comando.data.toJSON()
                    );

            await client.application.commands.set(
                comandosSlash
            );

            console.log(
                `📋 Slash Commands sincronizados: ${comandosSlash.length}`
            );

        } catch (erro) {

            console.error(
                "❌ Erro ao sincronizar Slash Commands:",
                erro
            );
        }

        // =================================================
        // 🔄 STATUS DO BOT
        // =================================================

        let mostrandoServidores = true;

        const atualizarStatus = () => {

            if (mostrandoServidores) {

                const servidores =
                    client.guilds.cache.size;

                client.user.setActivity(
                    `🌐 Estou em ${servidores} servidores`,
                    {
                        type: 0
                    }
                );

                console.log(
                    `🌐 Status: Estou em ${servidores} servidores`
                );

            } else {

                const comandos =
                    client.commands.size;

                client.user.setActivity(
                    `📋 Tenho ${comandos} comandos disponíveis!`,
                    {
                        type: 0
                    }
                );

                console.log(
                    `📋 Status: Tenho ${comandos} comandos disponíveis!`
                );
            }

            mostrandoServidores =
                !mostrandoServidores;
        };

        atualizarStatus();

        setInterval(
            atualizarStatus,
            5000
        );
    }
);

// =====================================================
// 🔌 EVENTOS DE CONEXÃO DO DISCORD
// =====================================================

client.on(
    "error",
    erro => {

        console.error(
            "❌ Erro no cliente Discord:",
            erro
        );
    }
);

client.on(
    "warn",
    aviso => {

        console.warn(
            "⚠️ Aviso do Discord:",
            aviso
        );
    }
);

client.on(
    "shardDisconnect",
    (evento, shardId) => {

        console.error(
            `🔴 Discord desconectou o shard ${shardId}.`,
            evento
        );
    }
);

client.on(
    "shardReconnecting",
    shardId => {

        console.log(
            `🔄 Tentando reconectar o shard ${shardId}...`
        );
    }
);

client.on(
    "shardResume",
    (replayedEvents, shardId) => {

        console.log(
            `🟢 Conexão restaurada no shard ${shardId}. Eventos recuperados: ${replayedEvents}`
        );
    }
);

// =====================================================
// 💬 COMANDOS POR PREFIXO + ⭐ XP
// =====================================================

client.on(
    "messageCreate",
    async message => {

        if (message.author.bot) return;

        // =================================================
        // ⭐ GANHAR XP POR MENSAGEM
        // =================================================

        if (message.guild) {

            const quantidadeXP =
                Math.floor(
                    Math.random() *
                    (XP_MAX - XP_MIN + 1)
                ) + XP_MIN;

            try {

                await adicionarXP(
                    message.author.id,
                    quantidadeXP
                );

                console.log(
                    `⭐ ${message.author.tag} ganhou ${quantidadeXP} XP`
                );

            } catch (erro) {

                console.error(
                    "❌ Erro ao adicionar XP:",
                    erro
                );
            }
        }

        // =================================================
        // 🔤 SISTEMA DE PREFIXO
        // =================================================

        const conteudo =
            message.content.trim();

        if (!conteudo) return;

        if (
            conteudo
                .charAt(0)
                .toLowerCase() !== PREFIXO
        ) {
            return;
        }

        const depoisDoPrefixo =
            conteudo
                .slice(1)
                .trim();

        if (!depoisDoPrefixo) return;

        const partes =
            depoisDoPrefixo.split(/\s+/);

        const nomeComando =
            partes
                .shift()
                .toLowerCase();

        const comando =
            client.commands.get(
                nomeComando
            );

        if (!comando) {

            console.log(
                `⚠️ Comando não encontrado: ${nomeComando}`
            );

            try {

                await message.reply(
                    "❌ Comando não encontrado!\n📋 Use `mhelp` para ver a lista de comandos."
                );

            } catch (erro) {

                console.error(
                    "❌ Não foi possível enviar a mensagem de comando não encontrado:",
                    erro
                );
            }

            return;
        }

        console.log(
            `📩 Comando por prefixo: ${message.content}`
        );

        if (
            typeof comando.handlePrefix ===
            "function"
        ) {

            try {

                await comando.handlePrefix(
                    message,
                    partes
                );

                console.log(
                    `✅ Comando por prefixo executado: ${message.content}`
                );

            } catch (erro) {

                console.error(
                    `❌ Erro no comando por prefixo ${nomeComando}:`,
                    erro
                );

                try {

                    await message.reply(
                        "❌ Deu erro ao executar esse comando.\n🔄 Tente novamente mais tarde."
                    );

                } catch (erroResposta) {

                    console.error(
                        "❌ Não foi possível enviar a mensagem de erro:",
                        erroResposta
                    );
                }
            }

            return;
        }

        console.log(
            `⚠️ O comando ${nomeComando} ainda não possui suporte por prefixo.`
        );

        try {

            await message.reply(
                "⚠️ Esse comando ainda não pode ser usado pelo prefixo.\n📋 Use `mhelp` para ver os comandos disponíveis."
            );

        } catch (erro) {

            console.error(
                "❌ Não foi possível enviar a mensagem:",
                erro
            );
        }
    }
);

// =====================================================
// 📩 INTERAÇÕES
// =====================================================

client.on(
    "interactionCreate",
    async interaction => {

        console.log(
            `📩 Interação recebida: ${
                interaction.commandName ||
                interaction.customId ||
                "desconhecida"
            }`
        );

        // =================================================
        // 🔘 BOTÕES
        // =================================================

        if (interaction.isButton()) {

            // =================================================
            // 🔔 DAILY
            // =================================================

            if (
                interaction.customId ===
                "daily_notificar"
            ) {

                const comando =
                    client.commands.get(
                        "daily"
                    );

                if (
                    comando &&
                    typeof comando.handleButton ===
                    "function"
                ) {

                    try {

                        await comando.handleButton(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no botão do daily:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao executar esse comando.",
                                ephemeral: true
                            });
                        }
                    }
                }

                return;
            }

            // =================================================
            // ❓ AJUDA
            // =================================================

            if (
                interaction.customId ===
                "ajuda_comandos"
            ) {

                const comando =
                    client.commands.get(
                        "ajuda"
                    );

                if (
                    comando &&
                    typeof comando.handleButton ===
                    "function"
                ) {

                    try {

                        await comando.handleButton(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no botão da ajuda:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao executar esse comando.",
                                ephemeral: true
                            });
                        }
                    }
                }

                return;
            }

            // =================================================
            // 📝 EMBED
            // =================================================

            if (
                interaction.customId.startsWith(
                    "embed_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "embed"
                    );

                if (
                    comando &&
                    typeof comando.handleButton ===
                    "function"
                ) {

                    try {

                        await comando.handleButton(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no botão do embed:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao executar esse comando.",
                                ephemeral: true
                            });
                        }
                    }
                }

                return;
            }

            // =================================================
            // 🎉 SORTEIO
            // =================================================

            if (
                interaction.customId.startsWith(
                    "sorteio_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "sorteio"
                    );

                if (
                    comando &&
                    typeof comando.handleButton ===
                    "function"
                ) {

                    try {

                        await comando.handleButton(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no botão do sorteio:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao executar o sorteio.",
                                ephemeral: true
                            });
                        }
                    }
                }

                return;
            }

            // =================================================
            // 🪨📄✂️ PEDRA PAPEL TESOURA
            // =================================================

            if (
                interaction.customId.startsWith(
                    "ppt_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "ppt"
                    );

                if (
                    comando &&
                    typeof comando.handleButton ===
                    "function"
                ) {

                    try {

                        await comando.handleButton(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no botão do PPT:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao jogar Pedra, Papel e Tesoura.",
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
        // 📝 MODAIS
        // =================================================

        if (
            interaction.isModalSubmit()
        ) {

            // =================================================
            // 📝 EMBED
            // =================================================

            if (
                interaction.customId.startsWith(
                    "embed_modal_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "embed"
                    );

                if (
                    comando &&
                    typeof comando.handleModal ===
                    "function"
                ) {

                    try {

                        await comando.handleModal(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no modal do embed:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao executar esse comando.",
                                ephemeral: true
                            });
                        }
                    }
                }

                return;
            }

            // =================================================
            // 🎉 SORTEIO
            // =================================================

            if (
                interaction.customId.startsWith(
                    "sorteio_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "sorteio"
                    );

                if (
                    comando &&
                    typeof comando.handleModal ===
                    "function"
                ) {

                    try {

                        await comando.handleModal(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no modal do sorteio:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao configurar o sorteio.",
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

        if (
            !interaction.isChatInputCommand()
        ) {
            return;
        }

        const comando =
            client.commands.get(
                interaction.commandName
            );

        if (!comando) {

            console.log(
                `⚠️ Comando não encontrado: ${interaction.commandName}`
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({
                    content:
                        "❌ Comando não encontrado!",
                    ephemeral: true
                });
            }

            return;
        }

        try {

            await comando.execute(
                interaction
            );

            console.log(
                `✅ Comando executado: /${interaction.commandName}`
            );

        } catch (erro) {

            console.error(
                `❌ Erro no comando /${interaction.commandName}:`,
                erro
            );

            try {

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp({
                        content:
                            "❌ Deu erro ao executar esse comando.\n🔄 Tente novamente mais tarde.",
                        ephemeral: true
                    });

                } else {

                    await interaction.reply({
                        content:
                            "❌ Deu erro ao executar esse comando.\n🔄 Tente novamente mais tarde.",
                        ephemeral: true
                    });
                }

            } catch (erroResposta) {

                console.error(
                    "❌ Não foi possível enviar a mensagem de erro:",
                    erroResposta
                );
            }
        }
    }
);

// =====================================================
// 💾 BANCO + LOGIN DO DISCORD
// =====================================================

async function iniciar() {

    try {

        console.log(
            "🚀 Iniciando bot..."
        );

        console.log(
            "💾 Conectando ao banco..."
        );

        await inicializarBanco();

        console.log(
            "💾 Banco de dados inicializado!"
        );

        console.log(
            "🔑 Tentando conectar ao Discord..."
        );

        await client.login(
            process.env.DISCORD_TOKEN
        );

        console.log(
            "🔑 Login do Discord concluído!"
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao iniciar o bot:",
            erro
        );

        process.exit(1);
    }
}

iniciar();
