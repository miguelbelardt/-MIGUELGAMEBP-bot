const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    UserSelectMenuBuilder,
    ChannelType,
    MessageFlags,
    Events
} = require("discord.js");

const { mysqlPool } = require("../database/database");

const EPHEMERAL = MessageFlags.Ephemeral;

// Tempo para o dono entrar na call recém-criada antes dela ser apagada (vazia)
const TEMPO_ENTRAR_MS = 2 * 60 * 1000;

// =====================================================
// 🔘 BOTÕES DO PAINEL (textos e funções são FIXOS)
// =====================================================

// Só o emoji de cada botão é configurável.
const BOTOES = {
    criar: {
        id: "callp_criar",
        texto: "Criar Call",
        estilo: ButtonStyle.Primary,
        emoji: "🚀"
    },
    nome: {
        id: "callp_nome",
        texto: "Alterar Nome",
        estilo: ButtonStyle.Primary,
        emoji: "✏️"
    },
    limite: {
        id: "callp_limite",
        texto: "Alterar Limite",
        estilo: ButtonStyle.Primary,
        emoji: "➕"
    },
    privar: {
        id: "callp_privar",
        texto: "Privar Call",
        estilo: ButtonStyle.Danger,
        emoji: "🔒"
    },
    publica: {
        id: "callp_publica",
        texto: "Tornar Call Pública",
        estilo: ButtonStyle.Success,
        emoji: "🔊"
    },
    adicionar: {
        id: "callp_adicionar",
        texto: "Adicionar Membro",
        estilo: ButtonStyle.Secondary,
        emoji: "👤"
    },
    remover: {
        id: "callp_remover",
        texto: "Tirar Membro",
        estilo: ButtonStyle.Secondary,
        emoji: "🚫"
    }
};

// Como os botões ficam distribuídos no painel
const LINHAS_BOTOES = [
    ["criar", "nome", "limite"],
    ["privar", "publica"],
    ["adicionar", "remover"]
];

const PADRAO = {
    titulo: "CALL PERSONALIZADA",
    descricao:
        "🚀 Crie sua call vip temporária no servidor clicando nos botões abaixo.",
    cor: "#00A2FF"
};

// =====================================================
// 💾 TABELAS (criadas pelo próprio comando)
// =====================================================

const COLUNAS_CONFIG = [
    "categoria_id",
    "canal_id",
    "mensagem_id",
    "embed_titulo",
    "embed_descricao",
    "embed_cor",
    "embed_rodape",
    "embed_rodape_icone",
    "embed_thumbnail",
    "embed_imagem",
    "emoji_criar",
    "emoji_nome",
    "emoji_limite",
    "emoji_privar",
    "emoji_publica",
    "emoji_adicionar",
    "emoji_remover"
];

let promessaTabelas = null;

function garantirTabelas() {
    if (!promessaTabelas) {
        promessaTabelas = (async () => {
            await mysqlPool.query(`
                CREATE TABLE IF NOT EXISTS callp_config (
                    guild_id VARCHAR(30) PRIMARY KEY,
                    categoria_id VARCHAR(30),
                    canal_id VARCHAR(30),
                    mensagem_id VARCHAR(30),
                    embed_titulo VARCHAR(256),
                    embed_descricao TEXT,
                    embed_cor VARCHAR(20),
                    embed_rodape VARCHAR(2048),
                    embed_rodape_icone TEXT,
                    embed_thumbnail TEXT,
                    embed_imagem TEXT,
                    emoji_criar VARCHAR(100),
                    emoji_nome VARCHAR(100),
                    emoji_limite VARCHAR(100),
                    emoji_privar VARCHAR(100),
                    emoji_publica VARCHAR(100),
                    emoji_adicionar VARCHAR(100),
                    emoji_remover VARCHAR(100)
                )
            `);

            await mysqlPool.query(`
                CREATE TABLE IF NOT EXISTS callp_canais (
                    canal_id VARCHAR(30) PRIMARY KEY,
                    guild_id VARCHAR(30) NOT NULL,
                    dono_id VARCHAR(30) NOT NULL,
                    criado_em BIGINT NOT NULL,
                    INDEX idx_callp_dono (guild_id, dono_id)
                )
            `);
        })().catch(erro => {
            promessaTabelas = null;

            throw erro;
        });
    }

    return promessaTabelas;
}

async function carregarConfig(guildId) {
    await garantirTabelas();

    await mysqlPool.query(
        `
        INSERT INTO callp_config (guild_id)
        VALUES (?)
        ON DUPLICATE KEY UPDATE guild_id = guild_id
        `,
        [guildId]
    );

    const [linhas] = await mysqlPool.query(
        "SELECT * FROM callp_config WHERE guild_id = ?",
        [guildId]
    );

    return linhas[0] || { guild_id: guildId };
}

