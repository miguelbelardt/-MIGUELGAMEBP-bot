const {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
    EmbedBuilder,
    AttachmentBuilder
} = require("discord.js");

const http = require("http");
const fs = require("fs");
const path = require("path");

const {
    inicializarBanco,
    adicionarXP
} = require("./database/database");

const logs = require("./comandos/logs");

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
    console.log(
        `🌐 Servidor HTTP rodando na porta ${PORT}`
    );
});

// =====================================================
// 👑 ID DO DONO DO BOT
// =====================================================

const DONO_ID = "1124140396516225044";

// =====================================================
// 🔤 PREFIXO
// =====================================================

const PREFIXO = "'";

// =====================================================
// ⭐ SISTEMA DE XP
// =====================================================

const XP_MIN = 5;
const XP_MAX = 15;

// =====================================================
// 🗑️ SISTEMA DE MENSAGENS APAGADAS
// =====================================================

const mensagensRecentes = new Map();

const exclusoesPendentes = new Map();

const TEMPO_CACHE_MENSAGEM = 10 * 60 * 1000;

const TEMPO_AGRUPAMENTO = 1000;

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
// 📋 DISPONIBILIZAR SISTEMA DE LOGS NO CLIENT
// =====================================================

client.registrarLog = logs.registrarLog;

// =====================================================
// 🗑️ FUNÇÃO PARA GUARDAR MENSAGEM RECENTE
// =====================================================

function guardarMensagemRecente(message) {
    if (!message?.id) return;

    if (!message.guild) return;

    const dados = {
        id: message.id,

        guildId:
            message.guild.id,

        guildNome:
            message.guild.name || "Servidor desconhecido",

        canalId:
            message.channel?.id || null,

        canalNome:
            message.channel?.name || "Canal desconhecido",

        autorId:
            message.author?.id || null,

        autorTag:
            message.author?.tag ||
            message.author?.username ||
            "Usuário desconhecido",

        autorNome:
            message.author?.username ||
            "Usuário desconhecido",

        conteudo:
            message.content || "",

        anexos:
            message.attachments
                ? [...message.attachments.values()].map(
                    anexo => ({
                        nome:
                            anexo.name ||
                            "arquivo",

                        url:
                            anexo.url
                    })
                )
                : [],

        criadoEm:
            message.createdTimestamp ||
            Date.now()
    };

    mensagensRecentes.set(
        message.id,
        dados
    );

    setTimeout(() => {

        const atual =
            mensagensRecentes.get(
                message.id
            );

        if (
            atual &&
            Date.now() -
            atual.criadoEm >=
            TEMPO_CACHE_MENSAGEM
        ) {

            mensagensRecentes.delete(
                message.id
            );
        }

    }, TEMPO_CACHE_MENSAGEM + 1000);
}

// =====================================================
// 🗑️ PEGAR DADOS DA MENSAGEM APAGADA
// =====================================================

function obterDadosMensagemApagada(message) {

    if (!message?.id) {
        return null;
    }

    const dadosCache =
        mensagensRecentes.get(
            message.id
        );

    if (dadosCache) {

        mensagensRecentes.delete(
            message.id
        );

        return dadosCache;
    }

    return {
        id:
            message.id,

        guildId:
            message.guild?.id ||
            null,

        guildNome:
            message.guild?.name ||
            "Servidor desconhecido",

        canalId:
            message.channel?.id ||
            null,

        canalNome:
            message.channel?.name ||
            "Canal desconhecido",

        autorId:
            message.author?.id ||
            null,

        autorTag:
            message.author?.tag ||
            message.author?.username ||
            "Usuário desconhecido",

        autorNome:
            message.author?.username ||
            "Usuário desconhecido",

        conteudo:
            message.content ||
            "",

        anexos:
            message.attachments
                ? [...message.attachments.values()].map(
                    anexo => ({
                        nome:
                            anexo.name ||
                            "arquivo",

                        url:
                            anexo.url
                    })
                )
                : [],

        criadoEm:
            message.createdTimestamp ||
            Date.now()
    };
}

// =====================================================
// 📝 FORMATAR UMA MENSAGEM APAGADA
// =====================================================

