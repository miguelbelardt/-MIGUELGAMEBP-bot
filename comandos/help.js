const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require("discord.js");

const { nomeBot } = require("../botNome.js");

const PREFIXO = "'";
const COR = 0x1ABC9C;
const TEMPO_PAINEL = 5 * 60 * 1000;

// =====================================================
// 📚 SEÇÕES DA CENTRAL
// Para mudar algo, edite aqui. Comandos que não estiverem
// em nenhuma lista aparecem sozinhos em "Gestão".
// =====================================================

const SECOES = [
    {
        id: "central",
        nome: "Central",
        emoji: "🏠",
        resumo: "Visão geral e atalhos principais"
    },
    {
        id: "musica",
        nome: "Music Player",
        emoji: "🎧",
        resumo: "Pesquisar, tocar e controlar músicas",
        comandos: {
            play: "Toca uma música (nome, link do SoundCloud ou link de áudio).",
            pause: "Pausa a música atual.",
            resume: "Continua a música pausada.",
            skip: "Pula para a próxima música da fila.",
            stop: "Para tudo, limpa a fila e sai da call.",
            fila: "Mostra a fila de músicas.",
            tocando: "Mostra a música atual, com barra de progresso e botões.",
            volume: "Muda o volume da música (1 a 200).",
            loop: "Repete a música atual ou a fila toda.",
            shuffle: "Embaralha a ordem das músicas da fila.",
            "entrar-call": "Faz o bot entrar em um canal de voz.",
            "sair-call": "Faz o bot sair do canal de voz."
        }
    },
    {
        id: "informacoes",
        nome: "Informações",
        emoji: "🔎",
        resumo: "Perfil, servidor, bot e emojis",
        comandos: {
            serverinfo: "Informações do servidor.",
            membroinfo: "Informações e perfil de um membro.",
            botinfo: "Informações sobre o bot.",
            emojiinfo: "Detalhes de um emoji.",
            idcomando: "Mostra o ID de um Slash Command.",
            avatar: "Mostra o avatar de alguém em tamanho grande."
        }
    },
    {
        id: "economia",
        nome: "Moedas e XP",
        emoji: "💎",
        resumo: "Saldo, recompensas, premium e ranking",
        comandos: {
            daily: "Resgata sua recompensa diária.",
            "daily-notificar": "Gerencia o aviso do seu Daily.",
            atm: "Mostra seu saldo de moedas.",
            pay: "Envia moedas para outro usuário.",
            "moedas-ranking": "Ranking de quem tem mais moedas.",
            premium: "Compra ou renova o premium.",
            xp: "Mostra o XP de um usuário.",
            "ver-xp": "Mostra o XP de um usuário.",
            "xp-ranking": "Ranking de XP, global ou do servidor.",
            rank: "Seu nível, XP e posição, em imagem.",
            perfil: "Seu perfil com nível, moedas e premium.",
            trabalhar: "Trabalhe para ganhar moedas (1 vez por hora).",
            loja: "Veja e compre itens da loja.",
            comprar: "Compra um item da loja.",
            inventario: "Veja os itens de um inventário.",
            usar: "Usa um item do seu inventário."
        }
    },
    {
        id: "suporte",
        nome: "Suporte",
        emoji: "🎫",
        resumo: "Tickets, registro e sugestões",
        comandos: {
            ticket: "Configura o sistema de tickets.",
            registrar: "Cria e configura o registro do servidor.",
            sugestao: "Envia uma sugestão para o dono do bot."
        }
    },
    {
        id: "diversao",
        nome: "Diversão",
        emoji: "🎮",
        resumo: "Jogos, interações e curiosidades",
        comandos: {
            ppt: "Pedra, Papel e Tesoura contra o bot.",
            pptduo: "Desafia alguém para Pedra, Papel e Tesoura.",
            ship: "Chance de duas pessoas darem match.",
            sorteio: "Cria e gerencia sorteios.",
            "8ball": "Faça uma pergunta para a bola 8 mágica.",
            dado: "Rola um ou mais dados.",
            casar: "Peça alguém em casamento (gasta 1 anel da loja).",
            divorciar: "Termina o seu casamento.",
            casamento: "Veja com quem alguém está casado."
        }
    },
    {
        id: "utilidade",
        nome: "Utilidade",
        emoji: "🧰",
        resumo: "Enquetes, lembretes e AFK",
        comandos: {
            enquete: "Cria uma votação com botões.",
            lembrete: "O bot te avisa depois (criar, listar, remover).",
            afk: "Fica AFK e avisa quem te marcar."
        }
    },
    {
        id: "sistemas",
        nome: "Sistemas",
        emoji: "📦",
        resumo: "Calls, logs, YouTube e ferramentas do servidor",
        comandos: {
            criarcall: "Sistema de calls temporárias.",
            youtube: "Avisa quando um canal do YouTube posta vídeo.",
            reactrole: "Cargos por reação.",
            embed: "Cria e gerencia embeds.",
            join: "Configura as boas-vindas.",
            leave: "Configura a mensagem de saída.",
            logs: "Configura os logs do servidor."
        }
    },
    {
        id: "moderacao",
        nome: "Moderação",
        emoji: "🛡️",
        resumo: "Banir, expulsar, silenciar e advertir",
        comandos: {
            ban: "Bane um membro do servidor.",
            unban: "Desbane um usuário pelo ID.",
            kick: "Expulsa um membro do servidor.",
            timeout: "Silencia um membro por um tempo.",
            warn: "Dá uma advertência a um membro.",
            warns: "Veja as advertências de um membro.",
            delwarn: "Remove uma advertência pelo número."
        }
    },
    {
        id: "gestao",
        nome: "Gestão",
        emoji: "🛠️",
        resumo: "Administração do bot e do servidor",
        comandos: {
            say: "Faz o bot enviar uma mensagem.",
            "say-adm": "Envia uma mensagem privada para um usuário.",
            clear: "Apaga mensagens do canal.",
            "dar-adm": "Dá ou remove a permissão de ADM do bot.",
            "dar-premium": "Dá dias de premium a um usuário.",
            "set-xp": "Define o XP de um usuário.",
            "add-xp": "Adiciona XP a um usuário.",
            "adicionar-xp": "Adiciona XP a um usuário.",
            "remove-xp": "Remove XP de um usuário."
        }
    }
];

