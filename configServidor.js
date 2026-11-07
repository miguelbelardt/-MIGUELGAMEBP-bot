// =====================================================
// 🛠️ CONFIGURAÇÕES DO SERVIDOR (/server-config)
// =====================================================
// A equipe (quem tem "Gerenciar Servidor") liga ou desliga recursos do
// bot só naquele servidor. A tabela "config_servidor" é criada sozinha.
//
// Para ligar os botões do painel: no index.js, junto das outras linhas
// "iniciar", coloque:
//   require("./configServidor.js").iniciar(client);
//
// Para criar uma opção de liga/desliga nova, acrescente no objeto OPCOES
// (e uma coluna em prepararTabela) e use configServidor.obter(guildId)
// onde ela deve valer.

const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const { mysqlPool } = require("./database/database.js");

// =====================================================
// 🎛️ OPÇÕES (chave = nome da coluna no banco)
// =====================================================

const OPCOES = {
    niveis: {
        emoji: "📈",
        nome: "Níveis e XP",
        curto: "Níveis",
        descricao: "Quem conversa neste servidor ganha XP e sobe de nível."
    },
    aviso_nivel: {
        emoji: "🆙",
        nome: "Aviso de nível",
        curto: "Aviso de nível",
        descricao: "O bot avisa quando alguém sobe de nível."
    },
    musica: {
        emoji: "🎵",
        nome: "Música",
        curto: "Música",
        descricao: "Os comandos de música (/play, /fila...) funcionam aqui."
    },
    casamento: {
        emoji: "💍",
        nome: "Casamento",
        curto: "Casamento",
        descricao: "O /casar pode ser usado neste servidor."
    },
    afk: {
        emoji: "💤",
        nome: "AFK",
        curto: "AFK",
        descricao: "O /afk funciona e o bot avisa quando marcam alguém AFK."
    },
    prefixo: {
        emoji: "❗",
        nome: "Comandos com '",
        curto: "Prefixo '",
        descricao: "Comandos por mensagem (ex.: 'help). Desligado = só comandos de barra (/)."
    }
};

const CHAVES = Object.keys(OPCOES);

const MULTIPLICADORES = [0.5, 1, 1.5, 2, 3];

const PREFIXO_ID = "cfgsrv_";

const CACHE_MS = 30 * 1000;

// =====================================================
// 🗃️ BANCO
// =====================================================

let tabelaPronta = false;

