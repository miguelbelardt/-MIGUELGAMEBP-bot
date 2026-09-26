const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    pool,
    getUltimoDaily,
    getNotificacaoDaily,
    salvarNotificacaoDaily
} = require("../database/database");

const dailyProcessando = new Set();

const TIMEZONE = "America/Sao_Paulo";
const OFFSET_BRASILIA = 3 * 60 * 60 * 1000;

// =====================================================
// 🎨 CORES DOS EMBEDS
// =====================================================

const COR_DAILY = 0x57F287;
const COR_ESPERA = 0xFAA61A;
const COR_NOTIFICACAO = 0x5865F2;

// =====================================================
// 🔔 CONFIGURAÇÕES DAS NOTIFICAÇÕES
// =====================================================

const JANELA_NOTIFICACAO =
    30 * 60 * 1000;

const TEMPO_RETRY_NOTIFICACAO =
    5 * 60 * 1000;

const notificacoesAgendadas = new Map();

// =====================================================
// 🔥 SEQUÊNCIA DO DAILY
// =====================================================

// Evita executar o ALTER TABLE várias vezes.
let sequenciaBancoPronta = false;
let sequenciaBancoPromise = null;

async function garantirColunaSequencia() {
    if (sequenciaBancoPronta) {
        return;
    }

    if (sequenciaBancoPromise) {
        return sequenciaBancoPromise;
    }

    sequenciaBancoPromise = (async () => {
        await pool.query(`
            ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS daily_sequencia BIGINT NOT NULL DEFAULT 0
        `);

        sequenciaBancoPronta = true;

        console.log(
            "🔥 Coluna daily_sequencia verificada com sucesso."
        );
    })();

    try {
        await sequenciaBancoPromise;
    } finally {
        sequenciaBancoPromise = null;
    }
}

// =====================================================
// 📅 DATA BRASÍLIA
// =====================================================

function obterDataBrasilia() {
    const agora = new Date();

    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(agora);

    return {
        ano: Number(
            partes.find(
                parte => parte.type === "year"
            ).value
        ),

        mes: Number(
            partes.find(
                parte => parte.type === "month"
            ).value
        ),

        dia: Number(
            partes.find(
                parte => parte.type === "day"
            ).value
        )
    };
}

// =====================================================
// 📅 DATA BRASÍLIA DE UM TIMESTAMP
// =====================================================

