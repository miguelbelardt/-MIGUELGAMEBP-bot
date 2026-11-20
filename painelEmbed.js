// =====================================================
// 🧩 EMBEDS NO PAINEL
// =====================================================
// Usa a mesma tabela (embeds_personalizados) e o mesmo visual do antigo /embed.

const { ChannelType } = require("discord.js");

const { mysqlPool } = require("./database/database.js");
const embedCmd = require("./comandos/embed.js");

const E = embedCmd._painel;

const MAX_EMBEDS = 50;

const LIMITES = {
    nome: 100,
    mensagem: 2000,
    titulo: 256,
    descricao: 4096,
    autor: 256,
    rodape: 2048
};

const LINKS = ["titulo_url", "imagem", "thumbnail", "autor_icone", "autor_url", "rodape_icone"];

const CHAVES = [
    "nome", "mensagem", "titulo", "descricao", "autor", "rodape",
    ...LINKS, "cor", "timestamp", "campos", "botoes", "canal_id"
];

function ehTexto(canal) {
    return canal?.type === ChannelType.GuildText || canal?.type === ChannelType.GuildAnnouncement;
}

function linhaParaApi(l) {
    return {
        id: String(l.id),
        nome: l.nome || "Embed",
        mensagem: l.mensagem_texto || "",
        titulo: l.titulo || "",
        titulo_url: l.titulo_url || "",
        descricao: l.descricao || "",
        cor: /^#[0-9a-f]{6}$/i.test(l.cor || "") ? l.cor.toUpperCase() : "#5865F2",
        imagem: l.imagem || "",
        thumbnail: l.thumbnail || "",
        autor: l.autor_nome || "",
        autor_icone: l.autor_icone || "",
        autor_url: l.autor_url || "",
        rodape: l.rodape || "",
        rodape_icone: l.rodape_icone || "",
        timestamp: !!l.timestamp,
        campos: E.textoParaCampos(l.campos).map(c => ({ nome: c.name, valor: c.value, inline: c.inline })),
        botoes: E.textoParaBotoes(l.botoes).map(b => ({ texto: b.label, url: b.url, emoji: b.emoji })),
        canal_id: l.canal_id || null,
        enviado: !!(l.canal_id && l.mensagem_id),
        link: l.canal_id && l.mensagem_id ? `https://discord.com/channels/${l.guild_id}/${l.canal_id}/${l.mensagem_id}` : null
    };
}

async function ler(guild) {
    await E.garantirColunasExtras();

    const [linhas] = await mysqlPool.query(
        "SELECT * FROM embeds_personalizados WHERE guild_id = ? ORDER BY id DESC LIMIT ?",
        [guild.id, MAX_EMBEDS + 1]
    );

    return {
        max: MAX_EMBEDS,
        maxCampos: E.MAX_CAMPOS,
        maxBotoes: E.MAX_BOTOES,
        embeds: linhas.slice(0, MAX_EMBEDS).map(linhaParaApi),
        canais: [...guild.channels.cache.values()]
            .filter(ehTexto)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({ id: c.id, nome: c.name }))
    };
}

