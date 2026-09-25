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

const COR_DAILY = 0x57F287;       // 🟢 Verde
const COR_ESPERA = 0xFAA61A;      // 🟠 Laranja
const COR_NOTIFICACAO = 0x5865F2; // 🔵 Azul

// Horários aleatórios das notificações
const notificacoesAgendadas = new Map();

const JANELA_NOTIFICACAO =
    30 * 60 * 1000;

// =====================================================
// 💰 SORTEIO DA RECOMPENSA
// =====================================================

function sortearRecompensa() {
    const sorteio = Math.random() * 100;

    if (sorteio < 45) {
        return Math.floor(Math.random() * 401) + 100;
    }

    if (sorteio < 75) {
        return Math.floor(Math.random() * 1500) + 501;
    }

    if (sorteio < 90) {
        return Math.floor(Math.random() * 3000) + 2001;
    }

    if (sorteio < 97) {
        return Math.floor(Math.random() * 5000) + 5001;
    }

    if (sorteio < 99.5) {
        return Math.floor(Math.random() * 10000) + 10001;
    }

    return Math.floor(Math.random() * 5000) + 20001;
}

// =====================================================
// ⏰ FORMATAR HORÁRIO
// =====================================================

function formatarHorario(timestamp) {
    return new Date(timestamp).toLocaleString("pt-BR", {
        timeZone: TIMEZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

// =====================================================
// 📅 OBTER DATA ATUAL EM BRASÍLIA
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
            partes.find(parte => parte.type === "year").value
        ),
        mes: Number(
            partes.find(parte => parte.type === "month").value
        ),
        dia: Number(
            partes.find(parte => parte.type === "day").value
        )
    };
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

    return Date.UTC(
        ano,
        mes - 1,
        dia
    ) + OFFSET_BRASILIA;
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

    const proximoDia = new Date(
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

    return Date.UTC(
        proximoAno,
        proximoMes,
        proximoDiaNumero
    ) + OFFSET_BRASILIA;
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

    return proximaMeiaNoite + atrasoAleatorio;
}

// =====================================================
// 🔔 OBTER HORÁRIO AGENDADO
// =====================================================

function obterHorarioNotificacao(userId) {
    let horario =
        notificacoesAgendadas.get(userId);

    if (
        !horario ||
        horario < calcularProximaMeiaNoite() -
            JANELA_NOTIFICACAO
    ) {
        horario =
            sortearHorarioNotificacao();

        notificacoesAgendadas.set(
            userId,
            horario
        );
    }

    return horario;
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
            proximoDaily - Date.now()
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
    const horas = Math.max(
        0,
        Math.floor(
            restante / (1000 * 60 * 60)
        )
    );

    const minutos = Math.max(
        0,
        Math.floor(
            (
                restante %
                (1000 * 60 * 60)
            ) /
            (1000 * 60)
        )
    );

    const segundos = Math.max(
        0,
        Math.floor(
            (
                restante %
                (1000 * 60)
            ) /
            1000
        )
    );

    return `${horas}h ${minutos}min ${segundos}s`;
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
        !Number.isFinite(ultimoDaily) ||
        ultimoDaily <= 0
    ) {
        return false;
    }

    const inicioDoDia =
        calcularInicioDoDiaBrasilia();

    return ultimoDaily >= inicioDoDia;
}

// =====================================================
// 🔔 BOTÃO DE NOTIFICAÇÃO
// =====================================================

function criarBotaoNotificacao(ativa = false) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("daily_notificar")
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
                .setDisabled(ativa)
        );
}

// =====================================================
// 🔒 RESGATAR DAILY
// =====================================================