function obterDataBrasiliaDoTimestamp(timestamp) {
    if (!timestamp) {
        return null;
    }

    const numero =
        Number(timestamp);

    if (
        !Number.isFinite(numero) ||
        numero <= 0
    ) {
        return null;
    }

    const partes =
        new Intl.DateTimeFormat("en-US", {
            timeZone: TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(
            new Date(numero)
        );

    const ano =
        partes.find(
            parte => parte.type === "year"
        )?.value;

    const mes =
        partes.find(
            parte => parte.type === "month"
        )?.value;

    const dia =
        partes.find(
            parte => parte.type === "day"
        )?.value;

    if (!ano || !mes || !dia) {
        return null;
    }

    return `${ano}-${mes}-${dia}`;
}

// =====================================================
// 📅 DATA DE HOJE
// =====================================================

function obterChaveDataHoje() {
    const {
        ano,
        mes,
        dia
    } = obterDataBrasilia();

    return (
        `${String(ano).padStart(4, "0")}-` +
        `${String(mes).padStart(2, "0")}-` +
        `${String(dia).padStart(2, "0")}`
    );
}

// =====================================================
// 📅 DATA DE ONTEM
// =====================================================

function obterChaveDataOntem() {
    const {
        ano,
        mes,
        dia
    } = obterDataBrasilia();

    const ontem =
        new Date(
            Date.UTC(
                ano,
                mes - 1,
                dia - 1
            )
        );

    return (
        `${String(
            ontem.getUTCFullYear()
        ).padStart(4, "0")}-` +

        `${String(
            ontem.getUTCMonth() + 1
        ).padStart(2, "0")}-` +

        `${String(
            ontem.getUTCDate()
        ).padStart(2, "0")}`
    );
}

// =====================================================
// 🔥 CALCULAR PRÓXIMA SEQUÊNCIA
// =====================================================

function calcularProximaSequencia(
    ultimoDaily,
    sequenciaAtual
) {
    const hoje =
        obterChaveDataHoje();

    const ontem =
        obterChaveDataOntem();

    const ultimaData =
        obterDataBrasiliaDoTimestamp(
            ultimoDaily
        );

    const sequencia =
        Math.max(
            0,
            Number(sequenciaAtual) || 0
        );

    // Nunca pegou Daily antes.
    if (!ultimaData) {
        return 1;
    }

    // Pegou ontem: continua a sequência.
    if (ultimaData === ontem) {
        return sequencia + 1;
    }

    // Pegou hoje: já foi tratado antes,
    // mas mantemos a proteção.
    if (ultimaData === hoje) {
        return sequencia;
    }

    // Pulou um ou mais dias.
    return 1;
}

// =====================================================
// 🔥 ATUALIZAR SEQUÊNCIA QUANDO PERDEU DIAS
// =====================================================

async function atualizarSequenciaSePerdeuDia(
    userId,
    ultimoDaily,
    sequenciaAtual
) {
    const hoje =
        obterChaveDataHoje();

    const ontem =
        obterChaveDataOntem();

    const ultimaData =
        obterDataBrasiliaDoTimestamp(
            ultimoDaily
        );

    const sequencia =
        Math.max(
            0,
            Number(sequenciaAtual) || 0
        );

    // Se não existe Daily anterior,
    // não há sequência para resetar.
    if (!ultimaData) {
        return 0;
    }

    // Ainda está dentro da sequência.
    if (
        ultimaData === hoje ||
        ultimaData === ontem
    ) {
        return sequencia;
    }

    // Passou pelo menos um dia sem pegar.
    if (sequencia !== 0) {
        await pool.query(`
            UPDATE usuarios
            SET daily_sequencia = 0
            WHERE id = $1
        `, [
            userId
        ]);

        console.log(
            `🔄 Sequência de Daily do usuário ${userId} resetada para 0.`
        );
    }

    return 0;
}

// =====================================================
// 💰 SORTEAR RECOMPENSA
// =====================================================

function sortearRecompensa() {
    const sorteio =
        Math.random() * 100;

    if (sorteio < 45) {
        return Math.floor(
            Math.random() * 401
        ) + 100;
    }

    if (sorteio < 75) {
        return Math.floor(
            Math.random() * 1500
        ) + 501;
    }

    if (sorteio < 90) {
        return Math.floor(
            Math.random() * 3000
        ) + 2001;
    }

    if (sorteio < 97) {
        return Math.floor(
            Math.random() * 5000
        ) + 5001;
    }

    if (sorteio < 99.5) {
        return Math.floor(
            Math.random() * 10000
        ) + 10001;
    }

    return Math.floor(
        Math.random() * 5000
    ) + 20001;
}

// =====================================================
// ⏰ FORMATAR HORÁRIO
// =====================================================

function formatarHorario(timestamp) {
    return new Date(timestamp).toLocaleString(
        "pt-BR",
        {
            timeZone: TIMEZONE,
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );
}

// =====================================================
// 🌙 INÍCIO DO DIA EM BRASÍLIA
// =====================================================

function calcularInicioDoDiaBrasilia() {
    const {
        ano,
        mes,
        dia
    } = obterDataBrasilia();

    return (
        Date.UTC(
            ano,
            mes - 1,
            dia
        ) +
        OFFSET_BRASILIA
    );
}

// =====================================================
// 🌙 PRÓXIMA MEIA-NOITE
// =====================================================

function calcularProximaMeiaNoite() {
    const {
        ano,
        mes,
        dia
    } = obterDataBrasilia();

    const proximoDia =
        new Date(
            Date.UTC(
                ano,
                mes - 1,
                dia + 1
            )
        );

    const proximoAno =
        proximoDia.getUTCFullYear();

    const proximoMes =
        proximoDia.getUTCMonth();

    const proximoDiaNumero =
        proximoDia.getUTCDate();

    return (
        Date.UTC(
            proximoAno,
            proximoMes,
            proximoDiaNumero
        ) +
        OFFSET_BRASILIA
    );
}

// =====================================================
// 🔔 SORTEAR HORÁRIO DA NOTIFICAÇÃO
// =====================================================

function sortearHorarioNotificacao() {
    const proximaMeiaNoite =
        calcularProximaMeiaNoite();

    const atrasoAleatorio =
        Math.floor(
            Math.random() *
            (JANELA_NOTIFICACAO + 1)
        );

    return (
        proximaMeiaNoite +
        atrasoAleatorio
    );
}

// =====================================================
// 🔔 SORTEAR HORÁRIO DE HOJE
// =====================================================

function sortearHorarioNotificacaoHoje() {
    const inicioDoDia =
        calcularInicioDoDiaBrasilia();

    const fimDaJanela =
        inicioDoDia +
        JANELA_NOTIFICACAO;

    const agora =
        Date.now();

    if (agora < fimDaJanela) {

        const inicioSorteio =
            Math.max(
                agora + 5000,
                inicioDoDia
            );

        const intervalo =
            fimDaJanela -
            inicioSorteio;

        if (intervalo <= 0) {
            return agora;
        }

        return (
            inicioSorteio +
            Math.floor(
                Math.random() *
                intervalo
            )
        );
    }

    return agora;
}

// =====================================================
// ⏳ CALCULAR TEMPO RESTANTE
// =====================================================

function calcularTempoRestante() {
    const proximoDaily =
        calcularProximaMeiaNoite();

    const restante =
        Math.max(
            0,
            proximoDaily -
            Date.now()
        );

    return {
        proximoDaily,
        restante
    };
}

// =====================================================
// ⏱️ FORMATAR TEMPO
// =====================================================

function formatarTempo(restante) {
    const horas =
        Math.max(
            0,
            Math.floor(
                restante /
                (1000 * 60 * 60)
            )
        );

    const minutos =
        Math.max(
            0,
            Math.floor(
                (
                    restante %
                    (1000 * 60 * 60)
                ) /
                (1000 * 60)
            )
        );

    const segundos =
        Math.max(
            0,
            Math.floor(
                (
                    restante %
                    (1000 * 60)
                ) /
                1000
            )
        );

    return (
        `${horas}h ${minutos}min ${segundos}s`
    );
}

// =====================================================
// 📅 VERIFICAR SE PEGOU O DAILY HOJE
// =====================================================

function pegouDailyHoje(timestamp) {
    if (!timestamp) {
        return false;
    }

    const ultimoDaily =
        Number(timestamp);

    if (
        !Number.isFinite(
            ultimoDaily
        ) ||
        ultimoDaily <= 0
    ) {
        return false;
    }

    const inicioDoDia =
        calcularInicioDoDiaBrasilia();

    return (
        ultimoDaily >=
        inicioDoDia
    );
}

// =====================================================
// 🔘 BOTÃO DE NOTIFICAÇÃO
// =====================================================

function criarBotaoNotificacao(
    ativa = false
) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "daily_notificar"
                )
                .setLabel(
                    ativa
                        ? "🔔 Notificação ativada"
                        : "🔔 Me notificar amanhã"
                )
                .setStyle(
                    ativa
                        ? ButtonStyle.Success
                        : ButtonStyle.Primary
                )
                .setDisabled(
                    ativa
                )
        );
}