function formatarMensagemApagada(
    dados,
    numero
) {

    const data =
        new Date(
            dados.criadoEm ||
            Date.now()
        );

    const horario =
        data.toLocaleString(
            "pt-BR",
            {
                timeZone:
                    "America/Sao_Paulo"
            }
        );

    let texto =
        `========================================\n` +
        `MENSAGEM ${numero}\n` +
        `========================================\n\n` +

        `ID da mensagem: ${
            dados.id ||
            "Desconhecido"
        }\n` +

        `Autor: ${
            dados.autorTag ||
            "Desconhecido"
        }\n` +

        `ID do autor: ${
            dados.autorId ||
            "Desconhecido"
        }\n` +

        `Canal: #${
            dados.canalNome ||
            "Desconhecido"
        }\n` +

        `ID do canal: ${
            dados.canalId ||
            "Desconhecido"
        }\n` +

        `Servidor: ${
            dados.guildNome ||
            "Desconhecido"
        }\n` +

        `ID do servidor: ${
            dados.guildId ||
            "Desconhecido"
        }\n` +

        `Horário: ${horario}\n\n` +

        `Mensagem:\n` +

        `${
            dados.conteudo ||
            "[Conteúdo não disponível]"
        }\n`;

    if (
        dados.anexos?.length > 0
    ) {

        texto +=
            `\nAnexos:\n`;

        for (
            const anexo
            of dados.anexos
        ) {

            texto +=
                `- ${
                    anexo.nome
                }: ${
                    anexo.url
                }\n`;
        }
    }

    texto +=
        `\n----------------------------------------\n\n`;

    return texto;
}

// =====================================================
// 📄 CRIAR ARQUIVO DAS MENSAGENS APAGADAS
// =====================================================

function criarArquivoMensagensApagadas(
    mensagens
) {

    if (
        !mensagens ||
        mensagens.length === 0
    ) {
        return Buffer.from(
            "Nenhuma mensagem encontrada.",
            "utf8"
        );
    }

    const primeira =
        mensagens[0];

    let conteudo =
        `========================================\n` +
        `MENSAGENS APAGADAS\n` +
        `========================================\n\n` +

        `Servidor: ${
            primeira.guildNome ||
            "Desconhecido"
        }\n` +

        `ID do servidor: ${
            primeira.guildId ||
            "Desconhecido"
        }\n` +

        `Quantidade: ${
            mensagens.length
        }\n` +

        `Data do registro: ${
            new Date().toLocaleString(
                "pt-BR",
                {
                    timeZone:
                        "America/Sao_Paulo"
                }
            )
        }\n\n`;

    mensagens.forEach(
        (
            mensagem,
            index
        ) => {

            conteudo +=
                formatarMensagemApagada(
                    mensagem,
                    index + 1
                );
        }
    );

    return Buffer.from(
        conteudo,
        "utf8"
    );
}

// =====================================================
// 🗑️ ENVIAR LOG DE MENSAGEM APAGADA
// =====================================================

