const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    getSaldo,
    alterarSaldo,
    getUltimoDaily,
    salvarUltimoDaily,
    getNotificacaoDaily,
    salvarNotificacaoDaily
} = require("../database/database");

const timersNotificacao = new Map();

// 🛡️ Proteção contra duas execuções simultâneas do Daily
const dailyProcessando = new Set();

const TIMEZONE = "America/Sao_Paulo";

// =====================================================
// 💰 SORTEIO DA RECOMPENSA
// =====================================================

function sortearRecompensa() {
    const sorteio = Math.random() * 100;

    if (sorteio < 45) {
        return Math.floor(Math.random() * (500 - 100 + 1)) + 100;
    }

    if (sorteio < 75) {
        return Math.floor(Math.random() * (2000 - 501 + 1)) + 501;
    }

    if (sorteio < 90) {
        return Math.floor(Math.random() * (5000 - 2001 + 1)) + 2001;
    }

    if (sorteio < 97) {
        return Math.floor(Math.random() * (10000 - 5001 + 1)) + 5001;
    }

    if (sorteio < 99.5) {
        return Math.floor(Math.random() * (20000 - 10001 + 1)) + 10001;
    }

    return Math.floor(Math.random() * (25000 - 20001 + 1)) + 20001;
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
// 🌙 PRÓXIMA MEIA-NOITE
// =====================================================

function calcularProximaMeiaNoite() {
    const agora = new Date();

    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(agora);

    const ano = Number(
        partes.find(parte => parte.type === "year").value
    );

    const mes = Number(
        partes.find(parte => parte.type === "month").value
    );

    const dia = Number(
        partes.find(parte => parte.type === "day").value
    );

    return Date.UTC(
        ano,
        mes - 1,
        dia + 1,
        3,
        0,
        0
    );
}

// =====================================================
// ⏳ CALCULAR TEMPO RESTANTE
// =====================================================

function calcularTempoRestante() {
    const proximoDaily = calcularProximaMeiaNoite();
    const restante = proximoDaily - Date.now();

    return {
        proximoDaily,
        restante
    };
}

// =====================================================
// ⏱️ FORMATAR TEMPO
// =====================================================

function formatarTempo(restante) {
    const horas = Math.floor(
        restante / (1000 * 60 * 60)
    );

    const minutos = Math.floor(
        (restante % (1000 * 60 * 60)) /
        (1000 * 60)
    );

    const segundos = Math.floor(
        (restante % (1000 * 60)) /
        1000
    );

    return `${horas}h ${minutos}min ${segundos}s`;
}

// =====================================================
// 📅 VERIFICAR SE JÁ PEGOU HOJE
// =====================================================

function mesmoDiaBrasilia(timestamp) {
    const data = new Date(timestamp);

    const hoje = new Intl.DateTimeFormat("pt-BR", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(data);

    const agora = new Intl.DateTimeFormat("pt-BR", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());

    return hoje === agora;
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
// 🎁 ENTREGAR DAILY
// =====================================================

async function entregarDaily(userId, usuario) {
    const agora = Date.now();
    const recompensa = sortearRecompensa();

    await alterarSaldo(
        userId,
        recompensa
    );

    await salvarUltimoDaily(
        userId,
        agora
    );

    await salvarNotificacaoDaily(
        userId,
        false
    );

    const novoSaldo =
        await getSaldo(userId);

    const {
        proximoDaily
    } = calcularTempoRestante();

    const embed = new EmbedBuilder()
        .setTitle("🎁 DAILY")
        .setDescription(
            `Parabéns, ${usuario}!\n\n` +
            `🎲 Você ganhou **${recompensa} moedas**!\n` +
            `💳 Seu saldo agora é **${novoSaldo} moedas**.\n\n` +
            `🕐 Seu próximo daily estará disponível em **${formatarHorario(proximoDaily)}**.`
        )
        .setFooter({
            text: "Volte amanhã para tentar a sorte novamente!"
        });

    const row =
        criarBotaoNotificacao(false);

    return {
        embed,
        row
    };
}

// =====================================================
// 🤖 COMANDO
// =====================================================

module.exports = {

    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription(
            "Resgate sua recompensa diária! 💰"
        ),

    // =====================================================
    // 💬 SLASH COMMAND
    // =====================================================

    async execute(interaction) {

        const userId =
            interaction.user.id;

        // 🛡️ Evita duas execuções simultâneas
        if (dailyProcessando.has(userId)) {
            return interaction.reply({
                content:
                    "⏳ Seu Daily já está sendo processado. Aguarde um momento!",
                ephemeral: true
            });
        }

        dailyProcessando.add(userId);

        try {

            const ultimoDaily =
                await getUltimoDaily(userId);

            if (
                ultimoDaily &&
                mesmoDiaBrasilia(ultimoDaily)
            ) {

                const {
                    proximoDaily,
                    restante
                } = calcularTempoRestante();

                const notificacaoAtiva =
                    await getNotificacaoDaily(userId);

                const embed =
                    new EmbedBuilder()
                        .setTitle("⏳ DAILY")
                        .setDescription(
                            `Você já pegou seu daily hoje!\n\n` +
                            `🕐 Próximo daily em **${formatarTempo(restante)}**.\n` +
                            `📅 Disponível em **${formatarHorario(proximoDaily)}**.`
                        );

                const row =
                    criarBotaoNotificacao(
                        notificacaoAtiva
                    );

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }

            const {
                embed,
                row
            } = await entregarDaily(
                userId,
                interaction.user
            );

            await interaction.reply({
                embeds: [embed],
                components: [row]
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

            dailyProcessando.delete(userId);
        }
    },

    // =====================================================
    // 🔤 COMANDO POR PREFIXO
    // =====================================================

    async handlePrefix(message) {

        const userId =
            message.author.id;

        // 🛡️ Evita duas execuções simultâneas
        if (dailyProcessando.has(userId)) {
            return;
        }

        dailyProcessando.add(userId);

        try {

            const ultimoDaily =
                await getUltimoDaily(userId);

            if (
                ultimoDaily &&
                mesmoDiaBrasilia(ultimoDaily)
            ) {

                const {
                    proximoDaily,
                    restante
                } = calcularTempoRestante();

                const notificacaoAtiva =
                    await getNotificacaoDaily(userId);

                const embed =
                    new EmbedBuilder()
                        .setTitle("⏳ DAILY")
                        .setDescription(
                            `Você já pegou seu daily hoje!\n\n` +
                            `🕐 Próximo daily em **${formatarTempo(restante)}**.\n` +
                            `📅 Disponível em **${formatarHorario(proximoDaily)}**.`
                        );

                const row =
                    criarBotaoNotificacao(
                        notificacaoAtiva
                    );

                return message.reply({
                    embeds: [embed],
                    components: [row]
                });
            }

            const {
                embed,
                row
            } = await entregarDaily(
                userId,
                message.author
            );

            await message.reply({
                embeds: [embed],
                components: [row]
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

            dailyProcessando.delete(userId);
        }
    },

    // =====================================================
    // 🔘 BOTÃO DE NOTIFICAÇÃO
    // =====================================================

    async handleButton(interaction) {

        if (
            interaction.customId !==
            "daily_notificar"
        ) {
            return;
        }

        const userId =
            interaction.user.id;

        const notificacaoAtiva =
            await getNotificacaoDaily(userId);

        if (notificacaoAtiva) {

            return interaction.reply({
                content:
                    "🔔 Você já ativou a notificação do daily!",
                ephemeral: true
            });
        }

        const ultimoDaily =
            await getUltimoDaily(userId);

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
        } = calcularTempoRestante();

        if (restante <= 0) {

            return interaction.reply({
                content:
                    "🎁 Seu daily já está disponível! Use `/daily`.",
                ephemeral: true
            });
        }

        // =================================================
        // 💾 SALVAR NO POSTGRESQL
        // =================================================

        await salvarNotificacaoDaily(
            userId,
            true
        );

        // =================================================
        // ⏰ LIMPAR TIMER ANTIGO
        // =================================================

        if (
            timersNotificacao.has(userId)
        ) {

            clearTimeout(
                timersNotificacao.get(userId)
            );
        }

        // =================================================
        // 🔔 CRIAR NOVO TIMER
        // =================================================

        const timer =
            setTimeout(
                async () => {

                    try {

                        await interaction.user.send(
                            "🔔 **Seu daily está disponível!**\n\n" +
                            "Já passou da meia-noite! 🌙\n" +
                            "Use `/daily` no servidor para receber sua recompensa. 💰"
                        );

                    } catch (erro) {

                        console.log(
                            `⚠️ Não foi possível enviar DM para ${interaction.user.tag}.`
                        );
                    }

                    try {

                        await salvarNotificacaoDaily(
                            userId,
                            false
                        );

                    } catch (erro) {

                        console.error(
                            "❌ Erro ao atualizar notificação:",
                            erro
                        );
                    }

                    timersNotificacao.delete(
                        userId
                    );

                },
                restante
            );

        timersNotificacao.set(
            userId,
            timer
        );

        await interaction.reply({
            content:
                `✅ Pronto! Vou te avisar quando o daily estiver disponível às **${formatarHorario(proximoDaily)}**. 🔔`,
            ephemeral: true
        });
    }
};
