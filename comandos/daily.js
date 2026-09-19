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
// 🌙 INÍCIO DO DIA EM BRASÍLIA
// =====================================================

function calcularInicioDoDiaBrasilia() {
    const {
        ano,
        mes,
        dia
    } = obterDataBrasilia();

    /*
     * Brasília = UTC-3.
     *
     * Portanto:
     * 00:00 em Brasília = 03:00 UTC
     */
    return Date.UTC(
        ano,
        mes - 1,
        dia,
        3,
        0,
        0,
        0
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

    /*
     * Próxima meia-noite em Brasília.
     *
     * 00:00 Brasília = 03:00 UTC
     */
    return Date.UTC(
        ano,
        mes - 1,
        dia + 1,
        3,
        0,
        0,
        0
    );
}

// =====================================================
// ⏳ CALCULAR TEMPO RESTANTE
// =====================================================

function calcularTempoRestante() {
    const proximoDaily =
        calcularProximaMeiaNoite();

    const restante =
        proximoDaily - Date.now();

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
            restante /
            (1000 * 60 * 60)
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

    /*
     * Se o último resgate aconteceu
     * depois da meia-noite de hoje,
     * significa que já pegou o Daily hoje.
     */
    return ultimoDaily >= inicioDoDia;
}

// =====================================================
// 🔔 BOTÃO DE NOTIFICAÇÃO
// =====================================================

function criarBotaoNotificacao(ativa = false) {
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
        await client.query(
            "BEGIN"
        );

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

        // =================================================
        // 🚫 JÁ PEGOU HOJE
        // =================================================

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
                    )
            };
        }

        // =================================================
        // 💰 SORTEAR RECOMPENSA
        // =================================================

        const recompensa =
            sortearRecompensa();

        const agora =
            Date.now();

        // =================================================
        // 💾 SALVAR DAILY
        // =================================================

        const atualizado =
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

                RETURNING saldo
            `, [
                recompensa,
                agora,
                userId
            ]);

        await client.query(
            "COMMIT"
        );

        const novoSaldo =
            Number(
                atualizado.rows[0].saldo
            );

        const {
            proximoDaily
        } = calcularTempoRestante();

        // =================================================
        // 🎁 EMBED
        // =================================================

        const embed =
            new EmbedBuilder()
                .setTitle(
                    "🎁 DAILY"
                )
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
                criarBotaoNotificacao(
                    false
                )
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

            // Ainda é o mesmo dia.
            if (
                pegouDailyHoje(
                    ultimoDaily
                )
            ) {
                continue;
            }

            try {

                const discordUser =
                    await client.users.fetch(
                        userId
                    );

                await discordUser.send(
                    "🔔 **Seu daily está disponível!**\n\n" +
                    "Já passou da meia-noite! 🌙\n" +
                    "Use `/daily` no servidor para receber sua recompensa. 💰"
                );

                console.log(
                    `🔔 Notificação do Daily enviada para ${discordUser.tag}`
                );

            } catch (erro) {

                console.log(
                    `⚠️ Não foi possível enviar DM do Daily para o usuário ${userId}.`
                );
            }

            // Desativar notificação.
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

            // =============================================
            // 🚫 JÁ PEGOU
            // =============================================

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
                        .setTitle(
                            "⏳ DAILY"
                        )
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

            // =============================================
            // 🎁 DAILY RESGATADO
            // =============================================

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

            // =============================================
            // 🚫 JÁ PEGOU
            // =============================================

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
                        .setTitle(
                            "⏳ DAILY"
                        )
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

            // =============================================
            // 🎁 DAILY RESGATADO
            // =============================================

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

            return interaction.reply({
                content:
                    "🔔 Você já ativou a notificação do daily!",
                ephemeral: true
            });
        }

        const ultimoDaily =
            await getUltimoDaily(
                userId
            );

        if (!ultimoDaily) {

            return interaction.reply({
                content:
                    "❌ Você ainda não possui um daily para aguardar. Use `/daily` primeiro.",
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
                    "🎁 Seu daily já está disponível! Use `/daily`.",
                ephemeral: true
            });
        }

        await salvarNotificacaoDaily(
            userId,
            true
        );

        await interaction.reply({
            content:
                `✅ Pronto! Vou te avisar quando o daily estiver disponível às **${formatarHorario(proximoDaily)}**. 🔔`,
            ephemeral: true
        });
    }
};
