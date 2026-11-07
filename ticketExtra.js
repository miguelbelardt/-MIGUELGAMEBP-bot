// =====================================================
// 🎫 TICKET EXTRA: assumir, transferir, membros, renomear,
// transcrição, avaliação e configurações extras
// =====================================================
// Este arquivo fica na RAIZ do projeto (junto do index.js) e é usado
// pelo comandos/ticket.js. Não precisa colocar nada no index.js.
//
// Tabelas/colunas novas são criadas sozinhas:
//   - ticket_estado (quem abriu, responsável, motivo...)
//   - ticket_config: limite_tickets, dm_transcricao, avaliacao,
//     pedir_motivo_fechar, canal_transcricao_id

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    UserSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
    AttachmentBuilder
} = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const emojis = require("./emojis.js");
const configUsuario = require("./configUsuario.js");

// =====================================================
// ⚙️ CONFIGURAÇÕES (pode mexer)
// =====================================================

const EMOJI_TICKET = "<:Ticket:1528578970218533054>";
const EMOJI_TRANCAR = emojis.trancar;
const EMOJI_PESSOA = emojis.pessoa;
const EMOJI_RELOGIO = emojis.relogio;
const EMOJI_SUCESSO = emojis.sucesso;
const EMOJI_ERRO = emojis.erro || "❌";

const MAX_MENSAGENS_TRANSCRICAO = 1500;
const TEMPO_MAX_TRANSCRICAO_MS = 25 * 1000;
const TEMPO_MAX_RENOMEAR_MS = 8 * 1000;
const TEMPO_AVALIACAO_MS = 30 * 60 * 1000;
const MAX_LIMITE_TICKETS = 5;

const EFEMERO = MessageFlags.Ephemeral;

// =====================================================
// 🗃️ BANCO
// =====================================================

let pronto = false;

async function preparar() {
    if (pronto) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS ticket_estado (
            canal_id VARCHAR(30) PRIMARY KEY,
            guild_id VARCHAR(30) NOT NULL,
            dono_id VARCHAR(30) NOT NULL,
            responsavel_id VARCHAR(30),
            assumido_em BIGINT,
            motivo TEXT,
            modelo_nome VARCHAR(100),
            numero VARCHAR(10),
            mensagem_id VARCHAR(30),
            aberto_em BIGINT NOT NULL,
            INDEX idx_ticket_estado_guild (guild_id)
        )
    `);

    const [colunas] = await mysqlPool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ticket_config'
    `);

    const existentes = colunas.map(c => c.COLUMN_NAME);

    const novas = {
        limite_tickets: "INT NOT NULL DEFAULT 1",
        dm_transcricao: "BOOLEAN NOT NULL DEFAULT FALSE",
        avaliacao: "BOOLEAN NOT NULL DEFAULT FALSE",
        pedir_motivo_fechar: "BOOLEAN NOT NULL DEFAULT TRUE",
        canal_transcricao_id: "VARCHAR(30)"
    };

    for (const [coluna, definicao] of Object.entries(novas)) {
        if (!existentes.includes(coluna)) {
            await mysqlPool.query(
                `ALTER TABLE ticket_config ADD COLUMN ${coluna} ${definicao}`
            );
        }
    }

    pronto = true;
}

async function lerConfig(guildId) {
    const [linhas] = await mysqlPool.query(
        "SELECT * FROM ticket_config WHERE guild_id = ?",
        [guildId]
    );

    const r = linhas[0] || {};

    return {
        ...r,
        limite_tickets: Math.min(MAX_LIMITE_TICKETS, Math.max(1, Number(r.limite_tickets) || 1)),
        dm_transcricao: !!Number(r.dm_transcricao),
        avaliacao: !!Number(r.avaliacao),
        pedir_motivo_fechar:
            r.pedir_motivo_fechar === undefined || r.pedir_motivo_fechar === null
                ? true
                : !!Number(r.pedir_motivo_fechar),
        canal_transcricao_id: r.canal_transcricao_id || null,
        cargo_mencao_id: r.cargo_mencao_id || null
    };
}

const COLUNAS_EDITAVEIS = new Set([
    "limite_tickets",
    "dm_transcricao",
    "avaliacao",
    "pedir_motivo_fechar",
    "canal_transcricao_id"
]);

async function salvarConfig(guildId, coluna, valor) {
    if (!COLUNAS_EDITAVEIS.has(coluna)) throw new Error("Coluna inválida");

    await mysqlPool.query(
        `INSERT INTO ticket_config (guild_id, ${coluna}) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE ${coluna} = VALUES(${coluna})`,
        [guildId, valor]
    );
}

// Busca o "estado" do ticket. Tickets criados antes desta atualização
// não têm linha: ela é montada a partir do tópico do canal.
async function obterEstado(canal) {
    if (!canal || !canal.id) return null;

    const [linhas] = await mysqlPool.query(
        "SELECT * FROM ticket_estado WHERE canal_id = ?",
        [canal.id]
    );

    if (linhas[0]) return linhas[0];

    const m = /^ticket:(\d{15,25}):(\d{10,})/.exec(canal.topic || "");

    if (!m) return null;

    await mysqlPool.query(
        "INSERT IGNORE INTO ticket_estado (canal_id, guild_id, dono_id, aberto_em) VALUES (?, ?, ?, ?)",
        [canal.id, canal.guildId, m[1], Number(m[2])]
    );

    const [novas] = await mysqlPool.query(
        "SELECT * FROM ticket_estado WHERE canal_id = ?",
        [canal.id]
    );

    return novas[0] || null;
}

