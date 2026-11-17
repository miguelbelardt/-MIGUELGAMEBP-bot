// =====================================================
// 🎁 DAILY (resgate pelo site + aviso automático por DM)
// =====================================================
// O daily agora é pego no painel do site (não existe mais o /daily).
//  - Quem resgata ganha moedas sorteadas e o aviso por DM liga sozinho.
//  - O dia vira à meia-noite de Brasília.
//  - O bot manda uma DM quando o próximo daily estiver disponível.
//
// Para ligar o aviso automático: no index.js, junto das outras linhas
// "iniciar", coloque:
//   require("./painelDaily.js").iniciarNotificacoes(client);

const { EmbedBuilder } = require("discord.js");

const {
    getSaldo,
    getUltimoDaily,
    getSequenciaDaily,
    getNotificacaoDaily,
    salvarNotificacaoDaily,
    mysqlPool
} = require("./database/database.js");

const configUsuario = require("./configUsuario.js");

const TIMEZONE = "America/Sao_Paulo";
const OFFSET_BRASILIA = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const JANELA_NOTIFICACAO = 30 * 60 * 1000;
const TEMPO_RETRY_NOTIFICACAO = 5 * 60 * 1000;
const VERIFICAR_A_CADA_MS = 30 * 1000;

const SITE_URL = (process.env.SITE_URL || "https://miguelbelardt.github.io").replace(/\/+$/, "");
const SITE_PATH = process.env.SITE_PATH || "/-MIGUELGAMEBP-bot/";
const LINK_PAINEL = `${SITE_URL}${SITE_PATH}painel.html`;

const EMOJIS = {
    sino: "<:Notification_Bell:1543405169952170048>",
    lua: "<:SoftBunnyMoon:1530045353577939124>",
    sequencia: "<:fogo:1561078556660858970>",
    dinheiro: "<:coin:1543417629413351564>"
};

// =====================================================
// 📅 DIA DE BRASÍLIA
// =====================================================

function inicioDoDiaBrasilia(agora = new Date()) {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(agora);

    const pega = tipo => Number(partes.find(p => p.type === tipo).value);

    return Date.UTC(pega("year"), pega("month") - 1, pega("day")) + OFFSET_BRASILIA;
}

function horarioDaNotificacao(inicioHoje) {
    // depois da meia-noite, dentro de uma janela de 30 minutos (evita todo mundo de uma vez)
    return inicioHoje + DIA_MS + Math.floor(Math.random() * (JANELA_NOTIFICACAO + 1));
}

// =====================================================
// 💰 RECOMPENSA
// =====================================================

function sortearRecompensa() {
    const sorteio = Math.random() * 100;

    if (sorteio < 45) return Math.floor(Math.random() * 401) + 100;
    if (sorteio < 75) return Math.floor(Math.random() * 1500) + 501;
    if (sorteio < 90) return Math.floor(Math.random() * 3000) + 2001;
    if (sorteio < 97) return Math.floor(Math.random() * 5000) + 5001;
    if (sorteio < 99.5) return Math.floor(Math.random() * 10000) + 10001;

    return Math.floor(Math.random() * 5000) + 20001;
}

// =====================================================
// 📊 STATUS
// =====================================================

async function lerHorarioNotificacao(userId) {
    const [linhas] = await mysqlPool.query(
        "SELECT notificacao_daily_em FROM usuarios WHERE id = ?",
        [String(userId)]
    );

    const valor = Number(linhas[0]?.notificacao_daily_em);

    return Number.isFinite(valor) && valor > 0 ? valor : null;
}

