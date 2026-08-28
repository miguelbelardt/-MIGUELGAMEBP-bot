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
    salvarUltimoDaily
} = require("../database/database");

const notificacoes = new Set();
const timersNotificacao = new Map();

const COOLDOWN = 24 * 60 * 60 * 1000;

// =====================================================
// 💰 SORTEIO DA RECOMPENSA
// =====================================================

function sortearRecompensa() {
    const sorteio = Math.random() * 100;

    // 45% → 100 até 500
    if (sorteio < 45) {
        return Math.floor(Math.random() * (500 - 100 + 1)) + 100;
    }

    // 30% → 501 até 2.000
    if (sorteio < 75) {
        return Math.floor(Math.random() * (2000 - 501 + 1)) + 501;
    }

    // 15% → 2.001 até 5.000
    if (sorteio < 90) {
        return Math.floor(Math.random() * (5000 - 2001 + 1)) + 2001;
    }

    // 7% → 5.001 até 10.000
    if (sorteio < 97) {
        return Math.floor(Math.random() * (10000 - 5001 + 1)) + 5001;
    }

    // 2,5% → 10.001 até 20.000
    if (sorteio < 99.5) {
        return Math.floor(Math.random() * (20000 - 10001 + 1)) + 10001;
    }

    // 0,5% → 20.001 até 25.000
    return Math.floor(Math.random() * (25000 - 20001 + 1)) + 20001;
}

// =====================================================
// ⏰ FORMATAR HORÁRIO
// =====================================================

