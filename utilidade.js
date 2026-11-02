// =====================================================
// 🧰 UTILIDADE: LEMBRETES E AFK
// =====================================================
// Para ligar: no index.js, logo depois de `criarcall.iniciar(client);`
// coloque:  require("./utilidade.js").iniciar(client);
//
// As tabelas "lembretes" e "afk" são criadas sozinhas.

const { Events } = require("discord.js");

const { mysqlPool } = require("./database/database.js");

// =====================================================
// ⚙️ CONFIGURAÇÕES (pode mexer)
// =====================================================

const PREFIXO = "'";
const CHECAR_LEMBRETES_MS = 20 * 1000;
const MAX_LEMBRETES_POR_PESSOA = 10;
const MAX_TEMPO_LEMBRETE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TEXTO = 300;
const MAX_AFK_AVISOS = 3;

// =====================================================
// ⏱️ TEMPO ("10m", "2h", "1d", "1h30m")
// =====================================================

function lerTempo(texto) {
    const t = String(texto || "").toLowerCase().replace(/\s+/g, "");

    if (!/^(\d{1,6}[smhd])+$/.test(t)) return null;

    const unidade = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    let total = 0;

    for (const m of t.matchAll(/(\d{1,6})([smhd])/g)) {
        total += Number(m[1]) * unidade[m[2]];
    }

    return total > 0 ? total : null;
}

function textoTempo(ms) {
    const dias = Math.floor(ms / 86400000);
    const horas = Math.floor((ms % 86400000) / 3600000);
    const minutos = Math.floor((ms % 3600000) / 60000);
    const segundos = Math.floor((ms % 60000) / 1000);

    const partes = [];

    if (dias) partes.push(`${dias}d`);
    if (horas) partes.push(`${horas}h`);
    if (minutos) partes.push(`${minutos}min`);
    if (segundos && !dias && !horas) partes.push(`${segundos}s`);

    return partes.join(" ") || "menos de 1s";
}

// =====================================================
// 🗃️ TABELAS
// =====================================================

let tabelasProntas = false;

async function prepararTabelas() {
    if (tabelasProntas) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS lembretes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(30) NOT NULL,
            canal_id VARCHAR(30),
            texto VARCHAR(400) NOT NULL,
            quando BIGINT NOT NULL,
            INDEX idx_lembretes_quando (quando),
            INDEX idx_lembretes_usuario (user_id)
        )
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS afk (
            guild_id VARCHAR(30) NOT NULL,
            user_id VARCHAR(30) NOT NULL,
            motivo VARCHAR(200) NOT NULL,
            desde BIGINT NOT NULL,
            PRIMARY KEY (guild_id, user_id)
        )
    `);

    tabelasProntas = true;
}

// =====================================================
// ⏰ LEMBRETES
// =====================================================

async function criarLembrete({ usuario, canalId, tempo, texto }) {
    await prepararTabelas();

    const ms = lerTempo(tempo);

    if (!ms) {
        return { erro: "Tempo inválido. Use por exemplo `10m`, `2h`, `1d` ou `1h30m`." };
    }

    if (ms < 10 * 1000) {
        return { erro: "O mínimo é **10 segundos**." };
    }

    if (ms > MAX_TEMPO_LEMBRETE_MS) {
        return { erro: "O máximo é **30 dias** (`30d`)." };
    }

    const mensagem = String(texto || "").trim().slice(0, MAX_TEXTO);

    if (!mensagem) {
        return { erro: "Diga do que devo te lembrar." };
    }

    const [[contagem]] = await mysqlPool.query(
        "SELECT COUNT(*) AS total FROM lembretes WHERE user_id = ?",
        [usuario.id]
    );

    if (Number(contagem.total) >= MAX_LEMBRETES_POR_PESSOA) {
        return { erro: `Você já tem **${MAX_LEMBRETES_POR_PESSOA}** lembretes. Apague algum com \`/lembrete remover\`.` };
    }

    const quando = Date.now() + ms;

    const [r] = await mysqlPool.query(
        "INSERT INTO lembretes (user_id, canal_id, texto, quando) VALUES (?, ?, ?, ?)",
        [usuario.id, canalId || null, mensagem, quando]
    );

    return {
        resposta:
            `⏰ Combinado! Vou te lembrar <t:${Math.floor(quando / 1000)}:R> (<t:${Math.floor(quando / 1000)}:f>).\n` +
            `ID do lembrete: **${r.insertId}**`
    };
}

async function listarLembretes({ usuario }) {
    await prepararTabelas();

    const [linhas] = await mysqlPool.query(
        "SELECT id, texto, quando FROM lembretes WHERE user_id = ? ORDER BY quando ASC",
        [usuario.id]
    );

    if (!linhas.length) {
        return { resposta: "⏰ Você não tem lembretes. Crie um com `/lembrete criar`." };
    }

    const texto = linhas
        .map(l => `**#${l.id}** • <t:${Math.floor(Number(l.quando) / 1000)}:R>\n┗ ${String(l.texto).replace(/@/g, "@​")}`)
        .join("\n\n");

    return { resposta: `⏰ **Seus lembretes**\n\n${texto}`.slice(0, 1900) };
}

async function removerLembrete({ usuario, id }) {
    await prepararTabelas();

    const numero = Number(id);

    if (!Number.isInteger(numero) || numero < 1) {
        return { erro: "Informe o número do lembrete (aparece em `/lembrete listar`)." };
    }

    const [r] = await mysqlPool.query(
        "DELETE FROM lembretes WHERE id = ? AND user_id = ?",
        [numero, usuario.id]
    );

    if (!r.affectedRows) {
        return { erro: "Não achei esse lembrete seu." };
    }

    return { resposta: `🗑️ Lembrete **#${numero}** removido.` };
}

