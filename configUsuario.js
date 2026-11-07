// =====================================================
// ⚙️ CONFIGURAÇÕES PESSOAIS (liga/desliga de cada pessoa)
// =====================================================
// Cada pessoa escolhe com o /config o que quer ou não receber do bot.
// A tabela "config_usuario" é criada sozinha.
//
// Para ligar os botões do painel: no index.js, junto das outras linhas
// "iniciar", coloque:
//   require("./configUsuario.js").iniciar(client);
//
// Para criar uma opção nova, é só acrescentar no objeto OPCOES abaixo
// (e usar configUsuario.obter(userId) onde ela deve valer).

const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const { mysqlPool } = require("./database/database.js");

// =====================================================
// 🎛️ OPÇÕES (chave = nome da coluna no banco)
// =====================================================

const OPCOES = {
    aviso_nivel: {
        padrao: true,
        emoji: "🆙",
        nome: "Aviso de nível",
        curto: "Aviso de nível",
        descricao: "O bot avisa no chat (marcando você) quando você sobe de nível."
    },
    aceitar_casamento: {
        padrao: true,
        emoji: "💍",
        nome: "Pedidos de casamento",
        curto: "Casamento",
        descricao: "Outras pessoas podem usar /casar com você."
    },
    lembrete_dm: {
        padrao: false,
        emoji: "⏰",
        nome: "Lembretes na DM",
        curto: "Lembretes na DM",
        descricao: "Seus lembretes chegam na DM em vez de no canal onde você criou."
    },
    receber_dm: {
        padrao: true,
        emoji: "📩",
        nome: "DMs do bot",
        curto: "DMs do bot",
        descricao: "O bot pode te mandar DM (transcrição e avaliação de tickets)."
    }
};

const CHAVES = Object.keys(OPCOES);

const PREFIXO_BOTAO = "cfgusr_";

// =====================================================
// 🗃️ BANCO
// =====================================================

let tabelaPronta = false;

async function prepararTabela() {
    if (tabelaPronta) return;

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS config_usuario (
            user_id VARCHAR(30) PRIMARY KEY,
            aviso_nivel BOOLEAN NOT NULL DEFAULT TRUE,
            aceitar_casamento BOOLEAN NOT NULL DEFAULT TRUE,
            lembrete_dm BOOLEAN NOT NULL DEFAULT FALSE,
            receber_dm BOOLEAN NOT NULL DEFAULT TRUE
        )
    `);

    tabelaPronta = true;
}

function padroes() {
    const config = {};

    for (const chave of CHAVES) config[chave] = OPCOES[chave].padrao;

    return config;
}

// Devolve as configurações da pessoa. Se der qualquer erro no banco,
// devolve o padrão (nunca derruba o recurso que está consultando).
async function obter(userId) {
    const config = padroes();

    try {
        await prepararTabela();

        const [linhas] = await mysqlPool.query(
            "SELECT * FROM config_usuario WHERE user_id = ?",
            [String(userId)]
        );

        if (linhas[0]) {
            for (const chave of CHAVES) {
                if (linhas[0][chave] !== undefined && linhas[0][chave] !== null) {
                    config[chave] = !!Number(linhas[0][chave]);
                }
            }
        }
    } catch (e) {
        console.error("❌ Erro ao ler as configurações da pessoa:", e?.message || e);
    }

    return config;
}

async function definir(userId, chave, valor) {
    if (!OPCOES[chave]) throw new Error("Opção inválida");

    await prepararTabela();

    await mysqlPool.query(
        `INSERT INTO config_usuario (user_id, ${chave}) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE ${chave} = VALUES(${chave})`,
        [String(userId), valor ? 1 : 0]
    );
}

async function alternar(userId, chave) {
    const atual = await obter(userId);

    await definir(userId, chave, !atual[chave]);
}

async function restaurar(userId) {
    await prepararTabela();

    await mysqlPool.query("DELETE FROM config_usuario WHERE user_id = ?", [String(userId)]);
}

// =====================================================
// 🖼️ PAINEL
// =====================================================

function painel(userId, config) {
    const linhas = CHAVES.map(chave => {
        const o = OPCOES[chave];

        return `${config[chave] ? "🟢" : "🔴"} ${o.emoji} **${o.nome}**\n┗ ${o.descricao}`;
    });

    linhas.push(
        "🔔 **Aviso do Daily**\n┗ Gerencie com `/daily-notificar`."
    );

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("⚙️ Suas configurações")
        .setDescription(
            "Clique nos botões para **ligar** ou **desligar** cada opção. " +
            "Só vale para você.\n\n" + linhas.join("\n\n")
        )
        .setFooter({ text: "🟢 ligado • 🔴 desligado" });

    const botoes = CHAVES.map(chave =>
        new ButtonBuilder()
            .setCustomId(`${PREFIXO_BOTAO}${chave}_${userId}`)
            .setLabel(OPCOES[chave].curto)
            .setEmoji(OPCOES[chave].emoji)
            .setStyle(config[chave] ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const rodape = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${PREFIXO_BOTAO}reset_${userId}`)
            .setLabel("Restaurar padrão")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(botoes), rodape]
    };
}

async function abrirPainel(userId) {
    return painel(userId, await obter(userId));
}

// =====================================================
// 🔘 BOTÕES
// =====================================================

async function tratarBotao(interaction) {
    const id = interaction.customId;

    if (!id.startsWith(PREFIXO_BOTAO)) return;

    // cfgusr_<chave>_<dono>  (a chave pode ter "_" dentro)
    const sem = id.slice(PREFIXO_BOTAO.length);
    const corte = sem.lastIndexOf("_");
    const chave = sem.slice(0, corte);
    const donoId = sem.slice(corte + 1);

    if (donoId !== interaction.user.id) {
        return interaction.reply({
            content: "❌ Esse painel é de outra pessoa. Use `/config` para abrir o seu.",
            flags: MessageFlags.Ephemeral
        });
    }

    if (chave === "reset") {
        await restaurar(interaction.user.id);
    } else if (OPCOES[chave]) {
        await alternar(interaction.user.id, chave);
    } else {
        return;
    }

    return interaction.update(await abrirPainel(interaction.user.id));
}

function iniciar(client) {
    client.on(Events.InteractionCreate, interaction => {
        if (!interaction.isButton?.()) return;

        if (!String(interaction.customId).startsWith(PREFIXO_BOTAO)) return;

        tratarBotao(interaction).catch(async e => {
            console.error("❌ Erro nas configurações pessoais:", e);

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
    _teste: { painel, tratarBotao }
};