async function enviarLogMensagemApagada(
    guild,
    mensagens
) {

    if (
        !guild ||
        !mensagens ||
        mensagens.length === 0
    ) {
        return;
    }

    const mensagensDoServidor =
        mensagens.filter(
            mensagem =>
                mensagem.guildId ===
                guild.id
        );

    if (
        mensagensDoServidor.length === 0
    ) {
        return;
    }

    const config =
        await buscarConfigLog(
            guild.id,
            "mensagens_apagadas"
        );

    if (!config) {
        return;
    }

    const canal =
        guild.channels.cache.get(
            config.canal_id
        );

    if (
        !canal ||
        !canal.isTextBased()
    ) {
        return;
    }

    try {

        if (
            mensagensDoServidor.length === 1
        ) {

            const mensagem =
                mensagensDoServidor[0];

            const data =
                new Date(
                    mensagem.criadoEm ||
                    Date.now()
                );

            let descricao =
                `👤 **Autor:** ${
                    mensagem.autorId
                        ? `<@${mensagem.autorId}>`
                        : "Desconhecido"
                }\n` +

                `📢 **Canal:** ${
                    mensagem.canalId
                        ? `<#${mensagem.canalId}>`
                        : "Desconhecido"
                }\n\n` +

                `💬 **Mensagem:**\n` +

                `> ${
                    mensagem.conteudo
                        ? mensagem.conteudo
                            .substring(
                                0,
                                3900
                            )
                        : "[Conteúdo não disponível]"
                }`;

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        "🗑️ Mensagem apagada"
                    )
                    .setDescription(
                        descricao
                    )
                    .setColor(
                        0xED4245
                    )
                    .setTimestamp(
                        data
                    );

            if (
                mensagem.anexos?.length > 0
            ) {

                const anexosTexto =
                    mensagem.anexos
                        .map(
                            anexo =>
                                `[${anexo.nome}](${anexo.url})`
                        )
                        .join("\n");

                embed.addFields({
                    name:
                        "📎 Anexos",

                    value:
                        anexosTexto
                            .substring(
                                0,
                                1024
                            )
                });
            }

            await canal.send({
                embeds: [
                    embed
                ]
            });

            return;
        }

        const arquivo =
            criarArquivoMensagensApagadas(
                mensagensDoServidor
            );

        const nomeArquivo =
            `mensagens-apagadas-${
                Date.now()
            }.txt`;

        const anexo =
            new AttachmentBuilder(
                arquivo,
                {
                    name:
                        nomeArquivo
                }
            );

        const primeira =
            mensagensDoServidor[0];

        const canaisDiferentes =
            new Set(
                mensagensDoServidor
                    .map(
                        mensagem =>
                            mensagem.canalId
                    )
                    .filter(Boolean)
            );

        let canalTexto;

        if (
            canaisDiferentes.size === 1
        ) {

            canalTexto =
                primeira.canalId
                    ? `<#${primeira.canalId}>`
                    : "Desconhecido";

        } else {

            canalTexto =
                "Vários canais";
        }

        const embed =
            new EmbedBuilder()
                .setTitle(
                    "🗑️ Mensagens apagadas em massa"
                )
                .setDescription(
                    `📊 **Quantidade:** ${
                        mensagensDoServidor.length
                    } mensagens\n` +

                    `📢 **Canal:** ${
                        canalTexto
                    }\n\n` +

                    `📎 As mensagens apagadas foram salvas no arquivo abaixo.`
                )
                .setColor(
                    0xED4245
                )
                .setTimestamp();

        await canal.send({
            embeds: [
                embed
            ],

            files: [
                anexo
            ]
        });

    } catch (erro) {

        console.error(
            "❌ Erro ao registrar mensagens apagadas:",
            erro
        );
    }
}

// =====================================================
// 🔎 BUSCAR CONFIGURAÇÃO DE LOG
// =====================================================

async function buscarConfigLog(
    guildId,
    tipo
) {

    try {

        const resultado =
            await logsBuscarConfig(
                guildId,
                tipo
            );

        return resultado;

    } catch (erro) {

        console.error(
            `❌ Erro ao buscar configuração do log ${tipo}:`,
            erro
        );

        return null;
    }
}

// =====================================================
// 🔎 FUNÇÃO INTERNA PARA CONSULTAR LOGS
// =====================================================

async function logsBuscarConfig(
    guildId,
    tipo
) {

    const resultado =
        await require(
            "./database/database"
        )
            .pool
            .query(
                `
                SELECT canal_id
                FROM logs_config
                WHERE guild_id = ?
                  AND tipo = ?
                `,
                [
                    guildId,
                    tipo
                ]
            );

    return (
        resultado.rows[0] ||
        null
    );
}

// =====================================================
// 🗑️ ADICIONAR MENSAGEM AO GRUPO DE EXCLUSÕES
// =====================================================

function adicionarMensagemAoGrupo(
    guild,
    dados
) {

    if (
        !guild ||
        !dados
    ) {
        return;
    }

    const guildId =
        guild.id;

    let grupo =
        exclusoesPendentes.get(
            guildId
        );

    if (!grupo) {

        grupo = {
            guildId,
            mensagens: [
                dados
            ],
            timer: null
        };

        exclusoesPendentes.set(
            guildId,
            grupo
        );

        grupo.timer =
            setTimeout(
                async () => {

                    const atual =
                        exclusoesPendentes.get(
                            guildId
                        );

                    if (
                        !atual ||
                        atual !== grupo
                    ) {
                        return;
                    }

                    exclusoesPendentes.delete(
                        guildId
                    );

                    try {

                        await enviarLogMensagemApagada(
                            guild,
                            atual.mensagens
                        );

                    } catch (erro) {

                        console.error(
                            `❌ Erro ao finalizar grupo de mensagens apagadas no servidor ${guildId}:`,
                            erro
                        );
                    }

                },
                TEMPO_AGRUPAMENTO
            );

        return;
    }

    grupo.mensagens.push(
        dados
    );
}

// =====================================================
// 🗑️ EVENTO DE UMA MENSAGEM APAGADA
// =====================================================