async function salvarConfig(guildId, dados) {
    await garantirTabelas();

    const colunas =
        Object.keys(dados).filter(
            coluna => COLUNAS_CONFIG.includes(coluna)
        );

    if (!colunas.length) {
        return;
    }

    await mysqlPool.query(
        `
        UPDATE callp_config
        SET ${colunas.map(coluna => `${coluna} = ?`).join(", ")}
        WHERE guild_id = ?
        `,
        [
            ...colunas.map(
                coluna => dados[coluna] || null
            ),
            guildId
        ]
    );
}

// =====================================================
// 🔗 VALIDAÇÕES
// =====================================================

function urlValida(valor) {
    if (!valor) {
        return false;
    }

    try {
        const url = new URL(String(valor).trim());

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );
    } catch {
        return false;
    }
}

function converterCor(cor) {
    const valor = String(cor ?? "").trim();

    if (/^(#|0x)?[0-9a-f]{6}$/i.test(valor)) {
        return parseInt(
            valor.replace(/^(#|0x)/i, ""),
            16
        );
    }

    return parseInt(PADRAO.cor.slice(1), 16);
}

// "" = padrão | "#RRGGBB" = válida | null = inválida
function normalizarCor(texto) {
    const valor = String(texto ?? "").trim();

    if (!valor) {
        return "";
    }

    if (/^(#|0x)?[0-9a-f]{6}$/i.test(valor)) {
        return "#" +
            valor
                .replace(/^(#|0x)/i, "")
                .toUpperCase();
    }

    return null;
}

// Aceita emoji normal (😀) ou personalizado (<:nome:123> / <a:nome:123>)
// "" = voltar ao padrão | null = inválido
function normalizarEmoji(texto) {
    const valor = String(texto ?? "").trim();

    if (!valor) {
        return "";
    }

    if (/^<a?:\w{2,32}:\d{15,25}>$/.test(valor)) {
        return valor;
    }

    if (
        valor.length <= 20 &&
        /^[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️\u{1F1E6}-\u{1F1FF}]+$/u.test(valor)
    ) {
        return valor;
    }

    return null;
}

function emojiParaBotao(valor) {
    const personalizado =
        /^<(a?):(\w{2,32}):(\d{15,25})>$/.exec(
            String(valor || "")
        );

    if (personalizado) {
        return {
            animated: personalizado[1] === "a",
            name: personalizado[2],
            id: personalizado[3]
        };
    }

    return valor;
}

function emojiTexto(config, chave) {
    return (
        config?.[`emoji_${chave}`] ||
        BOTOES[chave].emoji
    );
}

function tamanhoEmbed(embed) {
    const d = embed.data || {};

    return (
        (d.title || "").length +
        (d.description || "").length +
        (d.footer?.text || "").length
    );
}

// =====================================================
// 🎨 PAINEL PÚBLICO (o que os membros veem)
// =====================================================

function criarEmbedPublico(config) {
    const embed =
        new EmbedBuilder()
            .setColor(converterCor(config?.embed_cor))
            .setTitle(
                String(
                    config?.embed_titulo ||
                    PADRAO.titulo
                ).substring(0, 256)
            )
            .setDescription(
                String(
                    config?.embed_descricao ||
                    PADRAO.descricao
                ).substring(0, 4096)
            );

    if (urlValida(config?.embed_thumbnail)) {
        embed.setThumbnail(
            String(config.embed_thumbnail).trim()
        );
    }

    if (urlValida(config?.embed_imagem)) {
        embed.setImage(
            String(config.embed_imagem).trim()
        );
    }

    if (config?.embed_rodape) {
        const rodape = {
            text:
                String(config.embed_rodape)
                    .substring(0, 2048)
        };

        if (urlValida(config.embed_rodape_icone)) {
            rodape.iconURL =
                String(config.embed_rodape_icone).trim();
        }

        embed.setFooter(rodape);
    }

    return embed;
}

function criarBotao(config, chave) {
    const botao = BOTOES[chave];

    const componente =
        new ButtonBuilder()
            .setCustomId(botao.id)
            .setLabel(botao.texto)
            .setStyle(botao.estilo);

    try {
        componente.setEmoji(
            emojiParaBotao(
                emojiTexto(config, chave)
            )
        );
    } catch {
        componente.setEmoji(botao.emoji);
    }

    return componente;
}

function criarPainelPublico(config) {
    return {
        embeds: [
            criarEmbedPublico(config)
        ],

        components:
            LINHAS_BOTOES.map(
                linha =>
                    new ActionRowBuilder()
                        .addComponents(
                            ...linha.map(
                                chave =>
                                    criarBotao(
                                        config,
                                        chave
                                    )
                            )
                        )
            )
    };
}

// =====================================================
// ⚙️ PAINEL DE CONFIGURAÇÃO (admin)
// =====================================================

function criarPainelConfig(config, conteudo = "") {
    const emojis =
        Object.keys(BOTOES)
            .map(
                chave =>
                    `${emojiTexto(config, chave)} ${BOTOES[chave].texto}`
            )
            .join("\n");

    const embed =
        new EmbedBuilder()
            .setTitle("🎙️ Configuração da Call Personalizada")
            .setDescription(
                [
                    "Acima está a prévia do painel que os membros vão ver.",
                    "Os **textos e as funções dos botões são fixos**. Aqui você muda o embed e os emojis.",
                    "",
                    `📁 Categoria das calls: ${
                        config.categoria_id
                            ? `<#${config.categoria_id}>`
                            : "❌ Nenhuma (as calls ficam fora de categoria)"
                    }`,
                    `📢 Canal do painel: ${
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "❌ Não definido"
                    }`,
                    `📌 Painel: ${
                        config.mensagem_id
                            ? "✅ Publicado"
                            : "❌ Ainda não publicado"
                    }`,
                    "",
                    "**Emojis atuais:**",
                    emojis
                ].join("\n")
            )
            .setColor(0x5865F2);

    const embedPrevia =
        criarEmbedPublico(config);

    // Soma de todos os embeds da mensagem: máx. 6000 caracteres
    const previa =
        tamanhoEmbed(embedPrevia) <= 3500
            ? embedPrevia
            : null;

    const linhaCategoria =
        new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("callp_cfg_categoria")
                    .setPlaceholder(
                        "📁 Categoria onde as calls serão criadas"
                    )
                    .setChannelTypes(
                        ChannelType.GuildCategory
                    )
            );

    const linhaCanal =
        new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("callp_cfg_canal")
                    .setPlaceholder(
                        "📢 Canal onde o painel será publicado"
                    )
                    .setChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    )
            );

    const botao = (id, label, emoji, estilo) =>
        new ButtonBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setEmoji(emoji)
            .setStyle(estilo);

    const linhaEdicao =
        new ActionRowBuilder()
            .addComponents(
                botao("callp_cfg_embed", "Embed", "🎨", ButtonStyle.Primary),
                botao("callp_cfg_imagens", "Imagens", "🖼️", ButtonStyle.Primary),
                botao("callp_cfg_emojis1", "Emojis 1/2", "😀", ButtonStyle.Secondary),
                botao("callp_cfg_emojis2", "Emojis 2/2", "😀", ButtonStyle.Secondary),
                botao("callp_cfg_resetar", "Emojis padrão", "↩️", ButtonStyle.Secondary)
            );

    const linhaAcoes =
        new ActionRowBuilder()
            .addComponents(
                botao("callp_cfg_publicar", "Publicar / Atualizar painel", "📢", ButtonStyle.Success),
                botao("callp_cfg_fechar", "Fechar", "❌", ButtonStyle.Danger)
            );

    return {
        content: conteudo,
        embeds:
            previa
                ? [previa, embed]
                : [embed],
        components: [
            linhaCategoria,
            linhaCanal,
            linhaEdicao,
            linhaAcoes
        ]
    };
}

// Atualiza no lugar quando vem de botão/menu/modal do painel
function responder(interaction, payload) {
    const doPainel =
        (
            typeof interaction.isFromMessage === "function" &&
            interaction.isFromMessage()
        ) ||
        (
            typeof interaction.isButton === "function" &&
            interaction.isButton()
        ) ||
        (
            typeof interaction.isAnySelectMenu === "function" &&
            interaction.isAnySelectMenu()
        );

    if (doPainel) {
        return interaction.update(payload);
    }

    return interaction.reply({
        ...payload,
        flags: EPHEMERAL
    });
}

async function responderPainelConfig(interaction, conteudo = "") {
    const config =
        await carregarConfig(
            interaction.guild.id
        );

    return responder(
        interaction,
        criarPainelConfig(
            config,
            conteudo
        )
    );
}

// Se o painel já foi publicado, mantém a mensagem pública em dia
async function atualizarPublicacao(guild) {
    try {
        const config =
            await carregarConfig(guild.id);

        if (!config.canal_id || !config.mensagem_id) {
            return false;
        }

        const canal =
            await guild.channels
                .fetch(config.canal_id)
                .catch(() => null);

        if (!canal || !canal.isTextBased()) {
            return false;
        }

        const mensagem =
            await canal.messages
                .fetch(config.mensagem_id)
                .catch(() => null);

        if (!mensagem) {
            return false;
        }

        await mensagem.edit(
            criarPainelPublico(config)
        );

        return true;
    } catch (erro) {
        console.error(
            "❌ Erro ao atualizar o painel da call personalizada:",
            erro
        );

        return false;
    }
}

async function publicarPainel(interaction) {
    const guild = interaction.guild;

    const config =
        await carregarConfig(guild.id);

    if (!config.canal_id) {
        return interaction.reply({
            content:
                "❌ Primeiro escolha o canal onde o painel será publicado.",
            flags: EPHEMERAL
        });
    }

    const canal =
        await guild.channels
            .fetch(config.canal_id)
            .catch(() => null);

    if (!canal || !canal.isTextBased()) {
        return interaction.reply({
            content:
                "❌ O canal escolhido não existe ou não é um canal de texto.",
            flags: EPHEMERAL
        });
    }

    const payload =
        criarPainelPublico(config);

    let atualizado = false;

    if (config.mensagem_id) {
        const mensagem =
            await canal.messages
                .fetch(config.mensagem_id)
                .catch(() => null);

        if (mensagem) {
            await mensagem.edit(payload);

            atualizado = true;
        }
    }

    if (!atualizado) {
        const mensagem =
            await canal.send(payload);

        await salvarConfig(
            guild.id,
            {
                mensagem_id: mensagem.id
            }
        );
    }

    return responderPainelConfig(
        interaction,
        atualizado
            ? `✅ Painel atualizado em <#${canal.id}>!`
            : `✅ Painel publicado em <#${canal.id}>!`
    );
}

// =====================================================
// 🧾 FORMULÁRIOS DE CONFIGURAÇÃO
// =====================================================

function campoTexto({
    id,
    label,
    valor = "",
    max = 256,
    paragrafo = false,
    placeholder = ""
}) {
    const campo =
        new TextInputBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setStyle(
                paragrafo
                    ? TextInputStyle.Paragraph
                    : TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(String(valor || ""))
            .setMaxLength(max);

    if (placeholder) {
        campo.setPlaceholder(placeholder);
    }

    return new ActionRowBuilder()
        .addComponents(campo);
}

function criarModalEmbed(config) {
    return new ModalBuilder()
        .setCustomId("callp_modal_cfg_embed")
        .setTitle("🎨 Embed do painel")
        .addComponents(
            campoTexto({
                id: "titulo",
                label: "Título",
                valor: config.embed_titulo || PADRAO.titulo,
                max: 256
            }),
            campoTexto({
                id: "descricao",
                label: "Descrição",
                valor: config.embed_descricao || PADRAO.descricao,
                max: 4000,
                paragrafo: true
            }),
            campoTexto({
                id: "cor",
                label: "Cor (#RRGGBB)",
                valor: config.embed_cor || PADRAO.cor,
                max: 20
            }),
            campoTexto({
                id: "rodape",
                label: "Rodapé",
                valor: config.embed_rodape,
                max: 2048
            })
        );
}

function criarModalImagens(config) {
    return new ModalBuilder()
        .setCustomId("callp_modal_cfg_imagens")
        .setTitle("🖼️ Imagens do painel")
        .addComponents(
            campoTexto({
                id: "thumbnail",
                label: "Thumbnail (link)",
                valor: config.embed_thumbnail,
                max: 2048,
                placeholder: "https://..."
            }),
            campoTexto({
                id: "imagem",
                label: "Imagem grande (link)",
                valor: config.embed_imagem,
                max: 2048,
                placeholder: "https://..."
            }),
            campoTexto({
                id: "rodape_icone",
                label: "Ícone do rodapé (link)",
                valor: config.embed_rodape_icone,
                max: 2048,
                placeholder: "https://..."
            })
        );
}

// Os emojis ficam em dois formulários (o Discord limita 5 campos)
const GRUPOS_EMOJIS = {
    emojis1: ["criar", "nome", "limite", "privar"],
    emojis2: ["publica", "adicionar", "remover"]
};

function criarModalEmojis(config, grupo) {
    return new ModalBuilder()
        .setCustomId(`callp_modal_cfg_${grupo}`)
        .setTitle(
            grupo === "emojis1"
                ? "😀 Emojis dos botões (1/2)"
                : "😀 Emojis dos botões (2/2)"
        )
        .addComponents(
            ...GRUPOS_EMOJIS[grupo].map(
                chave =>
                    campoTexto({
                        id: chave,
                        label: `Emoji de "${BOTOES[chave].texto}"`,
                        valor: emojiTexto(config, chave),
                        max: 100,
                        placeholder: `Vazio = padrão ${BOTOES[chave].emoji} | 😀 ou <:nome:ID> ou <a:nome:ID>`
                    })
            )
        );
}

// =====================================================
// 🎙️ CALLS DOS MEMBROS
// =====================================================

function limparNome(texto) {
    return String(texto || "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function buscarCallDoUsuario(interaction) {
    const [linhas] = await mysqlPool.query(
        "SELECT * FROM callp_canais WHERE guild_id = ? AND dono_id = ?",
        [
            interaction.guild.id,
            interaction.user.id
        ]
    );

    const linha = linhas[0];

    if (!linha) {
        return null;
    }

    const canal =
        await interaction.guild.channels
            .fetch(linha.canal_id)
            .catch(() => null);

    if (!canal) {
        // Alguém apagou o canal na mão: limpa o registro
        await mysqlPool.query(
            "DELETE FROM callp_canais WHERE canal_id = ?",
            [linha.canal_id]
        );

        return null;
    }

    return canal;
}

async function exigirCall(interaction) {
    const canal =
        await buscarCallDoUsuario(interaction);

    if (!canal) {
        await interaction.reply({
            content:
                "❌ Você ainda não tem uma call. Clique em **Criar Call** primeiro.",
            flags: EPHEMERAL
        });

        return null;
    }

    return canal;
}

async function apagarCall(client, canalId) {
    try {
        const canal =
            await client.channels
                .fetch(canalId)
                .catch(() => null);

        if (canal) {
            await canal.delete(
                "Call personalizada vazia"
            );
        }
    } catch (erro) {
        console.error(
            "❌ Erro ao apagar call personalizada:",
            erro
        );
    }

    await mysqlPool
        .query(
            "DELETE FROM callp_canais WHERE canal_id = ?",
            [canalId]
        )
        .catch(() => {});
}

async function criarCall(interaction) {
    const guild = interaction.guild;

    const existente =
        await buscarCallDoUsuario(interaction);

    if (existente) {
        if (interaction.member?.voice?.channelId) {
            await interaction.member.voice
                .setChannel(existente)
                .catch(() => {});
        }

        return interaction.reply({
            content:
                `ℹ️ Você já tem uma call: <#${existente.id}>`,
            flags: EPHEMERAL
        });
    }

    const config =
        await carregarConfig(guild.id);

    const nome =
        limparNome(
            interaction.member?.displayName ||
            interaction.user.username
        ) || "Membro";

    const permissoes = [
        {
            id: interaction.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.Stream
            ]
        }
    ];

    if (guild.members?.me?.id) {
        permissoes.push({
            id: guild.members.me.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers
            ]
        });
    }

    const opcoes = {
        name: `🔊 Call de ${nome}`.slice(0, 100),
        type: ChannelType.GuildVoice,
        permissionOverwrites: permissoes,
        reason: `Call personalizada de ${interaction.user.tag || interaction.user.username}`
    };

    let canal;

    try {
        canal = await guild.channels.create({
            ...opcoes,
            parent: config.categoria_id || undefined
        });
    } catch (erro) {
        // Categoria apagada ou sem permissão nela: tenta fora de categoria
        if (!config.categoria_id) {
            throw erro;
        }

        canal = await guild.channels.create(opcoes);
    }

    try {
        await mysqlPool.query(
            `
            INSERT INTO callp_canais
                (canal_id, guild_id, dono_id, criado_em)
            VALUES (?, ?, ?, ?)
            `,
            [
                canal.id,
                guild.id,
                interaction.user.id,
                Date.now()
            ]
        );
    } catch (erro) {
        await canal.delete().catch(() => {});

        throw erro;
    }

    let moveu = false;

    if (interaction.member?.voice?.channelId) {
        moveu = await interaction.member.voice
            .setChannel(canal)
            .then(() => true)
            .catch(() => false);
    }

    // Se o dono não entrar, a call não fica abandonada
    if (!moveu) {
        const temporizador = setTimeout(
            async () => {
                try {
                    const atual =
                        await interaction.client.channels
                            .fetch(canal.id)
                            .catch(() => null);

                    if (
                        atual &&
                        atual.members.size === 0
                    ) {
                        await apagarCall(
                            interaction.client,
                            canal.id
                        );
                    }
                } catch {}
            },
            TEMPO_ENTRAR_MS
        );

        temporizador.unref?.();
    }

    return interaction.reply({
        content:
            moveu
                ? `✅ Sua call foi criada e você já está nela: <#${canal.id}>`
                : `✅ Sua call foi criada: <#${canal.id}>\nEntre nela em até 2 minutos, senão ela é apagada.`,
        flags: EPHEMERAL
    });
}

async function pedirNome(interaction) {
    const canal =
        await exigirCall(interaction);

    if (!canal) {
        return true;
    }

    await interaction.showModal(
        new ModalBuilder()
            .setCustomId("callp_modal_nome")
            .setTitle("✏️ Alterar nome da call")
            .addComponents(
                campoTexto({
                    id: "nome",
                    label: "Novo nome da call",
                    valor: canal.name,
                    max: 100
                })
            )
    );

    return true;
}

async function pedirLimite(interaction) {
    const canal =
        await exigirCall(interaction);

    if (!canal) {
        return true;
    }

    await interaction.showModal(
        new ModalBuilder()
            .setCustomId("callp_modal_limite")
            .setTitle("➕ Alterar limite da call")
            .addComponents(
                campoTexto({
                    id: "limite",
                    label: "Limite de pessoas (0 = sem limite)",
                    valor: canal.userLimit || 0,
                    max: 2
                })
            )
    );

    return true;
}

async function salvarNome(interaction) {
    const canal =
        await exigirCall(interaction);

    if (!canal) {
        return true;
    }

    const nome =
        limparNome(
            interaction.fields
                .getTextInputValue("nome")
        ).slice(0, 100);

    if (!nome) {
        await interaction.reply({
            content:
                "❌ O nome não pode ficar vazio.",
            flags: EPHEMERAL
        });

        return true;
    }

    await canal.setName(nome);

    await interaction.reply({
        content:
            `✅ Nome da call alterado para **${nome}**.`,
        flags: EPHEMERAL
    });

    return true;
}

async function salvarLimite(interaction) {
    const canal =
        await exigirCall(interaction);

    if (!canal) {
        return true;
    }

    const texto =
        interaction.fields
            .getTextInputValue("limite")
            .trim();

    const limite = Number(texto);

    if (
        !/^\d{1,2}$/.test(texto) ||
        !Number.isInteger(limite) ||
        limite < 0 ||
        limite > 99
    ) {
        await interaction.reply({
            content:
                "❌ Digite um número de 0 a 99 (0 = sem limite).",
            flags: EPHEMERAL
        });

        return true;
    }

    await canal.setUserLimit(limite);

    await interaction.reply({
        content:
            limite === 0
                ? "✅ A call agora não tem limite de pessoas."
                : `✅ Limite da call: **${limite}** pessoas.`,
        flags: EPHEMERAL
    });

    return true;
}

async function privarCall(interaction, privada) {
    const canal =
        await exigirCall(interaction);

    if (!canal) {
        return true;
    }

    await canal.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
            Connect:
                privada
                    ? false
                    : null
        }
    );

    await interaction.reply({
        content:
            privada
                ? "🔒 Sua call agora é **privada**. Só entra quem você adicionar."
                : "🔊 Sua call agora é **pública**. Qualquer um pode entrar.",
        flags: EPHEMERAL
    });

    return true;
}

async function pedirMembros(interaction, acao) {
    const canal =
        await exigirCall(interaction);

    if (!canal) {
        return true;
    }

    await interaction.reply({
        content:
            acao === "adicionar"
                ? "👤 Escolha quem pode entrar na sua call:"
                : "🚫 Escolha quem você quer tirar da sua call:",
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId(
                            acao === "adicionar"
                                ? "callp_sel_adicionar"
                                : "callp_sel_remover"
                        )
                        .setPlaceholder("Selecione os membros")
                        .setMinValues(1)
                        .setMaxValues(5)
                )
        ],
        flags: EPHEMERAL
    });

    return true;
}

async function aplicarMembros(interaction, acao) {
    const canal =
        await buscarCallDoUsuario(interaction);

    if (!canal) {
        await interaction.update({
            content:
                "❌ Sua call não existe mais. Clique em **Criar Call** para criar outra.",
            components: []
        });

        return true;
    }

    const ids =
        interaction.values.filter(
            id => !interaction.users?.get(id)?.bot
        );

    const feitos = [];
    const ignorados = [];

    for (const id of ids) {
        if (id === interaction.user.id) {
            ignorados.push(`<@${id}> (é você, o dono da call)`);

            continue;
        }

        if (acao === "adicionar") {
            await canal.permissionOverwrites.edit(
                id,
                {
                    ViewChannel: true,
                    Connect: true,
                    Speak: true
                }
            );
        } else {
            await canal.permissionOverwrites.edit(
                id,
                {
                    Connect: false
                }
            );

            const membro =
                await interaction.guild.members
                    .fetch(id)
                    .catch(() => null);

            if (
                membro?.voice?.channelId === canal.id
            ) {
                await membro.voice
                    .disconnect()
                    .catch(() => {});
            }
        }

        feitos.push(`<@${id}>`);
    }

    const linhas = [];

    if (feitos.length) {
        linhas.push(
            acao === "adicionar"
                ? `✅ Agora podem entrar na sua call: ${feitos.join(", ")}`
                : `✅ Removidos da sua call (e sem poder voltar até você adicionar de novo): ${feitos.join(", ")}`
        );
    }

    if (ignorados.length) {
        linhas.push(
            `⚠️ Ignorados: ${ignorados.join(", ")}`
        );
    }

    if (!linhas.length) {
        linhas.push(
            "⚠️ Nenhum membro válido foi selecionado (bots são ignorados)."
        );
    }

    await interaction.update({
        content: linhas.join("\n"),
        components: []
    });

    return true;
}

// =====================================================
// 🖱️ INTERAÇÕES
// =====================================================

async function tratarInteracao(interaction) {
    const id = interaction.customId || "";

    if (
        !id.startsWith("callp_") ||
        !interaction.guild
    ) {
        return false;
    }

    await garantirTabelas();

    // ---------------------------------------------
    // 🔐 CONFIGURAÇÃO (só quem gerencia o servidor)
    // ---------------------------------------------

    if (
        id.startsWith("callp_cfg_") ||
        id.startsWith("callp_modal_cfg_")
    ) {
        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            await interaction.reply({
                content:
                    "❌ Você precisa da permissão **Gerenciar Servidor** para configurar a call personalizada.",
                flags: EPHEMERAL
            });

            return true;
        }

        const guild = interaction.guild;

        if (
            interaction.isChannelSelectMenu() &&
            id === "callp_cfg_categoria"
        ) {
            await salvarConfig(
                guild.id,
                {
                    categoria_id: interaction.values[0]
                }
            );

            return responderPainelConfig(
                interaction,
                "✅ Categoria definida!"
            );
        }

        if (
            interaction.isChannelSelectMenu() &&
            id === "callp_cfg_canal"
        ) {
            const atual =
                await carregarConfig(guild.id);

            const novo = interaction.values[0];

            await salvarConfig(
                guild.id,
                {
                    canal_id: novo,

                    // Trocou de canal: o painel antigo fica para trás
                    mensagem_id:
                        atual.canal_id === novo
                            ? atual.mensagem_id
                            : null
                }
            );

            return responderPainelConfig(
                interaction,
                "✅ Canal do painel definido! Clique em **Publicar / Atualizar painel**."
            );
        }

        if (interaction.isButton()) {
            const config =
                await carregarConfig(guild.id);

            if (id === "callp_cfg_embed") {
                await interaction.showModal(
                    criarModalEmbed(config)
                );

                return true;
            }

            if (id === "callp_cfg_imagens") {
                await interaction.showModal(
                    criarModalImagens(config)
                );

                return true;
            }

            if (
                id === "callp_cfg_emojis1" ||
                id === "callp_cfg_emojis2"
            ) {
                await interaction.showModal(
                    criarModalEmojis(
                        config,
                        id.replace("callp_cfg_", "")
                    )
                );

                return true;
            }

            if (id === "callp_cfg_resetar") {
                await salvarConfig(
                    guild.id,
                    Object.fromEntries(
                        Object.keys(BOTOES).map(
                            chave => [
                                `emoji_${chave}`,
                                null
                            ]
                        )
                    )
                );

                await atualizarPublicacao(guild);

                return responderPainelConfig(
                    interaction,
                    "✅ Emojis voltaram ao padrão!"
                );
            }

            if (id === "callp_cfg_publicar") {
                await publicarPainel(interaction);

                return true;
            }

            if (id === "callp_cfg_fechar") {
                await interaction.update({
                    content:
                        "🎙️ Painel de configuração fechado.",
                    embeds: [],
                    components: []
                });

                return true;
            }
        }

        if (interaction.isModalSubmit()) {
            const campo = nome =>
                interaction.fields
                    .getTextInputValue(nome)
                    .trim();

            const recusar = texto =>
                interaction
                    .reply({
                        content: texto,
                        flags: EPHEMERAL
                    })
                    .then(() => true);

            if (id === "callp_modal_cfg_embed") {
                const cor =
                    normalizarCor(campo("cor"));

                if (cor === null) {
                    return recusar(
                        "❌ Cor inválida. Use o formato #RRGGBB (ex.: #00A2FF)."
                    );
                }

                await salvarConfig(
                    guild.id,
                    {
                        embed_titulo: campo("titulo"),
                        embed_descricao: campo("descricao"),
                        embed_cor: cor,
                        embed_rodape: campo("rodape")
                    }
                );
            } else if (id === "callp_modal_cfg_imagens") {
                const thumbnail = campo("thumbnail");
                const imagem = campo("imagem");
                const icone = campo("rodape_icone");

                if (
                    (thumbnail && !urlValida(thumbnail)) ||
                    (imagem && !urlValida(imagem)) ||
                    (icone && !urlValida(icone))
                ) {
                    return recusar(
                        "❌ Os links precisam começar com http:// ou https://"
                    );
                }

                await salvarConfig(
                    guild.id,
                    {
                        embed_thumbnail: thumbnail,
                        embed_imagem: imagem,
                        embed_rodape_icone: icone
                    }
                );
            } else if (
                id === "callp_modal_cfg_emojis1" ||
                id === "callp_modal_cfg_emojis2"
            ) {
                const grupo =
                    id.replace("callp_modal_cfg_", "");

                const novos = {};

                for (const chave of GRUPOS_EMOJIS[grupo]) {
                    const emoji =
                        normalizarEmoji(campo(chave));

                    if (emoji === null) {
                        return recusar(
                            `❌ O emoji de "${BOTOES[chave].texto}" é inválido. Use um emoji normal (😀) ou o código completo de um emoji personalizado: <:nome:ID> (animado: <a:nome:ID>). Só :nome: não funciona. Para pegar o código, digite \\:nome: no chat e envie.`
                        );
                    }

                    // Igual ao padrão = não precisa guardar
                    novos[`emoji_${chave}`] =
                        emoji === BOTOES[chave].emoji
                            ? null
                            : emoji;
                }

                await salvarConfig(guild.id, novos);
            } else {
                return false;
            }

            await atualizarPublicacao(guild);

            return responderPainelConfig(
                interaction,
                "✅ Configuração salva!"
            );
        }

        return false;
    }

    // ---------------------------------------------
    // 🎙️ MEMBROS
    // ---------------------------------------------

    if (interaction.isButton()) {
        if (id === BOTOES.criar.id) {
            await criarCall(interaction);

            return true;
        }

        if (id === BOTOES.nome.id) {
            return pedirNome(interaction);
        }

        if (id === BOTOES.limite.id) {
            return pedirLimite(interaction);
        }

        if (id === BOTOES.privar.id) {
            return privarCall(interaction, true);
        }

        if (id === BOTOES.publica.id) {
            return privarCall(interaction, false);
        }

        if (id === BOTOES.adicionar.id) {
            return pedirMembros(interaction, "adicionar");
        }

        if (id === BOTOES.remover.id) {
            return pedirMembros(interaction, "remover");
        }
    }

    if (interaction.isModalSubmit()) {
        if (id === "callp_modal_nome") {
            return salvarNome(interaction);
        }

        if (id === "callp_modal_limite") {
            return salvarLimite(interaction);
        }
    }

    if (
        typeof interaction.isUserSelectMenu === "function" &&
        interaction.isUserSelectMenu()
    ) {
        if (id === "callp_sel_adicionar") {
            return aplicarMembros(interaction, "adicionar");
        }

        if (id === "callp_sel_remover") {
            return aplicarMembros(interaction, "remover");
        }
    }

    return false;
}

// =====================================================
// 🧹 LIMPEZA DAS CALLS VAZIAS
// =====================================================

async function limparCallsVazias(client) {
    try {
        await garantirTabelas();

        const [linhas] = await mysqlPool.query(
            "SELECT * FROM callp_canais"
        );

        for (const linha of linhas) {
            const canal =
                await client.channels
                    .fetch(linha.canal_id)
                    .catch(() => null);

            if (!canal) {
                await mysqlPool.query(
                    "DELETE FROM callp_canais WHERE canal_id = ?",
                    [linha.canal_id]
                );

                continue;
            }

            if (canal.members.size === 0) {
                await apagarCall(
                    client,
                    linha.canal_id
                );
            }
        }
    } catch (erro) {
        console.error(
            "❌ Erro ao limpar calls personalizadas:",
            erro
        );
    }
}

async function aoMudarVoz(oldState) {
    try {
        const canalId = oldState.channelId;

        if (!canalId) {
            return;
        }

        const canal = oldState.channel;

        if (!canal || canal.members.size > 0) {
            return;
        }

        await garantirTabelas();

        const [linhas] = await mysqlPool.query(
            "SELECT * FROM callp_canais WHERE canal_id = ?",
            [canalId]
        );

        if (!linhas[0]) {
            return;
        }

        await apagarCall(
            oldState.client,
            canalId
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao apagar call personalizada vazia:",
            erro
        );
    }
}

// Liga os botões, a limpeza e o apagar-quando-vazia ao bot.
// Chamado uma vez no index.js.
function iniciar(client) {
    client.on("interactionCreate", async interaction => {
        const id = interaction.customId || "";

        if (!id.startsWith("callp_")) {
            return;
        }

        try {
            await tratarInteracao(interaction);
        } catch (erro) {
            console.error(
                "❌ Erro na call personalizada:",
                erro
            );

            const resposta = {
                content:
                    "❌ Não consegui concluir essa ação. Verifique se o bot tem as permissões **Gerenciar Canais**, **Mover Membros** e **Conectar**.",
                flags: EPHEMERAL
            };

            try {
                if (
                    interaction.replied ||
                    interaction.deferred
                ) {
                    await interaction.followUp(resposta);
                } else {
                    await interaction.reply(resposta);
                }
            } catch {}
        }
    });

    client.on(
        "voiceStateUpdate",
        (oldState, newState) => {
            if (
                oldState.channelId &&
                oldState.channelId !== newState.channelId
            ) {
                aoMudarVoz(oldState);
            }
        }
    );

    const quandoPronto = () => limparCallsVazias(client);

    if (
        typeof client.isReady === "function" &&
        client.isReady()
    ) {
        quandoPronto();
    } else {
        client.once(
            Events?.ClientReady || "ready",
            quandoPronto
        );
    }
}

// =====================================================
// 💬 COMANDO /CRIARCALL
// =====================================================

const data =
    new SlashCommandBuilder()
        .setName("criarcall")
        .setDescription(
            "Sistema de calls personalizadas (temporárias)"
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
        .setDMPermission(false)
        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("config")
                    .setDescription(
                        "Configurar o painel de call personalizada"
                    )
        );

async function execute(interaction) {
    if (!interaction.guild) {
        return interaction.reply({
            content:
                "❌ Este comando só pode ser usado dentro de um servidor.",
            flags: EPHEMERAL
        });
    }

    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor**.",
            flags: EPHEMERAL
        });
    }

    const config =
        await carregarConfig(
            interaction.guild.id
        );

    return interaction.reply({
        ...criarPainelConfig(config),
        flags: EPHEMERAL
    });
}

module.exports = {
    data,
    execute,
    iniciar,
    tratarInteracao
};