const IGNORADOS = new Set(["help", "ajuda"]);

const ACESSO_RAPIDO = [
    "play", "perfil", "rank", "loja",
    "daily", "trabalhar", "serverinfo", "help"
];

// =====================================================
// 🧱 MONTAGEM DOS EMBEDS
// =====================================================

function comandosDaSecao(client, secao) {
    const existentes = new Set(client.commands.keys());
    const lista = [];

    for (const [nome, texto] of Object.entries(secao.comandos || {})) {
        if (existentes.has(nome)) lista.push([nome, texto]);
    }

    // Comandos novos que ninguém colocou em seção caem em Gestão
    if (secao.id === "gestao") {
        const conhecidos = new Set();
        for (const s of SECOES) {
            for (const nome of Object.keys(s.comandos || {})) conhecidos.add(nome);
        }

        for (const [nome, comando] of client.commands) {
            if (conhecidos.has(nome) || IGNORADOS.has(nome)) continue;
            lista.push([nome, comando.data?.description || "Sem descrição."]);
        }
    }

    return lista;
}

function embedBase(client, secao) {
    return new EmbedBuilder()
        .setColor(COR)
        .setAuthor({
            name: `✦ ${nomeBot()} / Command Center`
        })
        .setFooter({
            text: `${nomeBot()} • Use o menu para navegar. Os controles são de quem abriu o painel e da equipe com permissão de gestão.`
        })
        .setTitle(`${secao.emoji} ${secao.nome}`);
}

function embedCentral(client) {
    const total = [...client.commands.keys()]
        .filter(nome => !IGNORADOS.has(nome)).length;

    const atalhos = ACESSO_RAPIDO
        .filter(nome => client.commands.has(nome))
        .map(nome => `\`${PREFIXO}${nome}\``)
        .join(" · ");

    return embedBase(client, SECOES[0])
        .setDescription(
            `**Bem-vindo à central de comandos.**\n` +
            `Escolha uma seção no menu para explorar música, informação, economia, suporte, diversão e as ferramentas do servidor.\n\n` +

            `⚡ **Acesso rápido**\n${atalhos}\n\n` +

            `🧭 **Navegação**\n` +
            `Use o menu para trocar de categoria sem enviar novas mensagens. ` +
            `O botão **Início** volta para esta página, **Atualizar** reconstrói o painel e **Fechar** encerra a ajuda.\n\n` +

            `⌨️ **Prefixo e slash**\n` +
            `Prefixo configurado: \`${PREFIXO}\`. Os comandos slash aparecem ao digitar \`/\`.\n\n` +

            `📊 **${total}** comandos disponíveis\n\n` +
            `💡 *Dica: entre em uma call antes de pedir música.*`
        );
}