async function status(userId, agora = Date.now()) {
    const [saldo, ultimo, sequenciaBanco, notificacaoAtiva] = await Promise.all([
        getSaldo(userId),
        getUltimoDaily(userId),
        getSequenciaDaily(userId),
        getNotificacaoDaily(userId)
    ]);

    const inicioHoje = inicioDoDiaBrasilia(new Date(agora));

    const pegouHoje = !!ultimo && ultimo >= inicioHoje;
    const pegouOntem = !!ultimo && !pegouHoje && ultimo >= inicioHoje - DIA_MS;

    // Passou mais de um dia sem pegar: a sequência foi perdida
    const sequenciaViva = pegouHoje || pegouOntem;

    return {
        saldo,
        sequencia: sequenciaViva ? Number(sequenciaBanco) || 0 : 0,
        sequenciaPerdida: !!ultimo && !sequenciaViva && (Number(sequenciaBanco) || 0) > 0,
        nuncaPegou: !ultimo,
        ultimoDaily: ultimo || null,
        pegouHoje,
        disponivel: !pegouHoje,
        proximoEm: pegouHoje ? inicioHoje + DIA_MS : null,
        notificacao: {
            ativa: !!notificacaoAtiva,
            em: notificacaoAtiva ? await lerHorarioNotificacao(userId) : null,
            // só dá para ligar depois de pegar o daily de hoje
            podeLigar: pegouHoje
        }
    };
}

// =====================================================
// 🎁 RESGATAR (atômico: nunca paga duas vezes no mesmo dia)
// =====================================================

async function resgatar(userId, agora = Date.now()) {
    const id = String(userId);

    await mysqlPool.query(
        `INSERT IGNORE INTO usuarios
            (id, saldo, ultimo_daily, notificacao_daily, notificacao_daily_em, daily_sequencia)
         VALUES (?, 0, NULL, FALSE, NULL, 0)`,
        [id]
    );

    const [linhas] = await mysqlPool.query(
        "SELECT ultimo_daily, daily_sequencia FROM usuarios WHERE id = ?",
        [id]
    );

    const dados = linhas[0];

    if (!dados) throw new Error("Usuário não encontrado após criação.");

    const inicioHoje = inicioDoDiaBrasilia(new Date(agora));
    const ultimo = dados.ultimo_daily ? Number(dados.ultimo_daily) : null;

    if (ultimo && ultimo >= inicioHoje) return { sucesso: false };

    const sequenciaAtual = Number(dados.daily_sequencia) || 0;

    // pegou ontem = continua a sequência; senão recomeça em 1
    const novaSequencia = ultimo && ultimo >= inicioHoje - DIA_MS ? sequenciaAtual + 1 : 1;

    const recompensa = sortearRecompensa();

    // O aviso liga sozinho (a não ser que a pessoa tenha desligado as DMs do bot no /config)
    const config = await configUsuario.obter(id);
    const avisar = config.receber_dm !== false;
    const horario = avisar ? horarioDaNotificacao(inicioHoje) : null;

    const [resultado] = await mysqlPool.query(
        `UPDATE usuarios
         SET saldo = COALESCE(saldo, 0) + ?,
             ultimo_daily = ?,
             daily_sequencia = ?,
             notificacao_daily = ?,
             notificacao_daily_em = ?
         WHERE id = ?
           AND (ultimo_daily IS NULL OR ultimo_daily < ?)`,
        [recompensa, agora, novaSequencia, avisar ? 1 : 0, horario, id, inicioHoje]
    );

    // Outro pedido passou na frente (duplo clique, duas abas...)
    if (!resultado.affectedRows) return { sucesso: false };

    return {
        sucesso: true,
        recompensa,
        sequencia: novaSequencia
    };
}

// =====================================================
// 🔔 LIGAR / DESLIGAR O AVISO PELO SITE
// =====================================================

async function definirNotificacao(userId, ativa, agora = Date.now()) {
    if (typeof ativa !== "boolean") return { erro: "Valor inválido." };

    if (!ativa) {
        await salvarNotificacaoDaily(userId, false);

        return { ok: true };
    }

    const ultimo = await getUltimoDaily(userId);

    if (!ultimo) return { erro: "Você ainda não pegou nenhum daily." };

    const inicioHoje = inicioDoDiaBrasilia(new Date(agora));

    if (ultimo < inicioHoje) return { erro: "Seu daily já está disponível! Resgate no painel." };

    await salvarNotificacaoDaily(userId, true, horarioDaNotificacao(inicioHoje));

    return { ok: true };
}