client.on(
    "messageDelete",
    async message => {

        try {

            if (
                !message ||
                !message.guild
            ) {
                return;
            }

            const dados =
                obterDadosMensagemApagada(
                    message
                );

            if (!dados) {
                return;
            }

            adicionarMensagemAoGrupo(
                message.guild,
                dados
            );

        } catch (erro) {

            console.error(
                "❌ Erro no evento messageDelete:",
                erro
            );
        }
    }
);

// =====================================================
// 🗑️ EVENTO DE VÁRIAS MENSAGENS APAGADAS
// =====================================================

client.on(
    "messageDeleteBulk",
    async mensagens => {

        try {

            if (
                !mensagens ||
                mensagens.size === 0
            ) {
                return;
            }

            const primeiraMensagem =
                mensagens.first();

            if (
                !primeiraMensagem ||
                !primeiraMensagem.guild
            ) {
                return;
            }

            const guild =
                primeiraMensagem.guild;

            for (
                const message
                of mensagens.values()
            ) {

                if (
                    message.guild?.id !==
                    guild.id
                ) {
                    continue;
                }

                const dados =
                    obterDadosMensagemApagada(
                        message
                    );

                if (!dados) {
                    continue;
                }

                adicionarMensagemAoGrupo(
                    guild,
                    dados
                );
            }

        } catch (erro) {

            console.error(
                "❌ Erro no evento messageDeleteBulk:",
                erro
            );
        }
    }
);

// =====================================================
// 🎙️ LOGS DE VOZ SEPARADOS
// =====================================================

client.on(
    "voiceStateUpdate",
    async (oldState, newState) => {

        try {

            // =========================================
            // 🛑 GARANTIR QUE É UM SERVIDOR
            // =========================================

            if (
                !newState.guild
            ) {
                return;
            }

            // =========================================
            // 🆔 MEMBRO
            // =========================================

            const membro =
                newState.member ||
                oldState.member;

            if (!membro) {
                return;
            }

            const guild =
                newState.guild;

            const usuario =
                `<@${membro.id}>`;

            // =========================================
            // 🎙️ ENTROU EM UM CANAL DE VOZ
            // =========================================

            if (
                !oldState.channelId &&
                newState.channelId
            ) {

                const canal =
                    newState.channel;

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "🎙️ Membro entrou em call"
                        )
                        .setDescription(
                            `${usuario} entrou no canal de voz ${canal ? canal : "desconhecido"}.`
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Membro",

                                value:
                                    `${membro.user.tag}\n\`${membro.id}\``
                            },
                            {
                                name:
                                    "🎙️ Canal",

                                value:
                                    canal
                                        ? `${canal}\n\`${canal.id}\``
                                        : "Desconhecido"
                            }
                        )
                        .setColor(
                            0x5865F2
                        )
                        .setTimestamp();

                await client.registrarLog(
                    guild,
                    "voz_entrada",
                    embed
                );

                return;
            }

            // =========================================
            // 🔴 SAIU DE UM CANAL DE VOZ
            // =========================================

            if (
                oldState.channelId &&
                !newState.channelId
            ) {

                const canal =
                    oldState.channel;

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "🔴 Membro saiu da call"
                        )
                        .setDescription(
                            `${usuario} saiu do canal de voz ${canal ? canal : "desconhecido"}.`
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Membro",

                                value:
                                    `${membro.user.tag}\n\`${membro.id}\``
                            },
                            {
                                name:
                                    "🎙️ Canal anterior",

                                value:
                                    canal
                                        ? `${canal}\n\`${canal.id}\``
                                        : "Desconhecido"
                            }
                        )
                        .setColor(
                            0xED4245
                        )
                        .setTimestamp();

                await client.registrarLog(
                    guild,
                    "voz_saida",
                    embed
                );

                return;
            }

            // =========================================
            // 🔄 MUDOU DE CANAL
            // =========================================

            if (
                oldState.channelId &&
                newState.channelId &&
                oldState.channelId !==
                    newState.channelId
            ) {

                const canalAnterior =
                    oldState.channel;

                const canalNovo =
                    newState.channel;

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "🔄 Membro mudou de canal"
                        )
                        .setDescription(
                            `${usuario} mudou de um canal de voz para outro.`
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Membro",

                                value:
                                    `${membro.user.tag}\n\`${membro.id}\``
                            },
                            {
                                name:
                                    "📤 Saiu de",

                                value:
                                    canalAnterior
                                        ? `${canalAnterior}\n\`${canalAnterior.id}\``
                                        : "Desconhecido"
                            },
                            {
                                name:
                                    "📥 Entrou em",

                                value:
                                    canalNovo
                                        ? `${canalNovo}\n\`${canalNovo.id}\``
                                        : "Desconhecido"
                            }
                        )
                        .setColor(
                            0xFEE75C
                        )
                        .setTimestamp();

                await client.registrarLog(
                    guild,
                    "voz_mudanca",
                    embed
                );

                return;
            }

        } catch (erro) {

            console.error(
                "❌ Erro no sistema de logs de voz:",
                erro
            );
        }
    }
);