// =====================================================
// 🧰 UTILIDADES
// =====================================================

function ehAdmin(membro) {
    return !!membro?.permissions?.has?.(PermissionFlagsBits.Administrator);
}

function ehStaff(membro, config) {
    if (!membro) return false;

    if (ehAdmin(membro)) return true;

    return !!(config?.cargo_mencao_id && membro.roles?.cache?.has?.(config.cargo_mencao_id));
}

function textoDuracao(ms) {
    const total = Math.max(0, Math.floor(ms / 60000));
    const dias = Math.floor(total / 1440);
    const horas = Math.floor((total % 1440) / 60);
    const minutos = total % 60;

    const partes = [];

    if (dias) partes.push(`${dias}d`);
    if (horas) partes.push(`${horas}h`);
    if (minutos || !partes.length) partes.push(`${minutos}min`);

    return partes.join(" ");
}

function sem(texto, max = 1000) {
    return String(texto ?? "").replace(/@/g, "@​").slice(0, max);
}

async function negar(interaction, texto) {
    const dados = {
        content: `${EMOJI_ERRO} ${texto}`,
        flags: EFEMERO,
        allowedMentions: { parse: [] }
    };

    if (interaction.deferred || interaction.replied) {
        await interaction.followUp(dados);
    } else {
        await interaction.reply(dados);
    }

    return true;
}

// =====================================================
// 🔘 BOTÕES DENTRO DO TICKET
// =====================================================

function linhaTicket(responsavelId) {
    const fechar = new ButtonBuilder()
        .setCustomId("ticket_fechar")
        .setLabel("Fechar")
        .setEmoji(EMOJI_TRANCAR)
        .setStyle(ButtonStyle.Danger);

    const assumir = responsavelId
        ? new ButtonBuilder()
            .setCustomId("ticket_assumir")
            .setLabel("Transferir")
            .setEmoji("🔁")
            .setStyle(ButtonStyle.Secondary)
        : new ButtonBuilder()
            .setCustomId("ticket_assumir")
            .setLabel("Assumir")
            .setEmoji("✋")
            .setStyle(ButtonStyle.Success);

    const membros = new ButtonBuilder()
        .setCustomId("ticket_membros")
        .setLabel("Membros")
        .setEmoji("👥")
        .setStyle(ButtonStyle.Secondary);

    const renomear = new ButtonBuilder()
        .setCustomId("ticket_renomear")
        .setLabel("Renomear")
        .setEmoji("✏️")
        .setStyle(ButtonStyle.Secondary);

    const transcricao = new ButtonBuilder()
        .setCustomId("ticket_transcricao")
        .setLabel("Transcrição")
        .setEmoji("📄")
        .setStyle(ButtonStyle.Secondary);

    return [
        new ActionRowBuilder().addComponents(fechar, assumir, membros, renomear, transcricao)
    ];
}

// Atualiza a mensagem principal do ticket (campo "Responsável" e botões)
async function atualizarMensagemTicket(canal, estado) {
    try {
        let mensagem = null;

        if (estado.mensagem_id) {
            mensagem = await canal.messages.fetch(estado.mensagem_id).catch(() => null);
        }

        if (!mensagem) {
            const primeira = await canal.messages.fetch({ after: "0", limit: 1 }).catch(() => null);
            mensagem = primeira?.first?.() || null;
        }

        if (!mensagem || !mensagem.embeds?.length) return;

        const embed = EmbedBuilder.from(mensagem.embeds[0]);

        const campos = (embed.data.fields || []).filter(
            f => !String(f.name).includes("Responsável")
        );

        if (estado.responsavel_id) {
            campos.push({
                name: "🛡️ Responsável",
                value: `<@${estado.responsavel_id}>`,
                inline: true
            });
        }

        embed.setFields(campos);

        await mensagem.edit({
            embeds: [embed],
            components: linhaTicket(estado.responsavel_id)
        });

    } catch (e) {
        console.error("❌ Ticket: não consegui atualizar a mensagem do ticket:", e?.message || e);
    }
}

// =====================================================
// ✋ ASSUMIR / TRANSFERIR / LIBERAR
// =====================================================

async function assumir(interaction) {
    const canal = interaction.channel;
    const estado = await obterEstado(canal);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    const config = await lerConfig(interaction.guildId);

    if (!ehStaff(interaction.member, config)) {
        return negar(interaction, "Só a equipe pode assumir tickets.");
    }

    const usuario = interaction.user;

    if (usuario.id === estado.dono_id) {
        return negar(interaction, "Você não pode assumir o seu próprio ticket.");
    }

    // Ninguém atende ainda: assume
    if (!estado.responsavel_id) {
        const [r] = await mysqlPool.query(
            "UPDATE ticket_estado SET responsavel_id = ?, assumido_em = ? WHERE canal_id = ? AND responsavel_id IS NULL",
            [usuario.id, Date.now(), canal.id]
        );

        if (!r.affectedRows) {
            return negar(interaction, "Outra pessoa da equipe acabou de assumir este ticket.");
        }

        await interaction.deferUpdate();

        await atualizarMensagemTicket(canal, { ...estado, responsavel_id: usuario.id });

        await canal.send({
            content: `✋ ${usuario} assumiu este ticket e vai atender <@${estado.dono_id}>.`,
            allowedMentions: { users: [usuario.id, estado.dono_id] }
        });

        return true;
    }

    // Já tem responsável: só ele (ou um administrador) transfere/libera
    if (estado.responsavel_id === usuario.id || ehAdmin(interaction.member)) {
        const menu = new UserSelectMenuBuilder()
            .setCustomId("ticket_sel_transferir")
            .setPlaceholder("Transferir para outra pessoa da equipe")
            .setMinValues(1)
            .setMaxValues(1);

        const liberar = new ButtonBuilder()
            .setCustomId("ticket_liberar")
            .setLabel("Liberar ticket (ninguém atende)")
            .setEmoji("🔓")
            .setStyle(ButtonStyle.Secondary);

        await interaction.reply({
            content: `🛡️ Responsável atual: <@${estado.responsavel_id}>\nEscolha para quem transferir, ou libere o ticket.`,
            components: [
                new ActionRowBuilder().addComponents(menu),
                new ActionRowBuilder().addComponents(liberar)
            ],
            flags: EFEMERO,
            allowedMentions: { parse: [] }
        });

        return true;
    }

    return negar(interaction, `Este ticket já está sendo atendido por <@${estado.responsavel_id}>.`);
}

