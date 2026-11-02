// =====================================================
// 📊 CONTADORES (canal que mostra números do servidor)
// =====================================================
// Exemplo: um canal de voz chamado "👤 Membros: 128" que se atualiza
// sozinho. Tipos: membros (sem bots), bots, total (membros + bots),
// canais de texto e canais de voz.
//
// Para ligar: no index.js, junto das outras linhas "iniciar", coloque:
//   require("./contadores.js").iniciar(client);
//
// A tabela "contadores" é criada sozinha.
//
// ⚠️ O Discord só deixa renomear o mesmo canal 2 vezes a cada 10 minutos.
// Por isso os números são atualizados a cada 10 minutos.

const { ChannelType, PermissionFlagsBits } = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const emojis = require("./emojis.js");

const EMOJIS = {
    erro: emojis.erro,
    sucesso: emojis.sucesso
};

const INTERVALO_MS = 10 * 60 * 1000;
const PRIMEIRA_CHECAGEM_MS = 60 * 1000;
const MAX_POR_SERVIDOR = 10;
const MAX_NOME = 100;

const TIPOS = {
    membros: "Membros (sem bots)",
    bots: "Bots",
    total: "Total (membros + bots)",
    texto: "Canais de texto",
    voz: "Canais de voz"
};

const TIPOS_DE_CANAL_ACEITOS = [
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.GuildCategory
];

function erro(texto) {
    return { erro: `${EMOJIS.erro} ${texto}` };
}

// =====================================================
// 🗃️ BANCO
// =====================================================

let tabelaPronta = false;

async function prepararTabela() {
    if (tabelaPronta) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS contadores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guild_id VARCHAR(30) NOT NULL,
            canal_id VARCHAR(30) NOT NULL UNIQUE,
            tipo VARCHAR(20) NOT NULL,
            texto VARCHAR(80) NOT NULL,
            INDEX idx_contadores_guild (guild_id)
        )
    `);

    tabelaPronta = true;
}

// =====================================================
// 🔢 CONTAGEM E NOME
// =====================================================

async function garantirMembros(guild) {
    // Se todos os membros já estão na memória, não precisa buscar de novo.
    if (guild.members.cache.size >= guild.memberCount) return;

    try {
        await guild.members.fetch();
    } catch (e) {
        console.error(`❌ Contadores: não consegui buscar os membros de ${guild.name}:`, e?.message || e);
    }
}

async function contar(guild, tipo) {
    if (tipo === "texto") {
        return guild.channels.cache.filter(c =>
            c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement
        ).size;
    }

    if (tipo === "voz") {
        return guild.channels.cache.filter(c =>
            c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice
        ).size;
    }

    await garantirMembros(guild);

    const bots = guild.members.cache.filter(m => m.user.bot).size;

    if (tipo === "bots") return bots;
    if (tipo === "total") return guild.memberCount;

    return Math.max(0, guild.memberCount - bots); // membros
}

// "👤 Membros:" + 128  ->  "👤 Membros: 128"
// Se o texto tiver {numero}, o número entra naquele lugar.
function montarNome(texto, numero) {
    const base = String(texto).trim();

    const nome = /\{numero\}/i.test(base)
        ? base.replace(/\{numero\}/gi, String(numero))
        : `${base} ${numero}`;

    return nome.slice(0, MAX_NOME);
}

// =====================================================
// ➕ AÇÕES
// =====================================================

function exigirPermissao(executor) {
    if (!executor?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
        return erro("Você precisa da permissão **Gerenciar Servidor** para isso.");
    }

    return null;
}

async function renomear(canal, nome) {
    if (canal.name === nome) return;

    await canal.setName(nome, "Contador do servidor");
}

async function adicionar({ guild, executor, canal, tipo, texto }) {
    const faltou = exigirPermissao(executor);
    if (faltou) return faltou;

    if (!canal || !TIPOS_DE_CANAL_ACEITOS.includes(canal.type) || canal.guildId !== guild.id) {
        return erro("Escolha um **canal de voz**, de palco ou uma **categoria** deste servidor. (Canais de texto não aceitam espaços e símbolos no nome.)");
    }

    if (!TIPOS[tipo]) {
        return erro("Tipo inválido. Use `membros`, `bots`, `total`, `texto` ou `voz`.");
    }

    const prefixo = String(texto || "").trim();

    if (!prefixo) return erro("Escreva o texto do começo. Ex.: `👤 Membros:`");

    if (prefixo.length > 80) return erro("O texto pode ter no máximo 80 caracteres.");

    if (!canal.manageable) {
        return erro("Não consigo mexer nesse canal. Me dê a permissão **Gerenciar Canais** nele.");
    }

    await prepararTabela();

    const [[contagem]] = await mysqlPool.query(
        "SELECT COUNT(*) AS total FROM contadores WHERE guild_id = ?",
        [guild.id]
    );

    const [[existe]] = await mysqlPool.query(
        "SELECT COUNT(*) AS total FROM contadores WHERE canal_id = ?",
        [canal.id]
    );

    if (!Number(existe.total) && Number(contagem.total) >= MAX_POR_SERVIDOR) {
        return erro(`O limite é de **${MAX_POR_SERVIDOR}** contadores por servidor.`);
    }

    await mysqlPool.query(
        `INSERT INTO contadores (guild_id, canal_id, tipo, texto) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE tipo = VALUES(tipo), texto = VALUES(texto)`,
        [guild.id, canal.id, tipo, prefixo]
    );

    const numero = await contar(guild, tipo);
    const nome = montarNome(prefixo, numero);

    try {
        await renomear(canal, nome);
    } catch (e) {
        return erro("Salvei o contador, mas não consegui renomear o canal agora (o Discord limita renomear 2 vezes a cada 10 minutos). Ele atualiza sozinho em breve.");
    }

    return {
        resposta:
            `${EMOJIS.sucesso} Contador criado em ${canal}: **${nome}**\n` +
            `Tipo: **${TIPOS[tipo]}** • atualiza a cada 10 minutos.`
    };
}

async function remover({ guild, executor, canal }) {
    const faltou = exigirPermissao(executor);
    if (faltou) return faltou;

    if (!canal) return erro("Escolha o canal do contador.");

    await prepararTabela();

    const [r] = await mysqlPool.query(
        "DELETE FROM contadores WHERE canal_id = ? AND guild_id = ?",
        [canal.id, guild.id]
    );

    if (!r.affectedRows) return erro("Esse canal não é um contador.");

    return {
        resposta: `${EMOJIS.sucesso} ${canal} não é mais um contador. O nome dele fica como está; renomeie à vontade.`
    };
}

async function listar({ guild, executor }) {
    const faltou = exigirPermissao(executor);
    if (faltou) return faltou;

    await prepararTabela();

    const [linhas] = await mysqlPool.query(
        "SELECT canal_id, tipo, texto FROM contadores WHERE guild_id = ? ORDER BY id ASC",
        [guild.id]
    );

    if (!linhas.length) {
        return { resposta: "📊 Este servidor não tem contadores. Crie com `/contador adicionar`." };
    }

    const texto = linhas
        .map(l => `<#${l.canal_id}> • **${TIPOS[l.tipo] || l.tipo}**\n┗ Texto: \`${l.texto}\``)
        .join("\n\n");

    return { resposta: `📊 **Contadores do servidor**\n\n${texto}`.slice(0, 1900) };
}