// Valida o corpo inteiro. Devolve { erro } ou { cfg, canalId }
function validar(guild, corpo) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Dados inválidos." };

    for (const k of Object.keys(corpo)) {
        if (!CHAVES.includes(k)) return { erro: `Opção desconhecida: ${String(k).slice(0, 40)}` };
    }

    const texto = (k, nomeBonito) => {
        const v = corpo[k] ?? "";

        if (typeof v !== "string") return { erro: `Texto inválido em "${nomeBonito}".` };
        if (v.length > LIMITES[k]) return { erro: `"${nomeBonito}" passou do limite de ${LIMITES[k]} caracteres.` };

        return { v: v.trim() };
    };

    const t = {};

    for (const [k, bonito] of [["nome", "Nome"], ["mensagem", "Texto acima do embed"], ["titulo", "Título"], ["descricao", "Descrição"], ["autor", "Autor"], ["rodape", "Rodapé"]]) {
        const r = texto(k, bonito);

        if (r.erro) return r;

        t[k] = r.v;
    }

    if (!t.nome) t.nome = "Embed";

    const l = {};

    for (const k of LINKS) {
        const v = corpo[k] ?? "";

        if (typeof v !== "string") return { erro: "Link inválido." };

        const s = v.trim();

        if (s.length > 1000) return { erro: "Link grande demais." };
        if (s && !E.validarURL(s)) return { erro: "Os links precisam começar com http:// ou https://" };

        l[k] = s;
    }

    const cor = typeof corpo.cor === "string" ? corpo.cor.trim() : "#5865F2";

    if (!/^#[0-9a-f]{6}$/i.test(cor)) return { erro: "Cor inválida. Use o formato #RRGGBB." };

    if (corpo.timestamp !== undefined && typeof corpo.timestamp !== "boolean") return { erro: "Opção de horário inválida." };

    // ---- campos ----
    const camposIn = corpo.campos ?? [];

    if (!Array.isArray(camposIn)) return { erro: "Campos inválidos." };
    if (camposIn.length > E.MAX_CAMPOS) return { erro: `O máximo é ${E.MAX_CAMPOS} campos.` };

    const campos = [];

    for (const c of camposIn) {
        if (!c || typeof c !== "object" || typeof c.nome !== "string" || typeof c.valor !== "string") return { erro: "Campo inválido." };

        const nome = c.nome.trim();
        const valor = c.valor.trim();

        if (!nome || !valor) return { erro: "Todo campo precisa de nome e valor (ou remova o campo vazio)." };
        if (nome.length > 256) return { erro: "O nome de um campo passou de 256 caracteres." };
        if (valor.length > 1024) return { erro: "O valor de um campo passou de 1024 caracteres." };
        if (/[|\n\r]/.test(nome) || valor.includes("|")) return { erro: "Nos campos não pode usar o caractere | (e o nome não pode ter quebra de linha)." };

        campos.push({ name: nome, value: valor.replace(/\r/g, ""), inline: c.inline === true });
    }

    // ---- botões de link ----
    const botoesIn = corpo.botoes ?? [];

    if (!Array.isArray(botoesIn)) return { erro: "Botões inválidos." };
    if (botoesIn.length > E.MAX_BOTOES) return { erro: `O máximo é ${E.MAX_BOTOES} botões.` };

    const botoes = [];

    for (const b of botoesIn) {
        if (!b || typeof b !== "object" || typeof b.texto !== "string" || typeof b.url !== "string") return { erro: "Botão inválido." };

        const texto = b.texto.trim();
        const url = b.url.trim();
        const emoji = typeof b.emoji === "string" ? b.emoji.trim() : "";

        if (!texto || !url) return { erro: "Todo botão precisa de texto e link (ou remova o botão vazio)." };
        if (texto.length > 80) return { erro: "O texto de um botão passou de 80 caracteres." };
        if (url.length > 512 || url.includes("|") || !E.validarURL(url)) return { erro: "O link de um botão é inválido (precisa começar com http:// ou https://)." };
        if (texto.includes("|") || /[\n\r]/.test(texto)) return { erro: "No texto do botão não pode usar | nem quebra de linha." };
        if (emoji && !E.emojiValido(emoji)) return { erro: "Um dos emojis dos botões é inválido." };

        botoes.push({ label: texto, url, emoji });
    }

    // ---- canal ----
    const canalId = corpo.canal_id;

    if (typeof canalId !== "string" || !ehTexto(guild.channels.cache.get(canalId))) return { erro: "Escolha um canal de texto válido." };

    // ---- conteúdo mínimo e limite total do Discord ----
    if (!t.titulo && !t.descricao && !l.imagem && !l.thumbnail && !t.autor && !t.rodape && !campos.length) {
        return { erro: "Preencha pelo menos um campo do embed (título, descrição, imagem, etc.)." };
    }

    const total = t.titulo.length + t.descricao.length + t.autor.length + t.rodape.length
        + campos.reduce((s, c) => s + c.name.length + c.value.length, 0);

    if (total > 6000) return { erro: `O embed passou do limite de 6000 caracteres do Discord (está com ${total}).` };

    return {
        canalId,
        nome: t.nome,
        cfg: {
            nome: t.nome,
            titulo: t.titulo,
            tituloUrl: l.titulo_url,
            descricao: t.descricao,
            cor,
            imagem: l.imagem,
            thumbnail: l.thumbnail,
            autor: t.autor,
            autorIcone: l.autor_icone,
            autorUrl: l.autor_url,
            footer: t.rodape,
            footerIcone: l.rodape_icone,
            timestamp: corpo.timestamp === true,
            campos: E.camposParaTexto(campos),
            mensagem: t.mensagem,
            botoes: E.botoesParaTexto(botoes)
        }
    };
}

// Envia, edita ou move a mensagem. Devolve { mensagem } ou { erro }
async function publicar(guild, linhaAntiga, canalId, cfg, nomeUsuario) {
    const canal = await guild.channels.fetch(canalId).catch(() => null);

    if (!canal || !ehTexto(canal)) return { erro: "O canal escolhido não existe ou não é um canal de texto." };

    const resultado = E.criarEmbed(cfg, nomeUsuario ? { username: nomeUsuario } : null);

    if (!resultado.sucesso) return { erro: "Preencha pelo menos um campo do embed." };

    const payload = {
        content: cfg.mensagem || undefined,
        embeds: [resultado.embed],
        components: E.criarComponentesBotoes(cfg)
    };

    try {
        let mensagem = null;

        if (linhaAntiga?.canal_id && linhaAntiga?.mensagem_id) {
            const antigo = await guild.channels.fetch(linhaAntiga.canal_id).catch(() => null);

            if (antigo?.isTextBased?.()) mensagem = await antigo.messages.fetch(linhaAntiga.mensagem_id).catch(() => null);
        }

        if (mensagem && mensagem.channel.id !== canal.id) {
            await mensagem.delete().catch(() => {});
            mensagem = null;
        }

        if (mensagem) {
            await mensagem.edit({ ...payload, content: cfg.mensagem || null });

            return { mensagem, editado: true };
        }

        return { mensagem: await canal.send(payload), editado: false };
    } catch {
        return { erro: "Não consegui enviar o embed. Confira se o bot pode ver, enviar mensagens e inserir links nesse canal." };
    }
}

