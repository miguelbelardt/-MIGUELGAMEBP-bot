const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    getSaldo,
    alterarSaldo
} = require("../database/database");

const cooldowns = new Map();
const notificacoes = new Set();
const timersNotificacao = new Map();

const COOLDOWN = 24 * 60 * 60 * 1000;
const RECOMPENSA = 100;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Resgate sua recompensa diária! 💰"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const agora = Date.now();

        if (cooldowns.has(userId)) {
            const ultimoDaily = cooldowns.get(userId);
            const proximoDaily = ultimoDaily + COOLDOWN;
            const restante = proximoDaily - agora;

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

                const dataProximoDaily = new Date(proximoDaily);

                const horario = dataProximoDaily.toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                });

                const embed = new EmbedBuilder()
                    .setTitle("⏳ DAILY")
                    .setDescription(
                        `Você já pegou seu daily!\n\n` +
                        `🕐 Próximo daily em **${horas}h ${minutos}min ${segundos}s**.\n` +
                        `📅 Disponível em **${horario}**.`
                    );

                const notificacaoAtiva = notificacoes.has(userId);

                const botao = new ButtonBuilder()
                    .setCustomId("daily_notificar")
                    .setLabel(
                        notificacaoAtiva
                            ? "🔔 Notificação ativada"
                            : "🔔 Me notificar"
                    )
                    .setStyle(
                        notificacaoAtiva
                            ? ButtonStyle.Success
                            : ButtonStyle.Primary
                    )
                    .setDisabled(notificacaoAtiva);

                const row = new ActionRowBuilder()
                    .addComponents(botao);

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }

            // Cooldown terminou
            cooldowns.delete(userId);
        }

        cooldowns.set(userId, agora);

        // 💾 Adicionar recompensa ao banco
        await alterarSaldo(userId, RECOMPENSA);

        const novoSaldo = await getSaldo(userId);

        const proximoDaily = new Date(agora + COOLDOWN);

        const horario = proximoDaily.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        const embed = new EmbedBuilder()
            .setTitle("🎁 DAILY")
            .setDescription(
                `Parabéns, ${interaction.user}!\n\n` +
                `💰 Você recebeu **${RECOMPENSA} moedas**!\n` +
                `💳 Seu saldo agora é **${novoSaldo} moedas**.\n\n` +
                `🕐 Seu próximo daily estará disponível em **${horario}**.`
            )
            .setFooter({
                text: "Volte amanhã para pegar novamente!"
            });

        const botao = new ButtonBuilder()
            .setCustomId("daily_notificar")
            .setLabel("🔔 Me notificar amanhã")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(botao);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },

    async handleButton(interaction) {
        if (interaction.customId !== "daily_notificar") return;

        const userId = interaction.user.id;

        if (notificacoes.has(userId)) {
            return interaction.reply({
                content: "🔔 Você já ativou a notificação do daily!",
                ephemeral: true
            });
        }

        const ultimoDaily = cooldowns.get(userId);

        if (!ultimoDaily) {
            return interaction.reply({
                content: "❌ Você ainda não precisa de uma notificação. Use o `/daily` quando estiver disponível.",
                ephemeral: true
            });
        }

        const agora = Date.now();
        const proximoDaily = ultimoDaily + COOLDOWN;
        const restante = proximoDaily - agora;

        if (restante <= 0) {
            return interaction.reply({
                content: "🎁 Seu daily já está disponível! Use `/daily`.",
                ephemeral: true
            });
        }

        notificacoes.add(userId);

        // Remove timer anterior, se existir
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