async function podeGerenciarResponsavel(interaction, estado) {
    return estado.responsavel_id === interaction.user.id || ehAdmin(interaction.member);
}

async function transferir(interaction) {
    const canal = interaction.channel;
    const estado = await obterEstado(canal);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    if (!(await podeGerenciarResponsavel(interaction, estado))) {
        return negar(interaction, "Só o responsável atual pode transferir este ticket.");
    }

    const config = await lerConfig(interaction.guildId);
    const alvoId = interaction.values[0];

    const alvo = await interaction.guild.members.fetch(alvoId).catch(() => null);

    if (!alvo || alvo.user.bot) return negar(interaction, "Escolha uma pessoa da equipe (não vale bot).");

    if (alvo.id === estado.dono_id) return negar(interaction, "O dono do ticket não pode ser o responsável.");

    if (!ehStaff(alvo, config)) {
        return negar(interaction, "Essa pessoa não é da equipe do ticket (ela precisa ter o cargo de staff configurado).");
    }

    await mysqlPool.query(
        "UPDATE ticket_estado SET responsavel_id = ?, assumido_em = ? WHERE canal_id = ?",
        [alvo.id, Date.now(), canal.id]
    );

    await interaction.update({
        content: `${EMOJI_SUCESSO} Ticket transferido para ${alvo}.`,
        components: [],
        allowedMentions: { parse: [] }
    });

    await atualizarMensagemTicket(canal, { ...estado, responsavel_id: alvo.id });

    await canal.send({
        content: `🔁 ${interaction.user} transferiu este ticket para ${alvo}.`,
        allowedMentions: { users: [alvo.id] }
    });

    return true;
}

async function liberar(interaction) {
    const canal = interaction.channel;
    const estado = await obterEstado(canal);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    if (!(await podeGerenciarResponsavel(interaction, estado))) {
        return negar(interaction, "Só o responsável atual pode liberar este ticket.");
    }

    await mysqlPool.query(
        "UPDATE ticket_estado SET responsavel_id = NULL, assumido_em = NULL WHERE canal_id = ?",
        [canal.id]
    );

    await interaction.update({
        content: `${EMOJI_SUCESSO} Ticket liberado: ninguém está atendendo agora.`,
        components: []
    });

    await atualizarMensagemTicket(canal, { ...estado, responsavel_id: null });

    await canal.send({
        content: `🔓 ${interaction.user} liberou este ticket. Alguém da equipe pode assumir.`,
        allowedMentions: { parse: [] }
    });

    return true;
}

// =====================================================
// 👥 MEMBROS (adicionar / remover)
// =====================================================

async function abrirMembros(interaction) {
    const estado = await obterEstado(interaction.channel);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    const config = await lerConfig(interaction.guildId);

    if (!ehStaff(interaction.member, config)) {
        return negar(interaction, "Só a equipe pode mexer nos membros do ticket.");
    }

    const menu = new UserSelectMenuBuilder()
        .setCustomId("ticket_sel_membro")
        .setPlaceholder("Escolha a pessoa")
        .setMinValues(1)
        .setMaxValues(1);

    await interaction.reply({
        content: "👥 Escolha uma pessoa: se ela **não** está no ticket, será **adicionada**; se **já** foi adicionada antes, será **removida**.",
        components: [new ActionRowBuilder().addComponents(menu)],
        flags: EFEMERO
    });

    return true;
}

async function selecionarMembro(interaction) {
    const canal = interaction.channel;
    const estado = await obterEstado(canal);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    const config = await lerConfig(interaction.guildId);

    if (!ehStaff(interaction.member, config)) {
        return negar(interaction, "Só a equipe pode mexer nos membros do ticket.");
    }

    const alvoId = interaction.values[0];

    if (alvoId === estado.dono_id) {
        return negar(interaction, "O dono do ticket já está no ticket e não pode ser removido.");
    }

    if (alvoId === interaction.client.user.id) {
        return negar(interaction, "Eu já estou no ticket.");
    }

    const existente = canal.permissionOverwrites.cache.get(alvoId);

    let texto;
    let aviso;

    if (existente) {
        await canal.permissionOverwrites.delete(alvoId, "Ticket: membro removido");

        texto = `${EMOJI_SUCESSO} <@${alvoId}> foi **removido** do ticket.`;
        aviso = `➖ <@${alvoId}> foi removido do ticket por ${interaction.user}.`;
    } else {
        await canal.permissionOverwrites.edit(
            alvoId,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            },
            { reason: "Ticket: membro adicionado" }
        );

        texto = `${EMOJI_SUCESSO} <@${alvoId}> foi **adicionado** ao ticket.`;
        aviso = `➕ <@${alvoId}> foi adicionado ao ticket por ${interaction.user}.`;
    }

    await interaction.update({
        content: texto,
        components: [],
        allowedMentions: { parse: [] }
    });

    await canal.send({
        content: aviso,
        allowedMentions: { users: existente ? [] : [alvoId] }
    });

    return true;
}