// =====================================================
// 📩 AVISO AUTOMÁTICO POR DM
// =====================================================

function dmFechada(erro) {
    return erro?.code === 50007;
}

async function verificarNotificacoes(client) {
    try {
        const [usuarios] = await mysqlPool.query(
            `SELECT id, ultimo_daily, notificacao_daily_em, daily_sequencia
             FROM usuarios
             WHERE notificacao_daily = TRUE AND ultimo_daily IS NOT NULL`
        );

        const agora = Date.now();
        const inicioHoje = inicioDoDiaBrasilia(new Date(agora));

        for (const usuario of usuarios) {
            const userId = String(usuario.id);
            const ultimo = Number(usuario.ultimo_daily);

            // Já pegou hoje: nada a avisar ainda
            if (ultimo >= inicioHoje) continue;

            // Quem desligou as DMs do bot no /config não recebe
            const config = await configUsuario.obter(userId);

            if (config.receber_dm === false) {
                await salvarNotificacaoDaily(userId, false);

                continue;
            }

            let horario = usuario.notificacao_daily_em ? Number(usuario.notificacao_daily_em) : null;

            // Sem horário guardado (ex.: bot reiniciou): avisa dentro da janela de hoje
            if (!Number.isFinite(horario) || !horario) {
                horario = agora <= inicioHoje + JANELA_NOTIFICACAO
                    ? inicioHoje + Math.floor(Math.random() * (JANELA_NOTIFICACAO + 1))
                    : agora;

                await salvarNotificacaoDaily(userId, true, horario);
            }

            if (agora < horario) continue;

            const sequenciaViva = ultimo >= inicioHoje - DIA_MS;
            const proxima = sequenciaViva ? (Number(usuario.daily_sequencia) || 0) + 1 : 1;

            try {
                const discordUser = await client.users.fetch(userId);

                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`${EMOJIS.sino} Seu Daily está disponível!`)
                    .setDescription(
                        `Olá, ${discordUser}!\n\n` +
                        `${EMOJIS.lua} Um novo dia começou e sua recompensa diária já está disponível!\n\n` +
                        `${EMOJIS.sequencia} Se você resgatar hoje, sua sequência será de **${proxima} dia(s)**!\n\n` +
                        `${EMOJIS.dinheiro} Resgate no painel:\n${LINK_PAINEL}`
                    )
                    .setFooter({ text: "Não esqueça de pegar seu Daily hoje!" });

                await discordUser.send({ embeds: [embed] });

                console.log(`🔔 Notificação do Daily enviada para ${discordUser.tag}`);

                await salvarNotificacaoDaily(userId, false);
            } catch (erro) {
                if (dmFechada(erro)) {
                    // DM fechada: não adianta tentar de novo
                    await salvarNotificacaoDaily(userId, false);

                    console.log(`⚠️ DM fechada para ${userId}: aviso do Daily desligado.`);

                    continue;
                }

                console.log(`⚠️ Não foi possível enviar o aviso do Daily para ${userId}: ${erro?.message || erro}`);

                await salvarNotificacaoDaily(userId, true, Date.now() + TEMPO_RETRY_NOTIFICACAO)
                    .catch(e => console.error("❌ Erro ao reagendar aviso do Daily:", e?.message || e));
            }
        }
    } catch (erro) {
        console.error("❌ Erro ao verificar notificações do Daily:", erro);
    }
}

function iniciarNotificacoes(client) {
    console.log("🔔 Sistema de notificações do Daily iniciado.");

    verificarNotificacoes(client);

    setInterval(() => verificarNotificacoes(client), VERIFICAR_A_CADA_MS);
}

module.exports = {
    status,
    resgatar,
    definirNotificacao,
    iniciarNotificacoes,
    _teste: { inicioDoDiaBrasilia, sortearRecompensa, verificarNotificacoes }
};