function formatarHorario(timestamp) {
    return new Date(timestamp).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

// =====================================================
// ⏳ INFORMAÇÃO DO COOLDOWN
// =====================================================

function calcularTempoRestante(ultimoDaily) {
    const proximoDaily = ultimoDaily + COOLDOWN;
    const restante = proximoDaily - Date.now();

    return {
        proximoDaily,
        restante
    };
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
// 💬 SLASH COMMAND
// =====================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Resgate sua recompensa diária! 💰"),

    async execute(interaction) {
        const userId = interaction.user.id;

        const ultimoDaily = await getUltimoDaily(userId);

        if (ultimoDaily) {
            const { proximoDaily, restante } =
                calcularTempoRestante(ultimoDaily);

            if (restante > 0) {
                const horas = Math.floor(
                    restante / (1000 * 60 * 60)
                );

                const minutos = Math.floor(
                    (restante % (1000 * 60 * 60)) / (1000 * 60)
                );

                const segundos = Math.floor(
                    (restante % (1000 * 60)) / 1000
                );

                const embed = new EmbedBuilder()
                    .setTitle("⏳ DAILY")
                    .setDescription(
                        `Você já pegou seu daily!\n\n` +
                        `🕐 Próximo daily em **${horas}h ${minutos}min ${segundos}s**.\n` +
                        `📅 Disponível em **${formatarHorario(proximoDaily)}**.`
                    );

                const row = criarBotaoNotificacao(
                    notificacoes.has(userId)
                );

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }
        }

        const agora = Date.now();
        const recompensa = sortearRecompensa();

        await alterarSaldo(userId, recompensa);
        await salvarUltimoDaily(userId, agora);

        const novoSaldo = await getSaldo(userId);
        const proximoDaily = agora + COOLDOWN;

        const embed = new EmbedBuilder()
            .setTitle("🎁 DAILY")
            .setDescription(
                `Parabéns, ${interaction.user}!\n\n` +
                `🎲 Você ganhou **${recompensa} moedas**!\n` +
                `💳 Seu saldo agora é **${novoSaldo} moedas**.\n\n` +
                `🕐 Seu próximo daily estará disponível em **${formatarHorario(proximoDaily)}**.`
            )
            .setFooter({
                text: "Volte amanhã para tentar a sorte novamente!"
            });

        const row = criarBotaoNotificacao();

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },

    // =====================================================
    // 🔤 COMANDO POR PREFIXO
    // =====================================================

    async handlePrefix(message) {
        const userId = message.author.id;

        try {
            const ultimoDaily = await getUltimoDaily(userId);

            if (ultimoDaily) {
                const { proximoDaily, restante } =
                    calcularTempoRestante(ultimoDaily);

                if (restante > 0) {
                    const horas = Math.floor(
                        restante / (1000 * 60 * 60)
                    );

                    const minutos = Math.floor(
                        (restante % (1000 * 60 * 60)) / (1000 * 60)
                    );

                    const segundos = Math.floor(
                        (restante % (1000 * 60)) / 1000
                    );

                    const embed = new EmbedBuilder()
                        .setTitle("⏳ DAILY")
                        .setDescription(
                            `Você já pegou seu daily!\n\n` +
                            `🕐 Próximo daily em **${horas}h ${minutos}min ${segundos}s**.\n` +
                            `📅 Disponível em **${formatarHorario(proximoDaily)}**.`
                        );

                    const row = criarBotaoNotificacao(
                        notificacoes.has(userId)
                    );

                    return message.reply({
                        embeds: [embed],
                        components: [row]
                    });
                }
            }

            const agora = Date.now();
            const recompensa = sortearRecompensa();

            await alterarSaldo(userId, recompensa);
            await salvarUltimoDaily(userId, agora);

            const novoSaldo = await getSaldo(userId);
            const proximoDaily = agora + COOLDOWN;

            const embed = new EmbedBuilder()
                .setTitle("🎁 DAILY")
                .setDescription(
                    `Parabéns, ${message.author}!\n\n` +
                    `🎲 Você ganhou **${recompensa} moedas**!\n` +
                    `💳 Seu saldo agora é **${novoSaldo} moedas**.\n\n` +
                    `🕐 Seu próximo daily estará disponível em **${formatarHorario(proximoDaily)}**.`
                )
                .setFooter({
                    text: "Volte amanhã para tentar a sorte novamente!"
                });

            const row = criarBotaoNotificacao();

            await message.reply({
                embeds: [embed],
                components: [row]
            });

        } catch (erro) {
            console.error("❌ Erro no Daily por prefixo:", erro);

            await message.reply(
                "❌ Não foi possível processar seu daily."
            );
        }
    },

    // =====================================================
    // 🔘 BOTÃO DE NOTIFICAÇÃO
    // =====================================================

    async handleButton(interaction) {
        if (interaction.customId !== "daily_notificar") return;

        const userId = interaction.user.id;

        if (notificacoes.has(userId)) {
            return interaction.reply({
                content: "🔔 Você já ativou a notificação do daily!",
                ephemeral: true
            });
        }

        const ultimoDaily = await getUltimoDaily(userId);

        if (!ultimoDaily) {
            return interaction.reply({
                content:
                    "❌ Você ainda não precisa de uma notificação. Use o `/daily` quando estiver disponível.",
                ephemeral: true
            });
        }

        const { proximoDaily, restante } =
            calcularTempoRestante(ultimoDaily);

        if (restante <= 0) {
            return interaction.reply({
                content:
                    "🎁 Seu daily já está disponível! Use `/daily`.",
                ephemeral: true
            });
        }

        notificacoes.add(userId);

        if (timersNotificacao.has(userId)) {
            clearTimeout(timersNotificacao.get(userId));
        }

        const timer = setTimeout(async () => {
            try {
                await interaction.user.send(
                    "🔔 **Seu daily está disponível!**\n\n" +
                    "Use `/daily` no servidor para receber sua recompensa. 💰"
                );
            } catch (erro) {
                console.log(
                    `⚠️ Não foi possível enviar DM para ${interaction.user.tag}.`
                );
            }

            notificacoes.delete(userId);
            timersNotificacao.delete(userId);
        }, restante);

        timersNotificacao.set(userId, timer);

        await interaction.reply({
            content:
                "✅ Pronto! Vou te mandar uma mensagem quando seu próximo daily estiver disponível.",
            ephemeral: true
        });
    }
};