async function prepararTabela() {
    if (tabelaPronta) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS config_servidor (
            guild_id VARCHAR(30) PRIMARY KEY,
            niveis BOOLEAN NOT NULL DEFAULT TRUE,
            aviso_nivel BOOLEAN NOT NULL DEFAULT TRUE,
            musica BOOLEAN NOT NULL DEFAULT TRUE,
            casamento BOOLEAN NOT NULL DEFAULT TRUE,
            afk BOOLEAN NOT NULL DEFAULT TRUE,
            prefixo BOOLEAN NOT NULL DEFAULT TRUE,
            canal_nivel VARCHAR(30),
            multiplicador_xp DECIMAL(3,1) NOT NULL DEFAULT 1.0
        )
    `);

    tabelaPronta = true;
}

function padroes() {
    const config = { canal_nivel: null, multiplicador_xp: 1 };

    for (const chave of CHAVES) config[chave] = true;

    return config;
}

// guildId -> { dados, ate }
const cache = new Map();

function invalidar(guildId) {
    cache.delete(String(guildId));
}

// Devolve as configurações do servidor (com cache curto, porque é
// consultado a cada mensagem). Em qualquer erro devolve o padrão.
async function obter(guildId) {
    if (!guildId) return padroes();

    const id = String(guildId);
    const guardado = cache.get(id);

    if (guardado && guardado.ate > Date.now()) return guardado.dados;

    const dados = padroes();
    let ok = true;

    try {
        await prepararTabela();

        const [linhas] = await mysqlPool.query(
            "SELECT * FROM config_servidor WHERE guild_id = ?",
            [id]
        );

        const l = linhas[0];

        if (l) {
            for (const chave of CHAVES) {
                if (l[chave] !== undefined && l[chave] !== null) {
                    dados[chave] = !!Number(l[chave]);
                }
            }

            dados.canal_nivel = l.canal_nivel || null;

            const mult = Number(l.multiplicador_xp);

            dados.multiplicador_xp = MULTIPLICADORES.includes(mult) ? mult : 1;
        }
    } catch (e) {
        ok = false;
        console.error("❌ Erro ao ler as configurações do servidor:", e?.message || e);
    }

    cache.set(id, { dados, ate: Date.now() + (ok ? CACHE_MS : 10 * 1000) });

    return dados;
}

const COLUNAS_EDITAVEIS = new Set([...CHAVES, "canal_nivel", "multiplicador_xp"]);

async function definir(guildId, coluna, valor) {
    if (!COLUNAS_EDITAVEIS.has(coluna)) throw new Error("Opção inválida");

    await prepararTabela();

    await mysqlPool.query(
        `INSERT INTO config_servidor (guild_id, ${coluna}) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE ${coluna} = VALUES(${coluna})`,
        [String(guildId), valor]
    );

    invalidar(guildId);
}

async function alternar(guildId, chave) {
    if (!OPCOES[chave]) throw new Error("Opção inválida");

    invalidar(guildId);

    const atual = await obter(guildId);

    await definir(guildId, chave, atual[chave] ? 0 : 1);
}

async function restaurar(guildId) {
    await prepararTabela();

    await mysqlPool.query("DELETE FROM config_servidor WHERE guild_id = ?", [String(guildId)]);

    invalidar(guildId);
}

// =====================================================
// 🖼️ PAINEL
// =====================================================

function textoMultiplicador(m) {
    return `x${String(m).replace(".", ",")}`;
}

function painel(config) {
    const linhas = CHAVES.map(chave => {
        const o = OPCOES[chave];

        return `${config[chave] ? "🟢" : "🔴"} ${o.emoji} **${o.nome}**\n┗ ${o.descricao}`;
    });

    linhas.push(
        `📣 **Canal dos avisos de nível**\n┗ ${config.canal_nivel ? `<#${config.canal_nivel}>` : "O canal onde a pessoa subiu de nível."}`
    );

    linhas.push(
        `✨ **Multiplicador de XP**\n┗ ${textoMultiplicador(config.multiplicador_xp)} (vale para o XP ganho conversando aqui).`
    );

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🛠️ Configurações do servidor")
        .setDescription(
            "Clique nos botões para **ligar** ou **desligar**. Vale só para este servidor.\n\n" +
            linhas.join("\n\n")
        )
        .setFooter({ text: "🟢 ligado • 🔴 desligado" });

    const botao = chave =>
        new ButtonBuilder()
            .setCustomId(`${PREFIXO_ID}t_${chave}`)
            .setLabel(OPCOES[chave].curto)
            .setEmoji(OPCOES[chave].emoji)
            .setStyle(config[chave] ? ButtonStyle.Success : ButtonStyle.Secondary);

    const linha1 = new ActionRowBuilder().addComponents(
        ["niveis", "aviso_nivel", "musica", "casamento", "afk"].map(botao)
    );

    const linha2 = new ActionRowBuilder().addComponents(
        botao("prefixo"),
        new ButtonBuilder()
            .setCustomId(`${PREFIXO_ID}limparcanal`)
            .setLabel("Tirar canal de avisos")
            .setEmoji("🧹")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!config.canal_nivel),
        new ButtonBuilder()
            .setCustomId(`${PREFIXO_ID}reset`)
            .setLabel("Restaurar padrão")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Danger)
    );

    const menuMultiplicador = new StringSelectMenuBuilder()
        .setCustomId(`${PREFIXO_ID}mult`)
        .setPlaceholder(`✨ Multiplicador de XP (${textoMultiplicador(config.multiplicador_xp)})`)
        .addOptions(
            MULTIPLICADORES.map(m => ({
                label: `XP ${textoMultiplicador(m)}`,
                value: String(m),
                default: m === config.multiplicador_xp
            }))
        );

    const menuCanal = new ChannelSelectMenuBuilder()
        .setCustomId(`${PREFIXO_ID}canal`)
        .setPlaceholder("📣 Escolher o canal dos avisos de nível")
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1);

    return {
        embeds: [embed],
        components: [
            linha1,
            linha2,
            new ActionRowBuilder().addComponents(menuMultiplicador),
            new ActionRowBuilder().addComponents(menuCanal)
        ]
    };
}

async function abrirPainel(guildId) {
    invalidar(guildId);

    return painel(await obter(guildId));
}

// =====================================================
// 🔒 PERMISSÃO
// =====================================================

function podeConfigurar(interaction) {
    const p = interaction.memberPermissions;

    return !!(
        p?.has?.(PermissionFlagsBits.Administrator) ||
        p?.has?.(PermissionFlagsBits.ManageGuild)
    );
}

// =====================================================
// 🔘 BOTÕES E MENUS
// =====================================================

async function negar(interaction, texto) {
    return interaction.reply({
        content: `❌ ${texto}`,
        flags: MessageFlags.Ephemeral
    });
}

async function tratar(interaction) {
    const id = String(interaction.customId);

    if (!id.startsWith(PREFIXO_ID)) return;

    if (!interaction.guildId) {
        return negar(interaction, "Isso só funciona dentro de um servidor.");
    }

    if (!podeConfigurar(interaction)) {
        return negar(interaction, "Você precisa da permissão **Gerenciar Servidor** para mudar isso.");
    }

    const guildId = interaction.guildId;
    const acao = id.slice(PREFIXO_ID.length);

    if (acao.startsWith("t_")) {
        const chave = acao.slice(2);

        if (!OPCOES[chave]) return;

        await alternar(guildId, chave);
    } else if (acao === "reset") {
        await restaurar(guildId);
    } else if (acao === "limparcanal") {
        await definir(guildId, "canal_nivel", null);
    } else if (acao === "mult") {
        const m = Number(interaction.values?.[0]);

        if (!MULTIPLICADORES.includes(m)) return negar(interaction, "Valor inválido.");

        await definir(guildId, "multiplicador_xp", m);
    } else if (acao === "canal") {
        const canalId = interaction.values?.[0];
        const canal = canalId
            ? await interaction.guild.channels.fetch(canalId).catch(() => null)
            : null;

        if (!canal) return negar(interaction, "Não achei esse canal.");

        const eu = interaction.guild.members?.me;
        const perm = eu ? canal.permissionsFor?.(eu) : null;

        if (
            perm &&
            !(perm.has(PermissionFlagsBits.ViewChannel) && perm.has(PermissionFlagsBits.SendMessages))
        ) {
            return negar(interaction, `Eu preciso das permissões **Ver canal** e **Enviar mensagens** em ${canal}.`);
        }

        await definir(guildId, "canal_nivel", canalId);
    } else {
        return;
    }

    return interaction.update(await abrirPainel(guildId));
}

function iniciar(client) {
    client.on(Events.InteractionCreate, interaction => {
        const botaoOuMenu =
            interaction.isButton?.() || interaction.isAnySelectMenu?.();

        if (!botaoOuMenu) return;

        if (!String(interaction.customId).startsWith(PREFIXO_ID)) return;

        tratar(interaction).catch(async e => {
            console.error("❌ Erro nas configurações do servidor:", e);

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "❌ Não consegui salvar agora. Tente de novo em instantes.",
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch {
                // sem resposta possível
            }
        });
    });
}

module.exports = {
    OPCOES,
    iniciar,
    obter,
    definir,
    alternar,
    restaurar,
    abrirPainel,
    podeConfigurar,
    invalidar,
    _teste: { painel, tratar }
};