// =====================================================
// ✏️ RENOMEAR
// =====================================================

async function abrirRenomear(interaction) {
    const estado = await obterEstado(interaction.channel);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    const config = await lerConfig(interaction.guildId);

    if (!ehStaff(interaction.member, config)) {
        return negar(interaction, "Só a equipe pode renomear o ticket.");
    }

    const modal = new ModalBuilder()
        .setCustomId("ticket_modal_renomear")
        .setTitle("✏️ Renomear ticket");

    const campo = new TextInputBuilder()
        .setCustomId("nome")
        .setLabel("Novo nome do canal")
        .setPlaceholder("ex.: duvida-pagamento")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(90);

    modal.addComponents(new ActionRowBuilder().addComponents(campo));

    await interaction.showModal(modal);

    return true;
}

function limparNomeCanal(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 90);
}

async function enviarRenomear(interaction) {
    const canal = interaction.channel;
    const estado = await obterEstado(canal);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    const config = await lerConfig(interaction.guildId);

    if (!ehStaff(interaction.member, config)) {
        return negar(interaction, "Só a equipe pode renomear o ticket.");
    }

    const nome = limparNomeCanal(interaction.fields.getTextInputValue("nome"));

    if (!nome) return negar(interaction, "Nome inválido. Use letras, números e hífen.");

    await interaction.deferReply({ flags: EFEMERO });

    // O Discord só deixa renomear 2 vezes a cada 10 minutos. Se estourar,
    // o pedido fica na fila; avisamos em vez de travar a resposta.
    const resultado = await Promise.race([
        canal.setName(nome, `Ticket renomeado por ${interaction.user.tag}`)
            .then(() => "ok")
            .catch(() => "erro"),
        new Promise(resolve => setTimeout(() => resolve("demora"), TEMPO_MAX_RENOMEAR_MS))
    ]);

    if (resultado === "ok") {
        await interaction.editReply(`${EMOJI_SUCESSO} Ticket renomeado para **#${nome}**.`);
    } else if (resultado === "demora") {
        await interaction.editReply("⏳ O Discord limita renomear canais (2 vezes a cada 10 minutos). O novo nome será aplicado assim que o limite liberar.");
    } else {
        await interaction.editReply(`${EMOJI_ERRO} Não consegui renomear o canal. Confira se eu tenho a permissão **Gerenciar Canais**.`);
    }

    return true;
}

// =====================================================
// 📄 TRANSCRIÇÃO (HTML)
// =====================================================

function esc(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatarTexto(texto, mensagem) {
    let t = esc(texto);

    t = t.replace(/&lt;@!?(\d{15,25})&gt;/g, (m, id) => {
        const u = mensagem.mentions?.users?.get?.(id);
        return `<span class="men">@${esc(u?.username || "usuário")}</span>`;
    });

    t = t.replace(/&lt;@&amp;(\d{15,25})&gt;/g, (m, id) => {
        const r = mensagem.mentions?.roles?.get?.(id);
        return `<span class="men">@${esc(r?.name || "cargo")}</span>`;
    });

    t = t.replace(/&lt;#(\d{15,25})&gt;/g, (m, id) => {
        const c = mensagem.mentions?.channels?.get?.(id);
        return `<span class="men">#${esc(c?.name || "canal")}</span>`;
    });

    t = t.replace(/```(?:\w+\n)?([\s\S]+?)```/g, (m, c) => `<pre>${c}</pre>`);
    t = t.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    t = t.replace(/__([^_\n]+)__/g, "<u>$1</u>");
    t = t.replace(/\*([^*\n]+)\*/g, "<i>$1</i>");
    t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    t = t.replace(/\n/g, "<br>");

    return t;
}

