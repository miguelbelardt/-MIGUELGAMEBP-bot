// =====================================================
// 📊 CONTADORES NO PAINEL
// =====================================================
// Usa a mesma tabela (contadores) e a mesma atualização automática do antigo /contador.

const { ChannelType } = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const ct = require("./contadores.js");

const ESPERA_MANUAL_MS = 5 * 60 * 1000;
const ultimaManual = new Map();

const NOME_TIPO_CANAL = {
    [ChannelType.GuildVoice]: "Voz",
    [ChannelType.GuildStageVoice]: "Palco",
    [ChannelType.GuildCategory]: "Categoria"
};

function aceito(canal) {
    return !!canal && ct.TIPOS_DE_CANAL_ACEITOS.includes(canal.type);
}

async function ler(guild) {
    await ct.prepararTabela();

    const [linhas] = await mysqlPool.query(
        "SELECT canal_id, tipo, texto FROM contadores WHERE guild_id = ? ORDER BY id ASC",
        [guild.id]
    );

    const usados = new Set(linhas.map(l => l.canal_id));

    return {
        max: ct.MAX_POR_SERVIDOR,
        tipos: Object.entries(ct.TIPOS).map(([valor, nome]) => ({ valor, nome })),
        contadores: linhas.map(l => {
            const canal = guild.channels.cache.get(l.canal_id);

            return {
                canal_id: l.canal_id,
                canal_nome: canal ? canal.name : null,
                canal_tipo: canal ? NOME_TIPO_CANAL[canal.type] || "" : "",
                existe: !!canal,
                tipo: l.tipo,
                texto: l.texto
            };
        }),
        canais: [...guild.channels.cache.values()]
            .filter(c => aceito(c) && !usados.has(c.id))
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name, tipo: NOME_TIPO_CANAL[c.type] || "" }))
    };
}

function validar(corpo, permitidas) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    for (const k of Object.keys(corpo)) {
        if (!permitidas.includes(k)) return { erro: `Opção desconhecida: ${String(k).slice(0, 40)}` };
    }

    if (typeof corpo.tipo !== "string" || !ct.TIPOS[corpo.tipo]) return { erro: "Escolha o que contar." };

    const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";

    if (!texto) return { erro: "Escreva o texto do começo. Ex.: 👤 Membros:" };
    if (texto.length > 80) return { erro: "O texto pode ter no máximo 80 caracteres." };

    return { tipo: corpo.tipo, texto };
}

// Cria ou atualiza o contador de um canal e já renomeia o canal.
async function gravar(guild, canalId, tipo, texto, { novo }) {
    const canal = guild.channels.cache.get(canalId);

    if (!aceito(canal) || canal.guildId !== guild.id) return { erro: "Escolha um canal de voz, de palco ou uma categoria deste servidor." };
    if (!canal.manageable) return { erro: "Não consigo mexer nesse canal. Dê ao bot a permissão Gerenciar Canais nele." };

    await ct.prepararTabela();

    const [[existe]] = await mysqlPool.query("SELECT COUNT(*) AS total FROM contadores WHERE canal_id = ? AND guild_id = ?", [canalId, guild.id]);
    const [[outro]] = await mysqlPool.query("SELECT COUNT(*) AS total FROM contadores WHERE canal_id = ? AND guild_id <> ?", [canalId, guild.id]);

    if (Number(outro.total)) return { erro: "Esse canal já é contador de outro servidor." };
    if (novo && Number(existe.total)) return { erro: "Esse canal já é um contador. Edite-o na lista." };
    if (!novo && !Number(existe.total)) return { erro: "Contador não encontrado." };

    if (novo) {
        const [[c]] = await mysqlPool.query("SELECT COUNT(*) AS total FROM contadores WHERE guild_id = ?", [guild.id]);

        if (Number(c.total) >= ct.MAX_POR_SERVIDOR) return { erro: `O limite é de ${ct.MAX_POR_SERVIDOR} contadores por servidor.` };
    }

    await mysqlPool.query(
        `INSERT INTO contadores (guild_id, canal_id, tipo, texto) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE tipo = VALUES(tipo), texto = VALUES(texto)`,
        [guild.id, canalId, tipo, texto]
    );

    const nome = ct.montarNome(texto, await ct.contar(guild, tipo));

    try {
        await ct.renomear(canal, nome);
    } catch {
        return { ok: true, nome, aviso: "Salvei, mas não consegui renomear o canal agora (o Discord limita renomear 2 vezes a cada 10 minutos). Ele atualiza sozinho em breve." };
    }

    return { ok: true, nome };
}

async function adicionar(guild, corpo) {
    const v = validar(corpo, ["canal_id", "tipo", "texto"]);

    if (v.erro) return v;
    if (typeof corpo.canal_id !== "string" || !/^\d{15,25}$/.test(corpo.canal_id)) return { erro: "Escolha o canal do contador." };

    return gravar(guild, corpo.canal_id, v.tipo, v.texto, { novo: true });
}

async function editar(guild, canalId, corpo) {
    const v = validar(corpo, ["tipo", "texto"]);

    if (v.erro) return v;

    return gravar(guild, canalId, v.tipo, v.texto, { novo: false });
}

async function remover(guild, canalId) {
    await ct.prepararTabela();

    const [r] = await mysqlPool.query("DELETE FROM contadores WHERE canal_id = ? AND guild_id = ?", [canalId, guild.id]);

    if (!r.affectedRows) return { erro: "Contador não encontrado." };

    return { ok: true };
}

async function atualizarAgora(guild) {
    const passou = Date.now() - (ultimaManual.get(guild.id) || 0);

    if (passou < ESPERA_MANUAL_MS) {
        return { erro: `Espere uns ${Math.ceil((ESPERA_MANUAL_MS - passou) / 60000)} min para atualizar de novo (limite do Discord para renomear canais).` };
    }

    await ct.prepararTabela();

    const [linhas] = await mysqlPool.query("SELECT guild_id, canal_id, tipo, texto FROM contadores WHERE guild_id = ?", [guild.id]);

    if (!linhas.length) return { erro: "Este servidor não tem contadores." };

    ultimaManual.set(guild.id, Date.now());

    for (const linha of linhas) await ct.atualizarContador(guild.client, linha);

    return { ok: true, total: linhas.length };
}

module.exports = { ler, adicionar, editar, remover, atualizarAgora };