let verificando = false;

async function entregarLembretes(client) {
    if (verificando) return;

    verificando = true;

    try {
        await prepararTabelas();

        const [vencidos] = await mysqlPool.query(
            "SELECT id, user_id, canal_id, texto FROM lembretes WHERE quando <= ? ORDER BY quando ASC LIMIT 20",
            [Date.now()]
        );

        for (const l of vencidos) {
            // Apaga primeiro: se der erro ao enviar, não repete para sempre.
            const [apagou] = await mysqlPool.query(
                "DELETE FROM lembretes WHERE id = ?",
                [l.id]
            );

            if (!apagou.affectedRows) continue;

            const conteudo = `⏰ <@${l.user_id}>, lembrete: **${String(l.texto).replace(/@/g, "@​")}**`;

            let enviou = false;

            if (l.canal_id) {
                try {
                    const canal = await client.channels.fetch(l.canal_id);

                    await canal.send({
                        content: conteudo,
                        allowedMentions: { users: [l.user_id] }
                    });

                    enviou = true;
                } catch {
                    // canal apagado ou sem permissão: tenta a DM
                }
            }

            if (!enviou) {
                try {
                    const usuario = await client.users.fetch(l.user_id);

                    await usuario.send(conteudo);
                } catch {
                    // DM fechada: nada a fazer
                }
            }
        }
    } catch (e) {
        console.error("❌ Erro ao entregar lembretes:", e);
    } finally {
        verificando = false;
    }
}

// =====================================================
// 💤 AFK
// =====================================================

// "guild|user" -> { motivo, desde }  (cópia na memória para não
// consultar o banco a cada mensagem)
const afkNaMemoria = new Map();

async function carregarAfk() {
    await prepararTabelas();

    const [linhas] = await mysqlPool.query("SELECT guild_id, user_id, motivo, desde FROM afk");

    for (const l of linhas) {
        afkNaMemoria.set(`${l.guild_id}|${l.user_id}`, {
            motivo: l.motivo,
            desde: Number(l.desde)
        });
    }
}

async function ficarAfk({ usuario, guild, motivo }) {
    if (!guild) return { erro: "Isso só funciona dentro de um servidor." };

    await prepararTabelas();

    const texto = String(motivo || "").trim().slice(0, 200) || "Sem motivo informado.";
    const desde = Date.now();

    await mysqlPool.query(
        `INSERT INTO afk (guild_id, user_id, motivo, desde) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE motivo = VALUES(motivo), desde = VALUES(desde)`,
        [guild.id, usuario.id, texto, desde]
    );

    afkNaMemoria.set(`${guild.id}|${usuario.id}`, { motivo: texto, desde });

    return {
        resposta:
            `💤 Você está **AFK**: ${texto.replace(/@/g, "@​")}\n` +
            "Quando você mandar uma mensagem, eu tiro o AFK sozinho."
    };
}

async function sairDoAfk(guildId, userId) {
    afkNaMemoria.delete(`${guildId}|${userId}`);

    await mysqlPool.query(
        "DELETE FROM afk WHERE guild_id = ? AND user_id = ?",
        [guildId, userId]
    );
}

async function tratarMensagemAfk(mensagem) {
    if (!mensagem.guild || mensagem.author.bot || mensagem.webhookId) return;

    // Mensagens de comando (ex.: "'afk") não contam como "voltei".
    if (mensagem.content.startsWith(PREFIXO)) return;

    const guildId = mensagem.guild.id;

    const meu = afkNaMemoria.get(`${guildId}|${mensagem.author.id}`);

    if (meu) {
        await sairDoAfk(guildId, mensagem.author.id);

        await mensagem.reply({
            content: `👋 Bem-vindo de volta, ${mensagem.author}! Você ficou AFK por **${textoTempo(Date.now() - meu.desde)}**.`,
            allowedMentions: { parse: [], repliedUser: false }
        });
    }

    if (!afkNaMemoria.size || !mensagem.mentions.users.size) return;

    const avisos = [];

    for (const [id, usuario] of mensagem.mentions.users) {
        if (id === mensagem.author.id) continue;

        const info = afkNaMemoria.get(`${guildId}|${id}`);

        if (info) {
            avisos.push(
                `💤 **${String(usuario.displayName || usuario.username).replace(/@/g, "@​")}** está AFK desde <t:${Math.floor(info.desde / 1000)}:R>: ${info.motivo.replace(/@/g, "@​")}`
            );
        }

        if (avisos.length >= MAX_AFK_AVISOS) break;
    }

    if (avisos.length) {
        await mensagem.reply({
            content: avisos.join("\n"),
            allowedMentions: { parse: [], repliedUser: false }
        });
    }
}

// =====================================================
// 🚀 INICIAR
// =====================================================

function iniciar(client) {
    carregarAfk().catch(e => console.error("❌ Erro ao carregar o AFK:", e));

    setInterval(() => entregarLembretes(client), CHECAR_LEMBRETES_MS);

    client.on(Events.MessageCreate, mensagem => {
        tratarMensagemAfk(mensagem).catch(e =>
            console.error("❌ Erro no AFK:", e)
        );
    });
}

module.exports = {
    iniciar,
    lerTempo,
    textoTempo,
    criarLembrete,
    listarLembretes,
    removerLembrete,
    entregarLembretes,
    ficarAfk,
    tratarMensagemAfk,
    _afkNaMemoria: afkNaMemoria
};