function dataBR(ms) {
    return new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function htmlMensagem(m) {
    const autor = m.author || {};
    const avatar = typeof autor.displayAvatarURL === "function"
        ? autor.displayAvatarURL({ extension: "png", size: 64 })
        : "";

    let corpo = "";

    if (m.content) {
        corpo += `<div class="txt">${formatarTexto(m.content, m)}</div>`;
    }

    for (const e of m.embeds || []) {
        const d = e.data || e;
        const partes = [];

        if (d.title) partes.push(`<div class="et">${esc(d.title)}</div>`);
        if (d.description) partes.push(`<div class="ed">${formatarTexto(d.description, m)}</div>`);

        for (const f of d.fields || []) {
            partes.push(`<div class="ef"><b>${esc(f.name)}</b><br>${formatarTexto(f.value, m)}</div>`);
        }

        if (d.footer?.text) partes.push(`<div class="efo">${esc(d.footer.text)}</div>`);

        if (partes.length) corpo += `<div class="emb">${partes.join("")}</div>`;
    }

    const anexos = m.attachments?.values ? [...m.attachments.values()] : [];

    for (const a of anexos) {
        if ((a.contentType || "").startsWith("image/")) {
            corpo += `<div><a href="${esc(a.url)}"><img class="img" src="${esc(a.url)}" alt="${esc(a.name)}"></a></div>`;
        } else {
            corpo += `<div>📎 <a href="${esc(a.url)}">${esc(a.name || "arquivo")}</a></div>`;
        }
    }

    if (!corpo) corpo = `<div class="txt vazio">(mensagem sem texto)</div>`;

    const bot = autor.bot ? `<span class="bot">BOT</span>` : "";

    return `<div class="msg">
<img class="av" src="${esc(avatar)}" alt="">
<div class="cx"><div class="cab"><span class="nome">${esc(autor.username || "desconhecido")}</span>${bot}<span class="hora">${esc(dataBR(m.createdTimestamp))}</span></div>${corpo}</div>
</div>`;
}

async function buscarMensagens(canal) {
    const todas = [];
    const limite = Date.now() + TEMPO_MAX_TRANSCRICAO_MS;
    let antes = null;

    while (todas.length < MAX_MENSAGENS_TRANSCRICAO && Date.now() < limite) {
        const opcoes = { limit: 100 };

        if (antes) opcoes.before = antes;

        const lote = await canal.messages.fetch(opcoes);

        if (!lote || !lote.size) break;

        const lista = [...lote.values()];

        todas.push(...lista);

        antes = lista[lista.length - 1].id;

        if (lote.size < 100) break;
    }

    return todas.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

async function gerarTranscricao(canal, estado, extras = {}) {
    const mensagens = await buscarMensagens(canal);

    const cab = [
        `Ticket: #${esc(canal.name)}`,
        estado?.dono_id ? `Aberto por: ${esc(extras.donoNome || estado.dono_id)}` : null,
        estado?.responsavel_id ? `Responsável: ${esc(extras.responsavelNome || estado.responsavel_id)}` : null,
        estado?.aberto_em ? `Aberto em: ${esc(dataBR(Number(estado.aberto_em)))}` : null,
        `Gerado em: ${esc(dataBR(Date.now()))}`,
        `Mensagens: ${mensagens.length}`
    ].filter(Boolean).join("<br>");

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcrição #${esc(canal.name)}</title>
<style>
body{margin:0;background:#313338;color:#dbdee1;font-family:Arial,Helvetica,sans-serif;font-size:15px}
.topo{background:#2b2d31;padding:18px 20px;border-bottom:1px solid #1e1f22;line-height:1.6}
.topo h1{margin:0 0 6px;font-size:20px;color:#fff}
.lista{padding:12px 20px}
.msg{display:flex;gap:12px;padding:6px 0}
.av{width:40px;height:40px;border-radius:50%;background:#1e1f22;flex:none}
.cx{min-width:0}
.cab{margin-bottom:2px}
.nome{font-weight:bold;color:#fff;margin-right:6px}
.bot{background:#5865f2;color:#fff;font-size:10px;padding:1px 5px;border-radius:4px;margin-right:6px}
.hora{font-size:12px;color:#949ba4}
.txt{line-height:1.4;word-wrap:break-word;overflow-wrap:anywhere}
.vazio{color:#949ba4;font-style:italic}
.men{background:#3c4270;color:#c9cdfb;border-radius:3px;padding:0 2px}
code{background:#1e1f22;padding:1px 4px;border-radius:3px}
pre{background:#1e1f22;padding:8px;border-radius:4px;white-space:pre-wrap}
.emb{border-left:4px solid #5865f2;background:#2b2d31;border-radius:4px;padding:8px 12px;margin:4px 0;max-width:520px}
.et{font-weight:bold;color:#fff;margin-bottom:4px}
.ef{margin-top:6px}
.efo{margin-top:6px;font-size:12px;color:#949ba4}
.img{max-width:360px;max-height:300px;border-radius:6px;margin-top:4px}
a{color:#00a8fc}
</style></head><body>
<div class="topo"><h1>🎫 Transcrição do ticket</h1>${cab}</div>
<div class="lista">
${mensagens.map(htmlMensagem).join("\n")}
</div></body></html>`;

    return { buffer: Buffer.from(html, "utf8"), total: mensagens.length };
}

async function botaoTranscricao(interaction) {
    const canal = interaction.channel;
    const estado = await obterEstado(canal);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    const config = await lerConfig(interaction.guildId);

    if (!ehStaff(interaction.member, config) && interaction.user.id !== estado.dono_id) {
        return negar(interaction, "Só a equipe ou o dono do ticket podem gerar a transcrição.");
    }

    await interaction.deferReply({ flags: EFEMERO });

    const { buffer, total } = await gerarTranscricao(canal, estado);

    await interaction.editReply({
        content: `📄 Transcrição com **${total}** mensagem(ns). Abra o arquivo no navegador.`,
        files: [new AttachmentBuilder(buffer, { name: `transcricao-${estado.numero || canal.name}.html` })]
    });

    return true;
}

// =====================================================
// 🔢 ABRIR / FECHAR (chamados pelo ticket.js)
// =====================================================

// Quantos tickets abertos a pessoa já tem nesta categoria
function ticketsDoUsuario(guild, userId, categoriaId) {
    return guild.channels.cache.filter(
        canal =>
            canal.type === ChannelType.GuildText &&
            canal.parentId === categoriaId &&
            canal.topic &&
            canal.topic.startsWith(`ticket:${userId}:`)
    );
}

async function canalDeLog(guild, config) {
    if (!config.canal_transcricao_id) return null;

    const canal = await guild.channels.fetch(config.canal_transcricao_id).catch(() => null);

    if (!canal || !canal.isTextBased?.() || typeof canal.send !== "function") return null;

    return canal;
}

async function registrarAbertura({ guild, canal, mensagem, dono, modelo, motivo, numero }) {
    try {
        await preparar();

        await mysqlPool.query(
            `INSERT INTO ticket_estado
                (canal_id, guild_id, dono_id, motivo, modelo_nome, numero, mensagem_id, aberto_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                motivo = VALUES(motivo), modelo_nome = VALUES(modelo_nome),
                numero = VALUES(numero), mensagem_id = VALUES(mensagem_id)`,
            [
                canal.id,
                guild.id,
                dono.id,
                motivo || null,
                modelo?.nome ? String(modelo.nome).slice(0, 100) : null,
                numero ? String(numero) : null,
                mensagem?.id || null,
                Date.now()
            ]
        );

        const config = await lerConfig(guild.id);
        const log = await canalDeLog(guild, config);

        if (log) {
            await log.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle("🟢 Ticket aberto")
                        .setDescription(
                            `Ticket #${numero || canal.name} · ${sem(modelo?.nome || "Ticket", 100)}\n\n` +
                            `**Aberto por:** ${dono}\n` +
                            `**Canal:** ${canal}\n` +
                            `**Assunto:** ${sem(motivo || "Nenhum", 500)}\n` +
                            `**Quando:** <t:${Math.floor(Date.now() / 1000)}:f>`
                        )
                        .setTimestamp()
                ],
                allowedMentions: { parse: [] }
            });
        }

    } catch (e) {
        console.error("❌ Ticket: erro ao registrar a abertura:", e?.message || e);
    }
}

async function pedirAvaliacao({ donoUsuario, guildNome, responsavelId, numero, log }) {
    try {
        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("⭐ Como foi o atendimento?")
            .setDescription(`Seu ticket em **${sem(guildNome, 100)}** foi fechado.\nDê uma nota de 1 a 5 para o atendimento.`);

        const linha = new ActionRowBuilder().addComponents(
            [1, 2, 3, 4, 5].map(n =>
                new ButtonBuilder()
                    .setCustomId(`ticket_nota_${n}`)
                    .setLabel(`${n} ⭐`)
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        const msg = await donoUsuario.send({ embeds: [embed], components: [linha] });

        const coletor = msg.createMessageComponentCollector({
            time: TEMPO_AVALIACAO_MS,
            max: 1,
            filter: i => i.user.id === donoUsuario.id
        });

        coletor.on("collect", async i => {
            const nota = Number(String(i.customId).replace("ticket_nota_", "")) || 0;

            await i.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle("💙 Obrigado pela avaliação!")
                        .setDescription(`Você deu **${"⭐".repeat(nota)}** (${nota}/5).`)
                ],
                components: []
            }).catch(() => {});

            if (log) {
                await log.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFEE75C)
                            .setTitle("⭐ Avaliação de atendimento")
                            .setDescription(
                                `Ticket #${numero}\n\n` +
                                `**Nota:** ${"⭐".repeat(nota)} (${nota}/5)\n` +
                                `**Avaliado por:** ${donoUsuario}\n` +
                                `**Responsável:** ${responsavelId ? `<@${responsavelId}>` : "—"}`
                            )
                            .setTimestamp()
                    ],
                    allowedMentions: { parse: [] }
                }).catch(() => {});
            }
        });

        coletor.on("end", (coletadas) => {
            if (!coletadas.size) {
                msg.edit({ components: [] }).catch(() => {});
            }
        });

    } catch {
        // DM fechada: sem avaliação
    }
}

// Roda ANTES de apagar o canal. Nunca derruba o fechamento.
// Devolve { responsavelId, duracao, assunto, motivo } para o log.
async function aoFechar({ interaction, canal, donoId, criadoEm, motivo }) {
    const retorno = {
        responsavelId: null,
        duracao: null,
        assunto: null,
        motivo: motivo ? String(motivo).trim().slice(0, 500) : null
    };

    try {
        await preparar();

        const estado = await obterEstado(canal);
        const config = await lerConfig(interaction.guildId);
        const guild = interaction.guild;

        const abertoEm = Number(estado?.aberto_em) || Number(criadoEm) || Date.now();
        const numero = estado?.numero || canal.name;

        retorno.responsavelId = estado?.responsavel_id || null;
        retorno.duracao = textoDuracao(Date.now() - abertoEm);
        retorno.assunto = estado?.motivo || null;

        const dono = donoId
            ? await interaction.client.users.fetch(donoId).catch(() => null)
            : null;

        let arquivo = null;

        try {
            const { buffer } = await gerarTranscricao(canal, estado, {
                donoNome: dono?.username,
                responsavelNome: retorno.responsavelId
                    ? (await interaction.client.users.fetch(retorno.responsavelId).catch(() => null))?.username
                    : null
            });

            arquivo = { buffer, nome: `transcricao-${numero}.html` };
        } catch (e) {
            console.error("❌ Ticket: erro ao gerar a transcrição:", e?.message || e);
        }

        const anexos = () => arquivo
            ? [new AttachmentBuilder(arquivo.buffer, { name: arquivo.nome })]
            : [];

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🔴 Ticket fechado")
            .setDescription(
                `Ticket #${numero} · ${sem(estado?.modelo_nome || "Ticket", 100)}\n\n` +
                `**Aberto por:** ${donoId ? `<@${donoId}>` : "—"}\n` +
                `**Fechado por:** ${interaction.user}\n` +
                `**Responsável:** ${retorno.responsavelId ? `<@${retorno.responsavelId}>` : "—"}\n` +
                `**Assunto:** ${sem(retorno.assunto || "Nenhum", 500)}\n` +
                `**Duração:** ${retorno.duracao}\n` +
                `**Motivo:** ${sem(retorno.motivo || "—", 500)}`
            )
            .setTimestamp();

        const log = await canalDeLog(guild, config);

        if (log) {
            await log.send({
                embeds: [embed],
                files: anexos(),
                allowedMentions: { parse: [] }
            }).catch(e => console.error("❌ Ticket: erro ao enviar o log com transcrição:", e?.message || e));
        }

        const aceitaDm = dono
            ? (await configUsuario.obter(dono.id)).receber_dm
            : false;

        if (dono && aceitaDm && config.dm_transcricao) {
            await dono.send({
                content: `🎫 Seu ticket em **${sem(guild.name, 100)}** foi fechado. Segue a transcrição:`,
                files: anexos()
            }).catch(() => {});
        }

        if (dono && aceitaDm && config.avaliacao) {
            pedirAvaliacao({
                donoUsuario: dono,
                guildNome: guild.name,
                responsavelId: retorno.responsavelId,
                numero,
                log
            });
        }

        await mysqlPool.query("DELETE FROM ticket_estado WHERE canal_id = ?", [canal.id]);

    } catch (e) {
        console.error("❌ Ticket: erro ao preparar o fechamento:", e?.message || e);
    }

    return retorno;
}

// =====================================================
// 🔒 BOTÃO FECHAR (permissão + motivo)
// =====================================================

const fechando = new Set();

async function tratarFechar(interaction, fecharTicket) {
    const canal = interaction.channel;
    const estado = await obterEstado(canal);

    // Canal que não é ticket: deixa o ticket.js dar a resposta de sempre
    if (!estado) return fecharTicket(interaction, null);

    const config = await lerConfig(interaction.guildId);

    if (interaction.user.id !== estado.dono_id && !ehStaff(interaction.member, config)) {
        return negar(interaction, "Só o dono do ticket ou a equipe podem fechar.");
    }

    if (fechando.has(canal.id)) {
        return negar(interaction, "Este ticket já está sendo fechado.");
    }

    if (config.pedir_motivo_fechar) {
        const modal = new ModalBuilder()
            .setCustomId("ticket_modal_fechar")
            .setTitle("🔒 Fechar ticket");

        const campo = new TextInputBuilder()
            .setCustomId("motivo")
            .setLabel("Motivo do fechamento (opcional)")
            .setPlaceholder("Ex.: problema resolvido")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(campo));

        await interaction.showModal(modal);

        return true;
    }

    return fecharComTrava(interaction, fecharTicket, null);
}

async function fecharComTrava(interaction, fecharTicket, motivo) {
    const canal = interaction.channel;

    if (canal && fechando.has(canal.id)) {
        return negar(interaction, "Este ticket já está sendo fechado.");
    }

    if (canal) fechando.add(canal.id);

    try {
        return await fecharTicket(interaction, motivo);
    } catch (e) {
        if (canal) fechando.delete(canal.id);
        throw e;
    }
}

async function enviarFechar(interaction, fecharTicket) {
    const estado = await obterEstado(interaction.channel);

    if (!estado) return negar(interaction, "Este canal não é um ticket.");

    const config = await lerConfig(interaction.guildId);

    if (interaction.user.id !== estado.dono_id && !ehStaff(interaction.member, config)) {
        return negar(interaction, "Só o dono do ticket ou a equipe podem fechar.");
    }

    const motivo = interaction.fields.getTextInputValue("motivo");

    return fecharComTrava(interaction, fecharTicket, motivo && motivo.trim() ? motivo.trim() : null);
}

// =====================================================
// ⚙️ PAINEL "EXTRAS" (configurações)
// =====================================================

function painelExtras(config) {
    const onOff = v => (v ? "✅ Ligado" : "❌ Desligado");

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🧩 Extras do ticket")
        .setDescription("Ajustes que valem para **todos** os tickets deste servidor.")
        .addFields(
            {
                name: "👤 Tickets por pessoa",
                value: `Cada pessoa pode ter até **${config.limite_tickets}** ticket(s) aberto(s).`,
                inline: false
            },
            {
                name: "📁 Canal de transcrições",
                value: config.canal_transcricao_id
                    ? `<#${config.canal_transcricao_id}>\nRecebe o aviso de abertura, o fechamento com **Responsável, Duração e Motivo** e o arquivo da transcrição.`
                    : "Nenhum. (Escolha um canal abaixo para guardar as transcrições.)",
                inline: false
            },
            {
                name: "📩 Transcrição na DM do dono",
                value: onOff(config.dm_transcricao),
                inline: true
            },
            {
                name: "⭐ Avaliação do atendimento",
                value: onOff(config.avaliacao),
                inline: true
            },
            {
                name: "📝 Pedir motivo ao fechar",
                value: onOff(config.pedir_motivo_fechar),
                inline: true
            }
        );

    const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_extras_dm")
            .setLabel("DM da transcrição")
            .setEmoji("📩")
            .setStyle(config.dm_transcricao ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticket_extras_nota")
            .setLabel("Avaliação")
            .setEmoji("⭐")
            .setStyle(config.avaliacao ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticket_extras_motivo")
            .setLabel("Motivo ao fechar")
            .setEmoji("📝")
            .setStyle(config.pedir_motivo_fechar ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const menuCanal = new ChannelSelectMenuBuilder()
        .setCustomId("ticket_extras_canal")
        .setPlaceholder("📁 Escolher o canal de transcrições")
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1);

    const menuLimite = new StringSelectMenuBuilder()
        .setCustomId("ticket_extras_limite")
        .setPlaceholder("👤 Tickets abertos por pessoa")
        .addOptions(
            Array.from({ length: MAX_LIMITE_TICKETS }, (_, i) => ({
                label: `${i + 1} ticket${i ? "s" : ""} por pessoa`,
                value: String(i + 1),
                default: config.limite_tickets === i + 1
            }))
        );

    const rodape = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_extras_limpar_canal")
            .setLabel("Tirar canal de transcrições")
            .setEmoji("🧹")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!config.canal_transcricao_id),
        new ButtonBuilder()
            .setCustomId("ticket_extras_voltar")
            .setLabel("Voltar")
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [
            botoes,
            new ActionRowBuilder().addComponents(menuCanal),
            new ActionRowBuilder().addComponents(menuLimite),
            rodape
        ]
    };
}

function podeConfigurar(interaction) {
    const p = interaction.memberPermissions;

    return !!(p?.has?.(PermissionFlagsBits.Administrator) || p?.has?.(PermissionFlagsBits.ManageGuild));
}

async function tratarExtras(interaction) {
    const id = interaction.customId;

    if (!podeConfigurar(interaction)) {
        return negar(interaction, "Você precisa da permissão **Gerenciar Servidor** para mudar isso.");
    }

    const guildId = interaction.guildId;

    if (id === "ticket_extras_dm" || id === "ticket_extras_nota" || id === "ticket_extras_motivo") {
        const coluna = {
            ticket_extras_dm: "dm_transcricao",
            ticket_extras_nota: "avaliacao",
            ticket_extras_motivo: "pedir_motivo_fechar"
        }[id];

        const config = await lerConfig(guildId);

        await salvarConfig(guildId, coluna, config[coluna] ? 0 : 1);
    } else if (id === "ticket_extras_limpar_canal") {
        await salvarConfig(guildId, "canal_transcricao_id", null);
    } else if (id === "ticket_extras_canal") {
        const canalId = interaction.values[0];
        const canal = await interaction.guild.channels.fetch(canalId).catch(() => null);

        if (!canal) return negar(interaction, "Não achei esse canal.");

        const eu = interaction.guild.members.me;
        const permissoes = eu ? canal.permissionsFor(eu) : null;

        if (
            permissoes &&
            !(permissoes.has(PermissionFlagsBits.ViewChannel) &&
              permissoes.has(PermissionFlagsBits.SendMessages) &&
              permissoes.has(PermissionFlagsBits.AttachFiles))
        ) {
            return negar(interaction, `Eu preciso das permissões **Ver canal**, **Enviar mensagens** e **Anexar arquivos** em ${canal}.`);
        }

        await salvarConfig(guildId, "canal_transcricao_id", canalId);
    } else if (id === "ticket_extras_limite") {
        const n = Number(interaction.values[0]);

        if (!Number.isInteger(n) || n < 1 || n > MAX_LIMITE_TICKETS) {
            return negar(interaction, "Valor inválido.");
        }

        await salvarConfig(guildId, "limite_tickets", n);
    }

    await interaction.update(painelExtras(await lerConfig(guildId)));

    return true;
}

// =====================================================
// 🚦 ENTRADAS (chamadas pelo ticket.js)
// =====================================================

const BOTOES = {
    ticket_assumir: assumir,
    ticket_liberar: liberar,
    ticket_membros: abrirMembros,
    ticket_renomear: abrirRenomear,
    ticket_transcricao: botaoTranscricao
};

const BOTOES_EXTRAS = new Set([
    "ticket_extras_dm",
    "ticket_extras_nota",
    "ticket_extras_motivo",
    "ticket_extras_limpar_canal"
]);

async function handleButton(interaction) {
    const id = interaction.customId;

    if (id === "ticket_extras") {
        if (!podeConfigurar(interaction)) {
            return negar(interaction, "Você precisa da permissão **Gerenciar Servidor** para mudar isso.");
        }

        await preparar();

        await interaction.update(painelExtras(await lerConfig(interaction.guildId)));

        return true;
    }

    if (BOTOES_EXTRAS.has(id)) {
        await preparar();
        return tratarExtras(interaction);
    }

    if (BOTOES[id]) {
        await preparar();
        return BOTOES[id](interaction);
    }

    return false;
}

async function handleSelect(interaction) {
    const id = interaction.customId;

    if (id === "ticket_extras_canal" || id === "ticket_extras_limite") {
        await preparar();
        return tratarExtras(interaction);
    }

    if (id === "ticket_sel_transferir") {
        await preparar();
        return transferir(interaction);
    }

    if (id === "ticket_sel_membro") {
        await preparar();
        return selecionarMembro(interaction);
    }

    return false;
}

async function handleModal(interaction, { fecharTicket }) {
    const id = interaction.customId;

    if (id === "ticket_modal_renomear") {
        await preparar();
        return enviarRenomear(interaction);
    }

    if (id === "ticket_modal_fechar") {
        await preparar();
        return enviarFechar(interaction, fecharTicket);
    }

    return false;
}

module.exports = {
    preparar,
    linhaTicket,
    ticketsDoUsuario,
    registrarAbertura,
    aoFechar,
    tratarFechar,
    handleButton,
    handleSelect,
    handleModal,
    // usados nos testes
    _teste: {
        textoDuracao,
        limparNomeCanal,
        formatarTexto,
        gerarTranscricao,
        painelExtras,
        ehStaff,
        lerConfig,
        obterEstado
    }
};