// Atualiza os contadores do servidor agora (com um intervalo mínimo,
// por causa do limite do Discord para renomear canais).
const ultimaManual = new Map();
const ESPERA_MANUAL_MS = 5 * 60 * 1000;

async function atualizarAgora({ guild, executor }) {
    const faltou = exigirPermissao(executor);
    if (faltou) return faltou;

    const passou = Date.now() - (ultimaManual.get(guild.id) || 0);

    if (passou < ESPERA_MANUAL_MS) {
        const falta = Math.ceil((ESPERA_MANUAL_MS - passou) / 60000);

        return erro(`Espere uns **${falta} min** para atualizar de novo (limite do Discord para renomear canais).`);
    }

    await prepararTabela();

    ultimaManual.set(guild.id, Date.now());

    const [linhas] = await mysqlPool.query(
        "SELECT guild_id, canal_id, tipo, texto FROM contadores WHERE guild_id = ?",
        [guild.id]
    );

    if (!linhas.length) return erro("Este servidor não tem contadores.");

    for (const linha of linhas) {
        await atualizarContador(guild.client, linha);
    }

    return { resposta: `${EMOJIS.sucesso} Atualizei **${linhas.length}** contador(es).` };
}

// =====================================================
// 🔄 ATUALIZAÇÃO AUTOMÁTICA
// =====================================================

async function atualizarContador(client, linha) {
    const guild = client.guilds.cache.get(linha.guild_id);

    if (!guild) return;

    let canal = guild.channels.cache.get(linha.canal_id);

    if (!canal) {
        try {
            canal = await guild.channels.fetch(linha.canal_id);
        } catch {
            canal = null;
        }
    }

    // Canal apagado: esquece o contador
    if (!canal) {
        await mysqlPool.query("DELETE FROM contadores WHERE canal_id = ?", [linha.canal_id]);
        return;
    }

    const nome = montarNome(linha.texto, await contar(guild, linha.tipo));

    try {
        await renomear(canal, nome);
    } catch (e) {
        console.warn(`⚠️ Contadores: não consegui renomear ${linha.canal_id}:`, e?.message || e);
    }
}

let atualizando = false;

async function atualizarTodos(client) {
    if (atualizando || !client.isReady()) return;

    atualizando = true;

    try {
        await prepararTabela();

        const [linhas] = await mysqlPool.query(
            "SELECT guild_id, canal_id, tipo, texto FROM contadores"
        );

        for (const linha of linhas) {
            try {
                await atualizarContador(client, linha);
            } catch (e) {
                console.error("❌ Erro ao atualizar um contador:", e);
            }
        }
    } catch (e) {
        console.error("❌ Erro nos contadores:", e);
    } finally {
        atualizando = false;
    }
}

function iniciar(client) {
    setTimeout(() => atualizarTodos(client), PRIMEIRA_CHECAGEM_MS);
    setInterval(() => atualizarTodos(client), INTERVALO_MS);
}

module.exports = {
    TIPOS,
    iniciar,
    adicionar,
    remover,
    listar,
    atualizarAgora,
    atualizarTodos,
    montarNome,
    contar
};
