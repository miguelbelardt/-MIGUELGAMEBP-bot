// =====================================================
// 🚫 BAN DO BOT (impede a pessoa de usar o bot)
// =====================================================
// Quem está banido não consegue usar nenhum comando: slash, prefixo,
// botões, menus, formulários... O bot responde só com um aviso.
// (Isso é diferente do /ban, que bane do servidor do Discord.)
//
// Para ligar: no index.js, junto das outras linhas "iniciar", coloque:
//   require("./banbot.js").iniciar(client);
//
// Só o dono do bot e os ADMs do bot (/dar-adm) podem banir/desbanir.
// A tabela "banidos_bot" é criada sozinha.

const { MessageFlags } = require("discord.js");

const { mysqlPool, isAdm } = require("./database/database.js");
const { nomeBot } = require("./botNome.js");

const DONO_ID = "1124140396516225044";
const PREFIXO = "'";
const AVISO_A_CADA_MS = 60 * 1000;
const MAX_MOTIVO = 200;

// id -> motivo (fica na memória para a checagem ser instantânea)
const banidos = new Map();
const ultimoAviso = new Map();

let tabelaPronta = false;

async function prepararTabela() {
    if (tabelaPronta) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS banidos_bot (
            user_id VARCHAR(30) PRIMARY KEY,
            motivo VARCHAR(200) NOT NULL,
            por VARCHAR(30) NOT NULL,
            criado_em BIGINT NOT NULL
        )
    `);

    tabelaPronta = true;
}

async function carregar() {
    await prepararTabela();

    const [linhas] = await mysqlPool.query("SELECT user_id, motivo FROM banidos_bot");

    for (const l of linhas) banidos.set(l.user_id, l.motivo);
}

function textoAviso(motivo) {
    return (
        `🚫 Você foi banido de usar o **${nomeBot()}**.\n` +
        `Motivo: ${String(motivo).replace(/@/g, "@​")}`
    );
}

async function avisarInteracao(interacao, motivo) {
    try {
        if (interacao.isAutocomplete?.()) {
            await interacao.respond([]);
            return;
        }

        if (interacao.isRepliable?.()) {
            await interacao.reply({
                content: textoAviso(motivo),
                flags: MessageFlags.Ephemeral
            });
        }
    } catch {
        // já respondida ou expirada: sem problema
    }
}

async function avisarMensagem(mensagem, motivo) {
    const agora = Date.now();

    // Não responde várias vezes seguidas para a mesma pessoa.
    if (agora - (ultimoAviso.get(mensagem.author.id) || 0) < AVISO_A_CADA_MS) return;

    ultimoAviso.set(mensagem.author.id, agora);

    try {
        await mensagem.reply({
            content: textoAviso(motivo),
            allowedMentions: { parse: [], repliedUser: false }
        });
    } catch {
        // sem permissão para responder: ignora
    }
}

// =====================================================
// 🚀 INICIAR (barra tudo no mesmo lugar)
// =====================================================
// O bot tem vários "interactionCreate"/"messageCreate" espalhados.
// Em vez de mexer em cada um, esta função intercepta os eventos
// antes deles: se a pessoa está banida, o evento nem chega lá.

function iniciar(client) {
    carregar().catch(e => console.error("❌ Erro ao carregar os banidos do bot:", e));

    const emitirOriginal = client.emit.bind(client);

    client.emit = function (evento, ...args) {
        try {
            if (evento === "interactionCreate") {
                const interacao = args[0];
                const id = interacao?.user?.id;

                if (id && id !== DONO_ID && banidos.has(id)) {
                    avisarInteracao(interacao, banidos.get(id));
                    return false;
                }
            } else if (evento === "messageCreate") {
                const mensagem = args[0];
                const id = mensagem?.author?.id;

                if (
                    id &&
                    id !== DONO_ID &&
                    !mensagem.author.bot &&
                    banidos.has(id) &&
                    String(mensagem.content || "").trimStart().startsWith(PREFIXO)
                ) {
                    avisarMensagem(mensagem, banidos.get(id));
                    return false;
                }
            }
        } catch (e) {
            console.error("❌ Erro no ban do bot:", e);
        }

        return emitirOriginal(evento, ...args);
    };
}

// =====================================================
// 🔨 AÇÕES (usadas pelo comando /ban-bot)
// =====================================================

async function podeAdministrar(userId) {
    return userId === DONO_ID || (await isAdm(userId));
}

async function banir({ usuario, alvo, motivo }) {
    if (!(await podeAdministrar(usuario.id))) {
        return { erro: "❌ Só o dono e os ADMs do bot podem usar isso." };
    }

    if (!alvo) return { erro: "❌ Marque quem será banido." };

    if (alvo.id === usuario.id) return { erro: "❌ Você não pode banir você mesmo." };

    if (alvo.bot) return { erro: "❌ Bots não usam os comandos." };

    if (alvo.id === DONO_ID) return { erro: "❌ O dono do bot não pode ser banido." };

    if (await isAdm(alvo.id)) {
        return { erro: "❌ Essa pessoa é ADM do bot. Tire o ADM com `/dar-adm` antes." };
    }

    await prepararTabela();

    const razao = String(motivo || "").trim().slice(0, MAX_MOTIVO) || "Sem motivo informado.";

    await mysqlPool.query(
        `INSERT INTO banidos_bot (user_id, motivo, por, criado_em) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE motivo = VALUES(motivo), por = VALUES(por), criado_em = VALUES(criado_em)`,
        [alvo.id, razao, usuario.id, Date.now()]
    );

    banidos.set(alvo.id, razao);

    return {
        resposta: {
            content: `🚫 <@${alvo.id}> não pode mais usar o bot.\n**Motivo:** ${razao.replace(/@/g, "@​")}`,
            allowedMentions: { parse: [] }
        }
    };
}

async function desbanir({ usuario, alvoId }) {
    if (!(await podeAdministrar(usuario.id))) {
        return { erro: "❌ Só o dono e os ADMs do bot podem usar isso." };
    }

    if (!alvoId) return { erro: "❌ Marque ou informe o ID de quem será liberado." };

    await prepararTabela();

    const [r] = await mysqlPool.query("DELETE FROM banidos_bot WHERE user_id = ?", [alvoId]);

    banidos.delete(alvoId);

    if (!r.affectedRows) return { erro: "❌ Essa pessoa não está banida do bot." };

    return {
        resposta: {
            content: `✅ <@${alvoId}> pode usar o bot de novo.`,
            allowedMentions: { parse: [] }
        }
    };
}

async function listar({ usuario }) {
    if (!(await podeAdministrar(usuario.id))) {
        return { erro: "❌ Só o dono e os ADMs do bot podem usar isso." };
    }

    await prepararTabela();

    const [linhas] = await mysqlPool.query(
        "SELECT user_id, motivo, criado_em FROM banidos_bot ORDER BY criado_em DESC LIMIT 25"
    );

    if (!linhas.length) return { resposta: "✅ Ninguém está banido do bot." };

    const texto = linhas
        .map(l => `<@${l.user_id}> (\`${l.user_id}\`) • <t:${Math.floor(Number(l.criado_em) / 1000)}:d>\n┗ ${String(l.motivo).replace(/@/g, "@​")}`)
        .join("\n\n");

    return {
        resposta: {
            content: `🚫 **Banidos do bot (${linhas.length})**\n\n${texto}`.slice(0, 1900),
            allowedMentions: { parse: [] }
        }
    };
}

module.exports = {
    iniciar,
    banir,
    desbanir,
    listar,
    _banidos: banidos
};
