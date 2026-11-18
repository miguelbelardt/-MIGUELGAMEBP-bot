// =====================================================
// 👋 BOAS-VINDAS E SAÍDA NO PAINEL
// =====================================================
// Lê e salva as mesmas configurações do /join e do /leave
// (tabelas join_config e leave_config), com validação.
//
// Só mexe nos campos principais da mensagem. O que o /join e o /leave
// guardam a mais (campos extras, links...) continua intacto.

const { getJoinConfig, salvarJoinConfig, getLeaveConfig, salvarLeaveConfig } =
    require("./database/database.js");

const COMUM = {
    habilitado: true,
    embed_habilitado: true,
    autor_habilitado: true,
    autor_nome: "{username}",
    autor_icone: "{avatar}",
    thumbnail: "{avatar}",
    imagem: "{banner}",
    footer_habilitado: true,
    footer_icone: "{avatar}",
    timestamp: true
};

const PADROES = {
    entrada: {
        ...COMUM,
        content: "👋 Seja muito bem-vindo(a), {user}! Aproveite o servidor! 🎉",
        embed_titulo: "🎉 Bem-vindo ao {server}!",
        embed_descricao:
            "Olá, {user}!\n\n" +
            "Esperamos que você se divirta por aqui! 💙\n\n" +
            "👤 Você é o membro **#{members}** do servidor.",
        embed_cor: "#5865F2",
        footer_texto: "{server} • Bem-vindo!"
    },
    saida: {
        ...COMUM,
        content: "👋 {user} saiu do servidor. Até mais! 👋",
        embed_titulo: "👋 Até mais, {username}!",
        embed_descricao:
            "{user} saiu do servidor.\n\n" +
            "Esperamos que tenha gostado do tempo por aqui! 💙",
        embed_cor: "#ED4245",
        footer_texto: "{server} • Até mais!"
    }
};

const BANCO = {
    entrada: { ler: getJoinConfig, salvar: salvarJoinConfig },
    saida: { ler: getLeaveConfig, salvar: salvarLeaveConfig }
};

const VARIAVEIS = [
    ["{user}", "Menciona o usuário"],
    ["{username}", "Nome de usuário"],
    ["{userid}", "ID do usuário"],
    ["{avatar}", "Avatar do usuário"],
    ["{banner}", "Banner do usuário"],
    ["{members}", "Quantidade de membros do servidor (sem contar bots)"],
    ["{server}", "Nome do servidor"],
    ["{inviter}", "Quem convidou o usuário"],
    ["{invites}", "Total de convites de quem convidou"]
];

// campo -> regra
const BOOLEANOS = ["habilitado", "embed_habilitado", "autor_habilitado", "footer_habilitado", "timestamp"];

const TEXTOS = {
    content: 2000,
    embed_titulo: 256,
    embed_descricao: 4000,
    autor_nome: 256,
    footer_texto: 2048
};

const IMAGENS = ["thumbnail", "imagem", "autor_icone", "footer_icone"];

function ativado(valor) {
    return valor === true || valor === 1 || valor === "1";
}

function imagemValida(valor) {
    if (valor === "") return true;

    if (valor.length > 500) return false;

    // variável: {avatar}, {banner}...
    if (/^\{[a-z]+\}$/i.test(valor)) return true;

    try {
        const url = new URL(valor);

        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

// Valor efetivo: o que está salvo, ou o padrão do bot (igual ao /join e /leave)
function efetivo(linha, tipo) {
    const padrao = PADROES[tipo];
    const config = {};

    for (const [chave, valorPadrao] of Object.entries(padrao)) {
        const salvo = linha?.[chave];

        if (typeof valorPadrao === "boolean") {
            config[chave] = salvo === undefined || salvo === null ? valorPadrao : ativado(salvo);
        } else {
            config[chave] = salvo === undefined || salvo === null ? valorPadrao : String(salvo);
        }
    }

    // Sem nada salvo ainda: o recurso está desligado e sem canal
    config.habilitado = linha ? ativado(linha.habilitado) : false;
    config.canal_id = linha?.canal_id || null;
    config.configurado = !!linha;

    return config;
}

async function ler(guild, tipo) {
    const linha = await BANCO[tipo].ler(guild.id);

    return { ...efetivo(linha, tipo), variaveis: VARIAVEIS };
}

// Devolve { erro } ou { ok }
async function salvar(guild, tipo, corpo, canalValido) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
        return { erro: "Dados inválidos." };
    }

    const novo = {};

    for (const [chave, valor] of Object.entries(corpo)) {
        if (BOOLEANOS.includes(chave)) {
            if (typeof valor !== "boolean") return { erro: `Valor inválido em "${chave}".` };

            novo[chave] = valor;
        } else if (chave === "canal_id") {
            if (valor === null || valor === "") {
                novo.canal_id = null;
            } else if (typeof valor === "string" && canalValido(guild, valor)) {
                novo.canal_id = valor;
            } else {
                return { erro: "Canal inválido." };
            }
        } else if (chave in TEXTOS) {
            if (typeof valor !== "string") return { erro: `Texto inválido em "${chave}".` };

            if (valor.length > TEXTOS[chave]) {
                return { erro: `Texto grande demais em "${chave}" (máximo ${TEXTOS[chave]}).` };
            }

            novo[chave] = valor;
        } else if (chave === "embed_cor") {
            if (typeof valor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(valor)) {
                return { erro: "Cor inválida. Use o formato #RRGGBB." };
            }

            novo.embed_cor = valor.toUpperCase();
        } else if (IMAGENS.includes(chave)) {
            if (typeof valor !== "string" || !imagemValida(valor.trim())) {
                return { erro: `"${chave}" precisa ser vazio, uma variável como {avatar} ou um link http(s).` };
            }

            novo[chave] = valor.trim();
        } else {
            return { erro: `Opção desconhecida: ${String(chave).slice(0, 40)}` };
        }
    }

    if (!Object.keys(novo).length) return { erro: "Nada para salvar." };

    const atual = (await BANCO[tipo].ler(guild.id)) || {};

    // Primeira vez: grava também os padrões dos campos que não foram enviados
    const base = atual.guild_id ? atual : { ...PADROES[tipo], habilitado: false };

    await BANCO[tipo].salvar(guild.id, { ...base, ...novo });

    return { ok: true };
}

module.exports = { ler, salvar, _teste: { PADROES, efetivo, imagemValida } };