// =====================================================
// 🔥 TEXTO DA SEQUÊNCIA
// =====================================================

function textoSequencia(
    sequencia
) {
    const numero =
        Math.max(
            0,
            Number(sequencia) || 0
        );

    if (numero <= 0) {
        return (
            "🔥 Você ainda não possui uma sequência de Daily."
        );
    }

    return (
        `🔥 Sua sequência atual é de **${numero} dias**!`
    );
}

// =====================================================
// 🔥 TEXTO DA PRÓXIMA SEQUÊNCIA
// =====================================================

function textoProximaSequencia(
    sequencia
) {
    const numero =
        Math.max(
            0,
            Number(sequencia) || 0
        );

    if (numero <= 0) {
        return (
            "🔥 Você ainda não possui uma sequência de Daily. Pegue o Daily para começar uma!"
        );
    }

    return (
        `🔥 Se você pegar o Daily hoje, sua sequência será de **${numero} dias**!`
    );
}

// =====================================================
// 🔒 RESGATAR DAILY ATOMICAMENTE
// =====================================================

async function resgatarDailyAtomico(
    userId,
    usuario
) {
    await garantirColunaSequencia();

    const client =
        await pool.connect();

    try {

        await client.query(
            "BEGIN"
        );

        await client.query(`
            INSERT INTO usuarios (
                id,
                saldo,
                ultimo_daily,
                notificacao_daily,
                notificacao_daily_em,
                daily_sequencia
            )
            VALUES (
                $1,
                0,
                NULL,
                FALSE,
                NULL,
                0
            )
            ON CONFLICT (id)
            DO NOTHING
        `, [
            userId
        ]);

        const resultado =
            await client.query(`
                SELECT
                    saldo,
                    ultimo_daily,
                    daily_sequencia
                FROM usuarios
                WHERE id = $1
                FOR UPDATE
            `, [
                userId
            ]);

        const dados =
            resultado.rows[0];

        if (
            pegouDailyHoje(
                dados.ultimo_daily
            )
        ) {

            await client.query(
                "COMMIT"
            );

            return {
                sucesso: false,

                ultimoDaily:
                    Number(
                        dados.ultimo_daily
                    ),

                sequencia:
                    Number(
                        dados.daily_sequencia
                    ) || 0
            };
        }

        const sequenciaAtual =
            Number(
                dados.daily_sequencia
            ) || 0;

        const novaSequencia =
            calcularProximaSequencia(
                dados.ultimo_daily,
                sequenciaAtual
            );

        const recompensa =
            sortearRecompensa();

        const agora =
            Date.now();

        await client.query(`
            UPDATE usuarios
            SET
                saldo =
                    COALESCE(
                        saldo,
                        0
                    ) + $1,

                ultimo_daily = $2,

                daily_sequencia = $3,

                notificacao_daily = FALSE,

                notificacao_daily_em = NULL

            WHERE id = $4
        `, [
            recompensa,
            agora,
            novaSequencia,
            userId
        ]);

        await client.query(
            "COMMIT"
        );

        notificacoesAgendadas.delete(
            userId
        );

        const saldoAtual =
            await pool.query(`
                SELECT saldo
                FROM usuarios
                WHERE id = $1
            `, [
                userId
            ]);

        const novoSaldo =
            Number(
                saldoAtual.rows[0].saldo
            );

        const {
            proximoDaily
        } =
            calcularTempoRestante();

        const embed =
            new EmbedBuilder()
                .setColor(
                    COR_DAILY
                )
                .setTitle(
                    "🎁 DAILY"
                )
                .setDescription(
                    `Parabéns, ${usuario}!\n\n` +

                    `🎲 Você ganhou **${recompensa} moedas**!\n` +

                    `💳 Seu saldo agora é **${novoSaldo} moedas**.\n\n` +

                    `🔥 Sua sequência atual é de **${novaSequencia} dias**!\n\n` +

                    `🕐 Seu próximo daily estará disponível em **${formatarHorario(proximoDaily)}**.`
                )
                .setFooter({
                    text:
                        "Volte amanhã para continuar sua sequência!"
                });

        return {
            sucesso: true,

            embed,

            row:
                criarBotaoNotificacao(
                    false
                ),

            sequencia:
                novaSequencia
        };

    } catch (erro) {

        await client.query(
            "ROLLBACK"
        );

        throw erro;

    } finally {

        client.release();
    }
}