async function resgatarDailyAtomico(
    userId,
    usuario
) {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query(`
            INSERT INTO usuarios (
                id,
                saldo,
                ultimo_daily,
                notificacao_daily
            )
            VALUES (
                $1,
                0,
                NULL,
                FALSE
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
                    ultimo_daily
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
            await client.query("COMMIT");

            return {
                sucesso: false,
                ultimoDaily:
                    Number(
                        dados.ultimo_daily
                    )
            };
        }

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

                notificacao_daily = FALSE

            WHERE id = $3
        `, [
            recompensa,
            agora,
            userId
        ]);

        await client.query("COMMIT");

        // Remove qualquer horário antigo de notificação
        notificacoesAgendadas.delete(
            userId
        );

        const saldoAtual =
            await client.query(`
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
        } = calcularTempoRestante();

        const embed =
            new EmbedBuilder()
                .setColor(COR_DAILY)
                .setTitle("🎁 DAILY")
                .setDescription(
                    `Parabéns, ${usuario}!\n\n` +
                    `🎲 Você ganhou **${recompensa} moedas**!\n` +
                    `💳 Seu saldo agora é **${novoSaldo} moedas**.\n\n` +
                    `🕐 Seu próximo daily estará disponível em **${formatarHorario(proximoDaily)}**.`
                )
                .setFooter({
                    text:
                        "Volte amanhã para tentar a sorte novamente!"
                });

        return {
            sucesso: true,
            embed,
            row:
                criarBotaoNotificacao(false)
        };

    } catch (erro) {

        await client.query("ROLLBACK");

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

        const resultado =
            await pool.query(`
                SELECT
                    id,
                    ultimo_daily
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

            // Ainda não chegou o próximo dia
            if (
                pegouDailyHoje(
                    ultimoDaily
                )
            ) {
                continue;
            }

            // Cria um horário aleatório para este usuário
            let horarioNotificacao =
                notificacoesAgendadas.get(
                    userId
                );

            if (!horarioNotificacao) {

                horarioNotificacao =
                    sortearHorarioNotificacao();

                notificacoesAgendadas.set(
                    userId,
                    horarioNotificacao
                );

                console.log(
                    `🎲 Notificação do Daily de ${userId} agendada para ${formatarHorario(horarioNotificacao)}`
                );
            }

            // Ainda não chegou o horário sorteado
            if (
                Date.now() <
                horarioNotificacao
            ) {
                continue;
            }

            try {

                const discordUser =
                    await client.users.fetch(
                        userId
                    );

                const embedNotificacao =
                    new EmbedBuilder()
                        .setColor(COR_NOTIFICACAO)
                        .setTitle("🔔 Seu Daily está disponível!")
                        .setDescription(
                            `Olá, ${discordUser}!\n\n` +
                            `🌙 Um novo dia começou e sua recompensa diária já está disponível!\n\n` +
                            `💰 Entre em um servidor e resgate sua recompensa usando:\n` +
                            `</daily:ID_DO_DAILY>`
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

            } catch (erro) {

                console.log(
                    `⚠️ Não foi possível enviar DM do Daily para o usuário ${userId}.`
                );
            }

            try {

                await salvarNotificacaoDaily(
                    userId,
                    false
                );

            } catch (erro) {

                console.error(
                    `❌ Erro ao desativar notificação do Daily de ${userId}:`,
                    erro
                );
            }

            notificacoesAgendadas.delete(
                userId
            );
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
                        .setColor(COR_ESPERA)
                        .setTitle("⏳ DAILY")
                        .setDescription(
                            `Você já pegou seu daily hoje!\n\n` +
                            `🕐 Próximo daily em **${formatarTempo(restante)}**.\n` +
                            `📅 Disponível em **${formatarHorario(proximoDaily)}**.`
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
                        .setColor(COR_ESPERA)
                        .setTitle("⏳ DAILY")
                        .setDescription(
                            `Você já pegou seu daily hoje!\n\n` +
                            `🕐 Próximo daily em **${formatarTempo(restante)}**.\n` +
                            `📅 Disponível em **${formatarHorario(proximoDaily)}**.`
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

            // Garante que o botão fique desativado
            // mesmo se a interação for antiga.
            try {

                await interaction.update({
                    components: [
                        criarBotaoNotificacao(true)
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
            proximoDaily,
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

        // Sorteia o horário da notificação
        const horarioNotificacao =
            sortearHorarioNotificacao();

        notificacoesAgendadas.set(
            userId,
            horarioNotificacao
        );

        await salvarNotificacaoDaily(
            userId,
            true
        );

        // =================================================
        // 🔘 DESATIVAR BOTÃO
        // =================================================

        await interaction.update({
            components: [
                criarBotaoNotificacao(true)
            ]
        });

        // =================================================
        // ✅ CONFIRMAÇÃO
        // =================================================

        await interaction.followUp({
            content:
                `✅ Pronto! Vou te enviar uma notificação depois das **00:00**, quando seu Daily estiver disponível. 🔔\n\n` +
                `🕐 Horário previsto da notificação: **${formatarHorario(horarioNotificacao)}**.`,
            ephemeral: true
        });
    }
};