const COLUNAS_EXTRAS = (id, guildId, cfg) => [
    cfg.tituloUrl || null, cfg.autorUrl || null, cfg.campos || null, cfg.mensagem || null, cfg.botoes || null, id, guildId
];

async function criar(guild, corpo, usuarioId, nomeUsuario) {
    const v = validar(guild, corpo);

    if (v.erro) return v;

    await E.garantirColunasExtras();

    const [[{ total }]] = await mysqlPool.query(
        "SELECT COUNT(*) AS total FROM embeds_personalizados WHERE guild_id = ?",
        [guild.id]
    );

    if (Number(total) >= MAX_EMBEDS) return { erro: `Limite de ${MAX_EMBEDS} embeds por servidor. Apague algum antes.` };

    const env = await publicar(guild, null, v.canalId, v.cfg, nomeUsuario);

    if (env.erro) return env;

    const c = v.cfg;
    const agora = Date.now();

    try {
        const [r] = await mysqlPool.query(
            `INSERT INTO embeds_personalizados
                (guild_id, nome, autor_nome, autor_icone, titulo, descricao, cor, imagem, thumbnail,
                 rodape, rodape_icone, timestamp, canal_id, mensagem_id, criado_por, criado_em, atualizado_em,
                 titulo_url, autor_url, campos, mensagem_texto, botoes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                guild.id, c.nome, c.autor || null, c.autorIcone || null, c.titulo || null, c.descricao || null,
                c.cor, c.imagem || null, c.thumbnail || null, c.footer || null, c.footerIcone || null,
                c.timestamp ? 1 : 0, env.mensagem.channel.id, env.mensagem.id, usuarioId || null, agora, agora,
                c.tituloUrl || null, c.autorUrl || null, c.campos || null, c.mensagem || null, c.botoes || null
            ]
        );

        return { ok: true, id: String(r.insertId) };
    } catch (e) {
        await env.mensagem.delete().catch(() => {});
        console.error("❌ Painel (embed):", e?.message || e);

        return { erro: "Não consegui salvar o embed no banco." };
    }
}

async function carregar(guild, id) {
    if (!/^\d{1,20}$/.test(String(id))) return null;

    await E.garantirColunasExtras();

    const [linhas] = await mysqlPool.query(
        "SELECT * FROM embeds_personalizados WHERE id = ? AND guild_id = ?",
        [id, guild.id]
    );

    return linhas[0] || null;
}

async function salvar(guild, id, corpo, nomeUsuario) {
    const antiga = await carregar(guild, id);

    if (!antiga) return { erro: "Embed não encontrado." };

    const v = validar(guild, corpo);

    if (v.erro) return v;

    const env = await publicar(guild, antiga, v.canalId, v.cfg, nomeUsuario);

    if (env.erro) return env;

    const c = v.cfg;

    await mysqlPool.query(
        `UPDATE embeds_personalizados SET
            nome = ?, autor_nome = ?, autor_icone = ?, titulo = ?, descricao = ?, cor = ?, imagem = ?, thumbnail = ?,
            rodape = ?, rodape_icone = ?, timestamp = ?, canal_id = ?, mensagem_id = ?, atualizado_em = ?,
            titulo_url = ?, autor_url = ?, campos = ?, mensagem_texto = ?, botoes = ?
         WHERE id = ? AND guild_id = ?`,
        [
            c.nome, c.autor || null, c.autorIcone || null, c.titulo || null, c.descricao || null, c.cor,
            c.imagem || null, c.thumbnail || null, c.footer || null, c.footerIcone || null, c.timestamp ? 1 : 0,
            env.mensagem.channel.id, env.mensagem.id, Date.now(),
            c.tituloUrl || null, c.autorUrl || null, c.campos || null, c.mensagem || null, c.botoes || null,
            id, guild.id
        ]
    );

    return { ok: true, id: String(id), editado: env.editado };
}

async function excluir(guild, id) {
    const linha = await carregar(guild, id);

    if (!linha) return { erro: "Embed não encontrado." };

    if (linha.canal_id && linha.mensagem_id) {
        const canal = await guild.channels.fetch(linha.canal_id).catch(() => null);

        if (canal?.isTextBased?.()) {
            const m = await canal.messages.fetch(linha.mensagem_id).catch(() => null);

            if (m) await m.delete().catch(() => {});
        }
    }

    await mysqlPool.query("DELETE FROM embeds_personalizados WHERE id = ? AND guild_id = ?", [id, guild.id]);

    return { ok: true };
}

module.exports = { ler, criar, salvar, excluir, _teste: { validar, linhaParaApi } };