// =====================================================
// 🔔 SISTEMA AUTOMÁTICO DE NOTIFICAÇÕES
// =====================================================

async function verificarNotificacoesDaily(
    client
) {
    try {

        await garantirColunaSequencia();

        const resultado =
            await pool.query(`
                SELECT
                    id,
                    ultimo_daily,
                    notificacao_daily_em,
                    daily_sequencia
                FROM usuarios
                WHERE
                    notificacao_daily = TRUE
                    AND ultimo_daily IS NOT NULL
            `);

        for (
            const usuario
            of resultado.rows
        ) {

            const userId =
                usuario.id;

            const ultimoDaily =
                Number(
                    usuario.ultimo_daily
                );

            let sequencia =
                Number(
                    usuario.daily_sequencia
                ) || 0;

            // =========================================
            // 🔄 RESETAR SEQUÊNCIA SE PERDEU DIA
            // =========================================

            sequencia =
                await atualizarSequenciaSePerdeuDia(
                    userId,
                    ultimoDaily,
                    sequencia
                );

            // =========================================
            // 📅 AINDA PEGOU O DAILY DE HOJE
            // =========================================

            if (
                pegouDailyHoje(
                    ultimoDaily
                )
            ) {
                continue;
            }

            // =========================================
            // 🔥 CALCULAR PRÓXIMA SEQUÊNCIA
            // =========================================

            const proximaSequencia =
                calcularProximaSequencia(
                    ultimoDaily,
                    sequencia
                );

            const agora =
                Date.now();

            let horarioNotificacao =
                usuario.notificacao_daily_em
                    ? Number(
                        usuario.notificacao_daily_em
                    )
                    : null;

            // =========================================
            // 🔄 RECUPERAR HORÁRIO APÓS RESTART
            // =========================================

            if (
                !horarioNotificacao ||
                !Number.isFinite(
                    horarioNotificacao
                )
            ) {

                const inicioDoDia =
                    calcularInicioDoDiaBrasilia();

                const fimDaJanela =
                    inicioDoDia +
                    JANELA_NOTIFICACAO;

                if (
                    agora <= fimDaJanela
                ) {

                    horarioNotificacao =
                        sortearHorarioNotificacaoHoje();

                } else {

                    horarioNotificacao =
                        agora;
                }

                await salvarNotificacaoDaily(
                    userId,
                    true,
                    horarioNotificacao
                );

                console.log(
                    `🔄 Horário da notificação do Daily de ${userId} recuperado: ${formatarHorario(horarioNotificacao)}`
                );
            }

            notificacoesAgendadas.set(
                userId,
                horarioNotificacao
            );

            // =========================================
            // ⏳ AINDA NÃO CHEGOU O HORÁRIO
            // =========================================

            if (
                agora <
                horarioNotificacao
            ) {
                continue;
            }

            // =========================================
            // 📩 ENVIAR NOTIFICAÇÃO
            // =========================================

            try {

                const discordUser =
                    await client.users.fetch(
                        userId
                    );

                const textoDaSequencia =
                    proximaSequencia > 0
                        ? textoProximaSequencia(
                            proximaSequencia
                        )
                        : textoSequencia(
                            0
                        );

                const embedNotificacao =
                    new EmbedBuilder()
                        .setColor(
                            COR_NOTIFICACAO
                        )
                        .setTitle(
                            "🔔 Seu Daily está disponível!"
                        )
                        .setDescription(
                            `Olá, ${discordUser}!\n\n` +

                            `🌙 Um novo dia começou e sua recompensa diária já está disponível!\n\n` +

                            `${textoDaSequencia}\n\n` +

                            `💰 Entre em um servidor e resgate sua recompensa usando:\n` +
                            `\`/daily\``
                        )
                        .setFooter({
                            text:
                                "Não esqueça de pegar seu Daily hoje!"
                        });

                await discordUser.send({
                    embeds: [
                        embedNotificacao
                    ]
                });

                console.log(
                    `🔔 Notificação do Daily enviada para ${discordUser.tag}`
                );

                await salvarNotificacaoDaily(
                    userId,
                    false
                );

                notificacoesAgendadas.delete(
                    userId
                );

            } catch (erro) {

                console.log(
                    `⚠️ Não foi possível enviar DM do Daily para o usuário ${userId}.`
                );

                console.log(
                    `⚠️ Motivo: ${erro?.message || erro}`
                );

                const novoHorario =
                    Date.now() +
                    TEMPO_RETRY_NOTIFICACAO;

                notificacoesAgendadas.set(
                    userId,
                    novoHorario
                );

                try {

                    await salvarNotificacaoDaily(
                        userId,
                        true,
                        novoHorario
                    );

                    console.log(
                        `🔄 Nova tentativa do Daily de ${userId} agendada para ${formatarHorario(novoHorario)}`
                    );

                } catch (erroBanco) {

                    console.error(
                        `❌ Erro ao salvar nova tentativa da notificação de ${userId}:`,
                        erroBanco
                    );
                }
            }
        }

    } catch (erro) {

        console.error(
            "❌ Erro ao verificar notificações do Daily:",
            erro
        );
    }
}

