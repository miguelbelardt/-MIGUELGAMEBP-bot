// =====================================================
// 📜 LOGS NO PAINEL
// =====================================================
// Lê e salva a mesma tabela do /logs (logs_config: um canal para cada tipo de log).
// Se criar um tipo novo de log no /logs, acrescente aqui também.

const { ChannelType } = require("discord.js");

const { mysqlPool } = require("./database/database.js");

const GRUPOS = [
    {
        chave: "mensagens", nome: "💬 Mensagens", itens: [
            ["mensagens_editadas", "✏️ Mensagens editadas", "Quando uma mensagem é editada."],
            ["mensagens_apagadas", "🗑️ Mensagens apagadas", "Quando uma mensagem é apagada."]
        ]
    },
    {
        chave: "membros", nome: "👤 Membros", itens: [
            ["membros_nickname", "🏷️ Nickname alterado", "Quando o nickname de um membro muda."],
            ["membros_avatar", "🖼️ Avatar alterado", "Quando o avatar de um membro muda."],
            ["membros_banner", "🎨 Banner alterado", "Quando o banner de um membro muda."],
            ["membros_cargos", "🛡️ Cargos alterados", "Quando cargos são adicionados ou removidos."]
        ]
    },
    {
        chave: "moderacao", nome: "🔨 Moderação", itens: [
            ["moderacao_ban", "🔨 Banimentos", "Quando um membro é banido."],
            ["moderacao_unban", "🔓 Desbanimentos", "Quando um membro é desbanido."],
            ["moderacao_kick", "👢 Expulsões", "Quando um membro é expulso."],
            ["moderacao_timeout", "🔇 Timeout aplicado", "Quando um membro recebe timeout."],
            ["moderacao_timeout_removido", "🔊 Timeout removido", "Quando o timeout é removido."],
            ["moderacao_clear", "🧹 Mensagens limpas", "Quando mensagens são apagadas com o clear."]
        ]
    },
    {
        chave: "voz", nome: "🎙️ Voz", itens: [
            ["voz_entrada", "🟢 Entrada na call", "Quando alguém entra num canal de voz."],
            ["voz_saida", "🔴 Saída da call", "Quando alguém sai de um canal de voz."],
            ["voz_mudanca", "🔄 Mudança de canal", "Quando alguém troca de canal de voz."]
        ]
    },
    {
        chave: "tickets", nome: "🎫 Tickets", itens: [
            ["tickets_aberto", "📩 Ticket aberto", "Quando alguém abre um ticket."],
            ["tickets_fechado", "🔒 Ticket fechado", "Quando um ticket é fechado."]
        ]
    },
    {
        chave: "registro", nome: "📝 Registro", itens: [
            ["registro_concluido", "✅ Registro concluído", "Quando alguém conclui o registro."],
            ["registro_excluido", "🗑️ Registro excluído", "Quando o sistema de registro é excluído."]
        ]
    }
];

const TIPOS = new Set(GRUPOS.flatMap(g => g.itens.map(i => i[0])));

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

async function ler(guild) {
    const [linhas] = await mysqlPool.query("SELECT tipo, canal_id FROM logs_config WHERE guild_id = ?", [String(guild.id)]);
    const salvo = new Map(linhas.map(l => [l.tipo, String(l.canal_id)]));

    return {
        grupos: GRUPOS.map(g => ({
            chave: g.chave,
            nome: g.nome,
            itens: g.itens.map(([tipo, nome, descricao]) => ({ tipo, nome, descricao, canal_id: salvo.get(tipo) || null }))
        })),
        canais: [...guild.channels.cache.values()]
            .filter(ehTexto)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name }))
    };
}

// corpo: { tipos: { tipo: "idDoCanal" | null } }
async function salvar(guild, corpo) {
    const tipos = corpo?.tipos;

    if (!tipos || typeof tipos !== "object" || Array.isArray(tipos)) return { erro: "Dados inválidos." };

    const entradas = Object.entries(tipos);

    if (!entradas.length) return { erro: "Nada para salvar." };

    for (const [tipo, canalId] of entradas) {
        if (!TIPOS.has(tipo)) return { erro: `Tipo de log desconhecido: ${String(tipo).slice(0, 40)}` };

        if (canalId !== null && !(typeof canalId === "string" && ehTexto(guild.channels.cache.get(canalId)))) {
            return { erro: "Canal inválido." };
        }
    }

    for (const [tipo, canalId] of entradas) {
        if (canalId === null) {
            await mysqlPool.query("DELETE FROM logs_config WHERE guild_id = ? AND tipo = ?", [String(guild.id), tipo]);
        } else {
            await mysqlPool.query(
                `INSERT INTO logs_config (guild_id, tipo, canal_id) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE canal_id = VALUES(canal_id)`,
                [String(guild.id), tipo, canalId]
            );
        }
    }

    return { ok: true };
}

module.exports = { ler, salvar, _teste: { TIPOS, GRUPOS } };