// =====================================================
// 📦 COLEÇÃO DE COMANDOS
// =====================================================

client.commands =
    new Collection();

const comandosPath =
    path.join(
        __dirname,
        "comandos"
    );

if (
    !fs.existsSync(
        comandosPath
    )
) {

    console.error(
        "❌ A pasta 'comandos' não foi encontrada!"
    );

    process.exit(1);
}

const arquivosComandos =
    fs
        .readdirSync(
            comandosPath
        )
        .filter(
            arquivo =>
                arquivo.endsWith(
                    ".js"
                )
        );

for (
    const arquivo
    of arquivosComandos
) {

    try {

        const caminho =
            path.join(
                comandosPath,
                arquivo
            );

        const comando =
            require(
                caminho
            );

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
// 🚀 REGISTRAR COMANDOS SLASH AUTOMATICAMENTE
// =====================================================

async function registrarComandos() {

    const TOKEN =
        process.env.DISCORD_TOKEN;

    const CLIENT_ID =
        process.env.CLIENT_ID;

    if (!TOKEN) {

        console.error(
            "❌ DISCORD_TOKEN não foi encontrado."
        );

        throw new Error(
            "DISCORD_TOKEN não configurado."
        );
    }

    if (!CLIENT_ID) {

        console.error(
            "❌ CLIENT_ID não foi encontrado."
        );

        throw new Error(
            "CLIENT_ID não configurado."
        );
    }

    const comandos = [];

    for (
        const [nome, comando]
        of client.commands
    ) {

        try {

            const dados =
                comando.data.toJSON();

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

            comandos.push(
                dados
            );

            console.log(
                `📦 Preparado para registro: /${nome}`
            );

        } catch (erro) {

            console.error(
                `❌ Erro ao preparar /${nome}:`,
                erro
            );
        }
    }

    // =================================================
    // 🔎 VERIFICAR DUPLICADOS
    // =================================================

    const nomesComandos =
        comandos.map(
            comando =>
                comando.name
        );

    const duplicados =
        nomesComandos.filter(
            (
                nome,
                index
            ) =>
                nomesComandos.indexOf(
                    nome
                ) !== index
        );

    if (
        duplicados.length > 0
    ) {

        throw new Error(
            `Comandos duplicados encontrados: ${
                [
                    ...new Set(
                        duplicados
                    )
                ].join(
                    ", "
                )
            }`
        );
    }

    // =================================================
    // 🌐 REGISTRO GLOBAL
    // =================================================

    const rest =
        new REST({
            version:
                "10"
        }).setToken(
            TOKEN
        );

    console.log("");

    console.log(
        `🔄 Registrando ${comandos.length} comandos Slash...`
    );

    console.log(
        `🤖 CLIENT_ID: ${CLIENT_ID}`
    );

    try {

        await rest.put(
            Routes.applicationCommands(
                CLIENT_ID
            ),
            {
                body:
                    comandos
            }
        );

        console.log("");

        console.log(
            "✅ Comandos Slash globais registrados com sucesso!"
        );

        console.log(
            `📋 Total registrado: ${comandos.length}`
        );

    } catch (erro) {

        console.error("");
        console.error(
            "❌ Erro ao registrar os comandos Slash:"
        );

        console.error(
            erro
        );

        throw erro;
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

        const atualizarStatusInicializacao =
            async () => {

                try {

                    await client.user.setPresence({
                        status:
                            "idle",

                        activities: [
                            {
                                name:
                                    "🔄 Iniciando o bot...",

                                type:
                                    0
                            }
                        ]
                    });

                } catch (erro) {

                    console.error(
                        "❌ Erro ao atualizar status de inicialização:",
                        erro
                    );
                }
            };

        await atualizarStatusInicializacao();

        console.log(
            "🟡 Status: Ausente — Iniciando o bot..."
        );

        // =================================================
        // 🔔 SISTEMA AUTOMÁTICO DO DAILY
        // =================================================

        const comandoDaily =
            client.commands.get(
                "daily"
            );

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
            client.commands.get(
                "sorteio"
            );

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
        // ⏳ 15 SEGUNDOS AUSENTE
        // =================================================

        console.log(
            "⏳ Bot ficará Ausente durante 15 segundos..."
        );

        for (
            let segundo = 1;
            segundo <= 15;
            segundo++
        ) {

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        1000
                    )
            );

            await atualizarStatusInicializacao();

            console.log(
                `🟡 Status: Ausente — ${segundo}/15`
            );
        }

        // =================================================
        // 🟢 STATUS NORMAL DO BOT
        // =================================================

        let mostrandoServidores =
            true;

        const atualizarStatus =
            async () => {

                try {

                    let texto;

                    if (
                        mostrandoServidores
                    ) {

                        const servidores =
                            client.guilds.cache.size;

                        texto =
                            `🌐 Estou em ${servidores} servidores`;

                    } else {

                        const comandos =
                            client.commands.size;

                        texto =
                            `📋 Tenho ${comandos} comandos disponíveis!`;
                    }

                    await client.user.setPresence({
                        status:
                            "online",

                        activities: [
                            {
                                name:
                                    texto,

                                type:
                                    0
                            }
                        ]
                    });

                    console.log(
                        `${texto}`
                    );

                    mostrandoServidores =
                        !mostrandoServidores;

                } catch (erro) {

                    console.error(
                        "❌ Erro ao atualizar status normal:",
                        erro
                    );
                }
            };

        await atualizarStatus();

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
    (
        evento,
        shardId
    ) => {

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
    (
        replayedEvents,
        shardId
    ) => {

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

        if (
            message.guild
        ) {

            guardarMensagemRecente(
                message
            );
        }

        if (
            message.author.bot
        ) {
            return;
        }

        if (
            message.guild
        ) {

            const quantidadeXP =
                Math.floor(
                    Math.random() *
                    (
                        XP_MAX -
                        XP_MIN +
                        1
                    )
                ) +
                XP_MIN;

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

        const conteudo =
            message.content.trim();

        if (!conteudo) {
            return;
        }

        if (
            conteudo
                .charAt(0)
                .toLowerCase() !==
            PREFIXO
        ) {

            return;
        }

        const depoisDoPrefixo =
            conteudo
                .slice(1)
                .trim();

        if (
            !depoisDoPrefixo
        ) {
            return;
        }

        const partes =
            depoisDoPrefixo.split(
                /\s+/
            );

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
                    "❌ Comando não encontrado!\n📋 Use `'help` para ver a lista de comandos."
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
                "⚠️ Esse comando ainda não pode ser usado pelo prefixo.\n📋 Use `'help` para ver os comandos disponíveis."
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
        // 🔎 AUTOCOMPLETE
        // =================================================

        if (
            interaction.isAutocomplete()
        ) {

            const comando =
                client.commands.get(
                    interaction.commandName
                );

            if (
                comando &&
                typeof comando.autocomplete ===
                    "function"
            ) {

                try {

                    await comando.autocomplete(
                        interaction
                    );

                } catch (erro) {

                    console.error(
                        `❌ Erro no autocomplete do comando /${interaction.commandName}:`,
                        erro
                    );

                    try {

                        await interaction.respond(
                            []
                        );

                    } catch (
                        erroResposta
                    ) {

                        console.error(
                            "❌ Não foi possível responder ao autocomplete:",
                            erroResposta
                        );
                    }
                }

            } else {

                try {

                    await interaction.respond(
                        []
                    );

                } catch (erro) {

                    console.error(
                        "❌ Não foi possível responder ao autocomplete:",
                        erro
                    );
                }
            }

            return;
        }

        // =================================================
        // 📋 SISTEMA DE LOGS
        // =================================================

        if (
            interaction.customId &&
            interaction.customId.startsWith(
                "logs_"
            )
        ) {

            const comandoLogs =
                client.commands.get(
                    "logs"
                );

            if (
                comandoLogs &&
                typeof comandoLogs.handleInteraction ===
                    "function"
            ) {

                try {

                    await comandoLogs.handleInteraction(
                        interaction
                    );

                } catch (erro) {

                    console.error(
                        "❌ Erro no sistema de logs:",
                        erro
                    );

                    try {

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao executar o sistema de logs.",

                                ephemeral:
                                    true
                            });
                        }

                    } catch (
                        erroResposta
                    ) {

                        console.error(
                            "❌ Não foi possível responder ao erro do sistema de logs:",
                            erroResposta
                        );
                    }
                }

            } else {

                console.error(
                    "❌ O comando logs não foi carregado."
                );
            }

            return;
        }

        // =================================================
        // 📋 MENUS DE SELEÇÃO
        // =================================================

        if (
            interaction.isAnySelectMenu()
        ) {

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
                    typeof comando.handleSelect ===
                        "function"
                ) {

                    try {

                        await comando.handleSelect(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no menu do sorteio:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao selecionar a opção do sorteio.",

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            if (
                interaction.customId.startsWith(
                    "ticket_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "ticket"
                    );

                if (
                    comando &&
                    typeof comando.handleSelectMenu ===
                        "function"
                ) {

                    try {

                        await comando.handleSelectMenu(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no menu do ticket:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao configurar o ticket.",

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            if (
                interaction.customId.startsWith(
                    "pptduo_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "pptduo"
                    );

                if (
                    comando &&
                    typeof comando.handleSelect ===
                        "function"
                ) {

                    try {

                        await comando.handleSelect(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro no menu do PPT Duo:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao escolher o jogador do PPT Duo.",

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            return;
        }

        // =================================================
        // 🔘 BOTÕES
        // =================================================

        if (
            interaction.isButton()
        ) {

            if (
                interaction.customId ===
                "daily_notificar_desativar"
            ) {

                const comando =
                    client.commands.get(
                        "daily-notificar"
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
                            "❌ Erro no botão de desativar notificação do Daily:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao desativar a notificação do Daily.",

                                ephemeral:
                                    true
                            });
                        }
                    }

                } else {

                    console.error(
                        "❌ O comando daily-notificar não foi carregado."
                    );
                }

                return;
            }

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

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

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

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

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

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            if (
                interaction.customId.startsWith(
                    "ticket_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "ticket"
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
                            "❌ Erro no botão do ticket:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao configurar o ticket.",

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            if (
                interaction.customId.startsWith(
                    "sorteio_participar_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "sorteio"
                    );

                if (
                    comando &&
                    typeof comando.handleParticipation ===
                        "function"
                ) {

                    try {

                        await comando.handleParticipation(
                            interaction
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro ao participar do sorteio:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao participar do sorteio.",

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

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

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            if (
                interaction.customId.startsWith(
                    "pptduo_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "pptduo"
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
                            "❌ Erro no botão do PPT Duo:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao jogar no PPT Duo.",

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

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

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            return;
        }

        // =====================================================
        // 📝 MODAIS
        // =====================================================

        if (
            interaction.isModalSubmit()
        ) {

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

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            if (
                interaction.customId.startsWith(
                    "ticket_"
                )
            ) {

                const comando =
                    client.commands.get(
                        "ticket"
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
                            "❌ Erro no modal do ticket:",
                            erro
                        );

                        if (
                            !interaction.replied &&
                            !interaction.deferred
                        ) {

                            await interaction.reply({
                                content:
                                    "❌ Deu erro ao configurar o ticket.",

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

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

                                ephemeral:
                                    true
                            });
                        }
                    }
                }

                return;
            }

            return;
        }

        // =====================================================
        // 💬 SLASH COMMANDS
        // =====================================================

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

                    ephemeral:
                        true
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

                        ephemeral:
                            true
                    });

                } else {

                    await interaction.reply({
                        content:
                            "❌ Deu erro ao executar esse comando.\n🔄 Tente novamente mais tarde.",

                        ephemeral:
                            true
                    });
                }

            } catch (
                erroResposta
            ) {

                console.error(
                    "❌ Não foi possível enviar a mensagem de erro:",
                    erroResposta
                );
            }
        }
    }
);

// =====================================================
// 💾 BANCO + REGISTRO + LOGIN DO DISCORD
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

        // =================================================
        // 🌐 REGISTRAR SLASH COMMANDS
        // =================================================

        console.log(
            "🌐 Atualizando comandos Slash..."
        );

        await registrarComandos();

        // =================================================
        // 🔑 LOGIN
        // =================================================

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