// =====================================================
// 🚀 INICIAR SISTEMA DE NOTIFICAÇÕES
// =====================================================

function iniciarSistemaNotificacoes(
    client
) {

    console.log(
        "🔔 Sistema de notificações do Daily iniciado."
    );

    garantirColunaSequencia()
        .catch(
            erro => {
                console.error(
                    "❌ Erro ao preparar sequência do Daily:",
                    erro
                );
            }
        );

    verificarNotificacoesDaily(
        client
    );

    setInterval(
        () => {
            verificarNotificacoesDaily(
                client
            );
        },
        30 * 1000
    );
}

// =====================================================
// 🤖 COMANDO
// =====================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("daily")
            .setDescription(
                "Resgate sua recompensa diária! 💰"
            ),

    iniciarSistemaNotificacoes,

    // =================================================
    // 💬 SLASH COMMAND
    // =================================================

    async execute(
        interaction
    ) {

        const userId =
            interaction.user.id;

        if (
            dailyProcessando.has(
                userId
            )
        ) {

            return interaction.reply({
                content:
                    "⏳ Seu Daily já está sendo processado. Aguarde um momento!",
                ephemeral: true
            });
        }

        dailyProcessando.add(
            userId
        );

        try {

            const resultado =
                await resgatarDailyAtomico(
                    userId,
                    interaction.user
                );

            if (
                !resultado.sucesso
            ) {

                const {
                    proximoDaily,
                    restante
                } =
                    calcularTempoRestante();

                const notificacaoAtiva =
                    await getNotificacaoDaily(
                        userId
                    );

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            COR_ESPERA
                        )
                        .setTitle(
                            "⏳ DAILY"
                        )
                        .setDescription(
                            `Você já pegou seu daily hoje!\n\n` +

                            `🕐 Próximo daily em **${formatarTempo(restante)}**.\n` +

                            `📅 Disponível em **${formatarHorario(proximoDaily)}**.\n\n` +

                            `${textoSequencia(
                                resultado.sequencia
                            )}`
                        );

                return interaction.reply({
                    embeds: [
                        embed
                    ],

                    components: [
                        criarBotaoNotificacao(
                            notificacaoAtiva
                        )
                    ],

                    ephemeral: true
                });
            }

            await interaction.reply({
                embeds: [
                    resultado.embed
                ],

                components: [
                    resultado.row
                ]
            });

        } catch (erro) {

            console.error(
                "❌ Erro no Daily:",
                erro
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({
                    content:
                        "❌ Não foi possível processar seu daily.",
                    ephemeral: true
                });
            }

        } finally {

            dailyProcessando.delete(
                userId
            );
        }
    },

    // =================================================
    // 🔤 COMANDO POR PREFIXO
    // =================================================

    async handlePrefix(
        message
    ) {

        const userId =
            message.author.id;

        if (
            dailyProcessando.has(
                userId
            )
        ) {
            return;
        }

        dailyProcessando.add(
            userId
        );

        try {

            const resultado =
                await resgatarDailyAtomico(
                    userId,
                    message.author
                );

            if (
                !resultado.sucesso
            ) {

                const {
                    proximoDaily,
                    restante
                } =
                    calcularTempoRestante();

                const notificacaoAtiva =
                    await getNotificacaoDaily(
                        userId
                    );

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            COR_ESPERA
                        )
                        .setTitle(
                            "⏳ DAILY"
                        )
                        .setDescription(
                            `Você já pegou seu daily hoje!\n\n` +

                            `🕐 Próximo daily em **${formatarTempo(restante)}**.\n` +

                            `📅 Disponível em **${formatarHorario(proximoDaily)}**.\n\n` +

                            `${textoSequencia(
                                resultado.sequencia
                            )}`
                        );

                return message.reply({
                    embeds: [
                        embed
                    ],

                    components: [
                        criarBotaoNotificacao(
                            notificacaoAtiva
                        )
                    ]
                });
            }

            await message.reply({
                embeds: [
                    resultado.embed
                ],

                components: [
                    resultado.row
                ]
            });

        } catch (erro) {

            console.error(
                "❌ Erro no Daily por prefixo:",
                erro
            );

            await message.reply(
                "❌ Não foi possível processar seu daily."
            );

        } finally {

            dailyProcessando.delete(
                userId
            );
        }
    },

    // =================================================
    // 🔘 BOTÃO DE NOTIFICAÇÃO
    // =================================================

    async handleButton(
        interaction
    ) {

        if (
            interaction.customId !==
            "daily_notificar"
        ) {
            return;
        }

        const userId =
            interaction.user.id;

        const notificacaoAtiva =
            await getNotificacaoDaily(
                userId
            );

        if (
            notificacaoAtiva
        ) {

            try {

                await interaction.update({
                    components: [
                        criarBotaoNotificacao(
                            true
                        )
                    ]
                });

            } catch (erro) {

                console.error(
                    "❌ Erro ao atualizar botão do Daily:",
                    erro
                );
            }

            return;
        }

        const ultimoDaily =
            await getUltimoDaily(
                userId
            );

        if (!ultimoDaily) {

            return interaction.reply({
                content:
                    "❌ Você ainda não possui um Daily para aguardar. Use `/daily` primeiro.",
                ephemeral: true
            });
        }

        const {
            restante
        } =
            calcularTempoRestante();

        if (
            restante <= 0
        ) {

            return interaction.reply({
                content:
                    "🎁 Seu Daily já está disponível! Use `/daily`.",
                ephemeral: true
            });
        }

        const horarioNotificacao =
            sortearHorarioNotificacao();

        notificacoesAgendadas.set(
            userId,
            horarioNotificacao
        );

        await salvarNotificacaoDaily(
            userId,
            true,
            horarioNotificacao
        );

        await interaction.update({
            components: [
                criarBotaoNotificacao(
                    true
                )
            ]
        });

        await interaction.followUp({
            content:
                `✅ Pronto! Vou te enviar uma notificação depois das **00:00**, quando seu Daily estiver disponível. 🔔\n\n` +
                `🕐 Horário previsto da notificação: **${formatarHorario(horarioNotificacao)}**.`,
            ephemeral: true
        });
    }
};