function embedSecao(client, secao) {
    const lista = comandosDaSecao(client, secao);

    const texto = lista.length
        ? lista
            .map(([nome, descricao]) => `**/${nome}**\n┗ ${descricao}\n┗ Prefixo: \`${PREFIXO}${nome}\``)
            .join("\n\n")
        : "Nenhum comando disponível nesta seção.";

    return embedBase(client, secao)
        .setDescription(
            `*${secao.resumo}*\n\n${texto}`.slice(0, 4000)
        );
}

function montarEmbed(client, id) {
    const secao = SECOES.find(s => s.id === id) || SECOES[0];
    return secao.id === "central" ? embedCentral(client) : embedSecao(client, secao);
}

// =====================================================
// 🎛️ COMPONENTES
// =====================================================

function montarComponentes(idPainel, secaoAtual, desativado = false) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`help_menu_${idPainel}`)
        .setPlaceholder("🧭 Escolha uma seção para explorar...")
        .setDisabled(desativado)
        .addOptions(
            SECOES.map(secao => ({
                label: secao.nome,
                description: secao.resumo.slice(0, 100),
                value: secao.id,
                emoji: secao.emoji,
                default: secao.id === secaoAtual
            }))
        );

    const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`help_inicio_${idPainel}`)
            .setLabel("Início")
            .setEmoji("🏠")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(desativado),
        new ButtonBuilder()
            .setCustomId(`help_atualizar_${idPainel}`)
            .setLabel("Atualizar")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(desativado),
        new ButtonBuilder()
            .setCustomId(`help_fechar_${idPainel}`)
            .setLabel("Fechar")
            .setEmoji("✖️")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(desativado)
    );

    return [
        new ActionRowBuilder().addComponents(menu),
        botoes
    ];
}

// =====================================================
// 🚀 ABRIR O PAINEL (slash e prefixo usam o mesmo)
// =====================================================

async function abrirPainel(client, donoId, enviar) {
    const idPainel = Date.now().toString(36);
    let secaoAtual = "central";

    const mensagem = await enviar({
        embeds: [montarEmbed(client, secaoAtual)],
        components: montarComponentes(idPainel, secaoAtual),
        allowedMentions: { repliedUser: false }
    });

    if (!mensagem || typeof mensagem.createMessageComponentCollector !== "function") return;

    const coletor = mensagem.createMessageComponentCollector({
        filter: i => i.customId.endsWith(`_${idPainel}`),
        time: TEMPO_PAINEL
    });

    coletor.on("collect", async interacao => {
        try {
            const ehDono = interacao.user.id === donoId;
            const ehEquipe = interacao.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

            if (!ehDono && !ehEquipe) {
                await interacao.reply({
                    content: "❌ Esse painel é de quem abriu. Use `/help` para abrir o seu.",
                    ephemeral: true
                });
                return;
            }

            if (interacao.customId.startsWith("help_fechar_")) {
                coletor.stop("fechado");
                await interacao.update({
                    components: montarComponentes(idPainel, secaoAtual, true)
                });
                await interacao.deleteReply().catch(() => {});
                return;
            }

            if (interacao.isStringSelectMenu()) {
                secaoAtual = interacao.values[0];
            } else if (interacao.customId.startsWith("help_inicio_")) {
                secaoAtual = "central";
            }
            // "Atualizar" só reconstrói o painel da seção atual

            await interacao.update({
                embeds: [montarEmbed(client, secaoAtual)],
                components: montarComponentes(idPainel, secaoAtual)
            });

            coletor.resetTimer();
        } catch (erro) {
            console.error("❌ Erro no painel de ajuda:", erro);
        }
    });

    coletor.on("end", async (_, motivo) => {
        if (motivo === "fechado") return;
        try {
            await mensagem.edit({
                components: montarComponentes(idPainel, secaoAtual, true)
            });
        } catch (_erro) {
            // mensagem apagada: nada a fazer
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Abra a Central de Ajuda 📚"),

    async execute(interaction) {
        await abrirPainel(interaction.client, interaction.user.id, async dados => {
            await interaction.reply(dados);
            return interaction.fetchReply();
        });
    },

    async handlePrefix(message) {
        await abrirPainel(message.client, message.author.id, dados => message.reply(dados));
    },

    abrirPainel
};
