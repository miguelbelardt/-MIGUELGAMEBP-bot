const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const crypto = require("crypto");

// =====================================================
// 😀 EMOJIS DO REGISTRO
// =====================================================
// Emojis usados em vários comandos vêm de emojis.js (troque lá).
// Os outros ficam aqui: para trocar, coloque o código do emoji
// (use /emojiinfo) ou um emoji normal.

const emojis = require("../emojis.js");

const EMOJIS = {
    sucesso: emojis.sucesso,
    erro: emojis.erro
};

const {
    pool,
    getRegistroConfig,
    salvarRegistroConfig,
    salvarMensagemRegistro,
    criarRegistroPagina,
    getRegistroPagina,
    getRegistroPaginas,
    atualizarRegistroPagina,
    criarRegistroBotao,
    getRegistroBotoes,
    atualizarRegistroBotao,
    excluirRegistroBotao,
    usuarioJaRegistrado,
    registrarUsuario,
    mysqlPool
} = require("../database/database");

const MAX_PAGINAS = 6;
const MAX_BOTOES = 5;

const ESTILOS_BOTOES = {
    PRIMARY: ButtonStyle.Primary,
    SECONDARY: ButtonStyle.Secondary,
    SUCCESS: ButtonStyle.Success,
    DANGER: ButtonStyle.Danger
};

const EPHEMERAL = MessageFlags.Ephemeral;

// =====================================================
// 🎨 COR
// =====================================================

function converterCor(cor) {
    const valor = String(cor ?? "").trim();

    if (/^(#|0x)?[0-9a-f]{6}$/i.test(valor)) {
        return parseInt(
            valor.replace(/^(#|0x)/i, ""),
            16
        );
    }

    return 0x5865F2;
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

// =====================================================
// 💾 COLUNAS EXTRAS (cor, imagens, links)
// =====================================================

// O database.js não conhece essas colunas: o próprio registrar.js
// cria (se faltarem) e salva com UPDATE próprio.

const COLUNAS_EXTRAS = {
    registro_config: {
        painel_cor: "VARCHAR(20)",
        painel_titulo_url: "TEXT",
        modo_sequencia: "TINYINT(1) DEFAULT 0"
    },

    registro_paginas: {
        cor: "VARCHAR(20)",
        thumbnail: "TEXT",
        imagem: "TEXT",
        titulo_url: "TEXT",
        opcional: "TINYINT(1) DEFAULT 0"
    }
};

function sequenciaAtiva(config) {
    return Number(config?.modo_sequencia) === 1;
}

let promessaColunasExtras = null;

function garantirColunasExtrasRegistro() {
    if (!promessaColunasExtras) {
        promessaColunasExtras = (async () => {
            for (const [tabela, extras] of Object.entries(COLUNAS_EXTRAS)) {
                const [colunas] = await mysqlPool.query(
                    `SHOW COLUMNS FROM ${tabela}`
                );

                const existentes = colunas.map(
                    coluna => coluna.Field
                );

                for (const [coluna, definicao] of Object.entries(extras)) {
                    if (!existentes.includes(coluna)) {
                        await mysqlPool.query(
                            `ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`
                        );
                    }
                }
            }
        })().catch(erro => {
            promessaColunasExtras = null;

            console.error(
                "❌ Erro ao preparar colunas extras do registro:",
                erro
            );
        });
    }

    return promessaColunasExtras;
}

async function salvarExtrasRegistro(
    tabela,
    colunaChave,
    chave,
    extras
) {
    try {
        await garantirColunasExtrasRegistro();

        const permitidas =
            Object.keys(
                COLUNAS_EXTRAS[tabela] || {}
            );

        const colunas =
            Object.keys(extras).filter(
                coluna => permitidas.includes(coluna)
            );

        if (!colunas.length) {
            return;
        }

        await mysqlPool.query(
            `
            UPDATE ${tabela}
            SET ${colunas.map(coluna => `${coluna} = ?`).join(", ")}
            WHERE ${colunaChave} = ?
            `,
            [
                ...colunas.map(
                    coluna => extras[coluna] || null
                ),
                chave
            ]
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao salvar dados extras do registro:",
            erro
        );
    }
}

function tamanhoEmbed(embed) {
    const d = embed.data || {};

    return (
        (d.title || "").length +
        (d.description || "").length +
        (d.author?.name || "").length +
        (d.footer?.text || "").length +
        (d.fields || []).reduce(
            (total, campo) =>
                total +
                campo.name.length +
                campo.value.length,
            0
        )
    );
}

// Atualiza o painel NO LUGAR quando a interação vem de um botão,
// menu ou formulário aberto a partir do painel.
function responderPainel(interaction, payload) {
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
            typeof interaction.isChannelSelectMenu === "function" &&
            interaction.isChannelSelectMenu()
        ) ||
        (
            typeof interaction.isStringSelectMenu === "function" &&
            interaction.isStringSelectMenu()
        );

    if (doPainel) {
        return interaction.update(payload);
    }

    return interaction.reply({
        ...payload,
        flags: EPHEMERAL
    });
}

// =====================================================
// 🔐 PERMISSÃO
// =====================================================

function podeConfigurar(interaction) {
    return Boolean(
        interaction.guild &&
        interaction.memberPermissions &&
        interaction.memberPermissions.has(
            PermissionFlagsBits.ManageGuild
        )
    );
}

// =====================================================
// 🔐 SERVIDOR
// =====================================================

function pertenceAoServidor(interaction, guildId) {
    return Boolean(
        interaction.guild &&
        guildId &&
        String(interaction.guild.id) === String(guildId)
    );
}

// =====================================================
// 🔎 CONFIGURAÇÃO
// =====================================================

async function buscarConfiguracao(guildId) {
    return await getRegistroConfig(guildId);
}

// =====================================================
// 📄 PÁGINAS
// =====================================================

async function buscarPaginas(guildId) {
    const paginas = await getRegistroPaginas(guildId);

    return Array.isArray(paginas)
        ? paginas
        : [];
}

async function buscarPagina(guildId, numeroPagina) {
    const numero = Number(numeroPagina);

    if (!Number.isInteger(numero) || numero < 1) {
        return null;
    }

    return await getRegistroPagina(
        guildId,
        numero
    );
}

// =====================================================
// 🔘 BOTÕES
// =====================================================

async function buscarBotoes(paginaId) {
    const botoes = await getRegistroBotoes(paginaId);

    return Array.isArray(botoes)
        ? botoes
        : [];
}

// =====================================================
// 🆕 GARANTIR CONFIGURAÇÃO
// =====================================================

async function garantirConfiguracao(guildId) {
    let config = await buscarConfiguracao(guildId);

    if (!config) {
        await salvarRegistroConfig(
            guildId,
            null,
            null,
            1,
            false
        );

        config = await buscarConfiguracao(guildId);
    }

    if (!config) {
        throw new Error(
            "Não foi possível criar a configuração do sistema de registro."
        );
    }

    const paginas = await buscarPaginas(guildId);

    if (!paginas.length) {
        await criarRegistroPagina(
            guildId,
            1,
            {
                titulo: "Registro",
                descricao:
                    "Configure esta página do sistema de registro.",
                rodape: null,
                rodape_icone: null
            }
        );
    }

    return config;
}

// =====================================================
// 🧹 URL VÁLIDA
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

// =====================================================
// 🎨 EMBED DA PÁGINA
// =====================================================

function criarEmbedPagina(pagina) {
    const embed = new EmbedBuilder()
        .setColor(converterCor(pagina.cor));

    if (pagina.titulo) {
        embed.setTitle(
            String(pagina.titulo).substring(0, 256)
        );

        if (urlValida(pagina.titulo_url)) {
            embed.setURL(
                String(pagina.titulo_url).trim()
            );
        }
    }

    if (pagina.descricao) {
        embed.setDescription(
            String(pagina.descricao).substring(0, 4096)
        );
    }

    if (urlValida(pagina.thumbnail)) {
        embed.setThumbnail(
            String(pagina.thumbnail).trim()
        );
    }

    if (urlValida(pagina.imagem)) {
        embed.setImage(
            String(pagina.imagem).trim()
        );
    }

    if (pagina.rodape) {
        const textoRodape =
            String(pagina.rodape).substring(0, 2048);

        if (
            pagina.rodape_icone &&
            urlValida(pagina.rodape_icone)
        ) {
            embed.setFooter({
                text: textoRodape,
                iconURL: String(pagina.rodape_icone)
            });
        } else {
            embed.setFooter({
                text: textoRodape
            });
        }
    }

    // O Discord recusa embed totalmente vazio
    if (
        !pagina.titulo &&
        !pagina.descricao &&
        !urlValida(pagina.thumbnail) &&
        !urlValida(pagina.imagem) &&
        !pagina.rodape
    ) {
        embed.setDescription(
            "Esta página ainda não tem conteúdo."
        );
    }

    return embed;
}

// =====================================================
// 🎨 PAINEL INICIAL
// =====================================================

function criarEmbedPainelInicial(config) {
    const embed = new EmbedBuilder()
        .setColor(
            converterCor(config?.painel_cor)
        );

    const titulo =
        config?.painel_titulo ||
        "📝 Registro";

    const descricao =
        config?.painel_descricao ||
        "Clique no botão abaixo para começar seu registro.";

    embed.setTitle(
        String(titulo).substring(0, 256)
    );

    if (urlValida(config?.painel_titulo_url)) {
        embed.setURL(
            String(config.painel_titulo_url).trim()
        );
    }

    embed.setDescription(
        String(descricao).substring(0, 4096)
    );

    if (
        config?.painel_imagem &&
        urlValida(config.painel_imagem)
    ) {
        embed.setImage(
            String(config.painel_imagem)
        );
    }

    if (
        config?.painel_thumbnail &&
        urlValida(config.painel_thumbnail)
    ) {
        embed.setThumbnail(
            String(config.painel_thumbnail)
        );
    }

    if (config?.painel_rodape) {
        const rodape = {
            text: String(config.painel_rodape)
                .substring(0, 2048)
        };

        if (urlValida(config.painel_rodape_icone)) {
            rodape.iconURL =
                String(config.painel_rodape_icone).trim();
        }

        embed.setFooter(rodape);
    }

    return embed;
}

// =====================================================
// 🔘 BOTÃO DO PAINEL INICIAL
// =====================================================

function criarComponentesPainelInicial(
    guildId,
    config
) {
    const texto =
        config?.painel_botao_texto ||
        "Registrar";

    const botao =
        new ButtonBuilder()
            .setCustomId(
                `registro_iniciar_${guildId}`
            )
            .setLabel(
                String(texto).substring(0, 80)
            )
            .setEmoji("📝")
            .setStyle(ButtonStyle.Primary);

    return [
        new ActionRowBuilder()
            .addComponents(botao)
    ];
}

// =====================================================
// 🔘 COMPONENTES DA PÁGINA
// =====================================================

async function criarComponentesPagina(
    pagina,
    guildId,
    numeroPagina,
    opcoes = {}
) {
    const botoes = await buscarBotoes(pagina.id);

    const rows = [];

    let row = new ActionRowBuilder();

    for (
        const botao of botoes.slice(0, MAX_BOTOES)
    ) {
        const estilo =
            String(
                botao.estilo || "PRIMARY"
            ).toUpperCase();

        const button =
            new ButtonBuilder()
                .setCustomId(
                    botao.custom_id ||
                    `registro_botao_${botao.id}`
                )
                .setLabel(
                    String(
                        botao.texto || "Registrar"
                    ).substring(0, 80)
                )
                .setStyle(
                    ESTILOS_BOTOES[estilo] ||
                    ButtonStyle.Primary
                );

        if (botao.emoji) {
            try {
                button.setEmoji(
                    String(botao.emoji)
                );
            } catch {
                console.warn(
                    `⚠️ Emoji inválido no botão ${botao.id}.`
                );
            }
        }

        row.addComponents(button);

        if (row.components.length >= 5) {
            rows.push(row);
            row = new ActionRowBuilder();
        }
    }

    if (row.components.length > 0) {
        rows.push(row);
    }

    // Modo perguntas: sem Anterior/Próxima; pergunta opcional ganha "Pular"
    if (opcoes.sequencia) {
        if (opcoes.opcional) {
            const pular =
                new ButtonBuilder()
                    .setCustomId(
                        `registro_pular_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Pular")
                    .setEmoji("⏭️")
                    .setStyle(ButtonStyle.Secondary);

            const ultima =
                rows[rows.length - 1];

            if (
                ultima &&
                ultima.components.length < 5
            ) {
                ultima.addComponents(pular);
            } else {
                rows.push(
                    new ActionRowBuilder()
                        .addComponents(pular)
                );
            }
        }

        return rows;
    }

    const paginas = await buscarPaginas(guildId);

    if (paginas.length > 1) {
        const navegacao =
            new ActionRowBuilder();

        const paginaAtual =
            Number(numeroPagina);

        const anterior =
            new ButtonBuilder()
                .setCustomId(
                    `registro_pagina_${guildId}_${Math.max(
                        1,
                        paginaAtual - 1
                    )}`
                )
                .setLabel("Anterior")
                .setEmoji("◀️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(paginaAtual <= 1);

        const proxima =
            new ButtonBuilder()
                .setCustomId(
                    `registro_pagina_${guildId}_${Math.min(
                        paginas.length,
                        paginaAtual + 1
                    )}`
                )
                .setLabel("Próxima")
                .setEmoji("▶️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(
                    paginaAtual >= paginas.length
                );

        navegacao.addComponents(
            anterior,
            proxima
        );

        rows.push(navegacao);
    }

    return rows;
}

// =====================================================
// 📤 ATUALIZAR PAINEL PÚBLICO
// =====================================================

async function atualizarMensagemRegistro(
    guild,
    config
) {
    if (
        !config ||
        !config.canal_id ||
        !config.mensagem_id
    ) {
        return false;
    }

    try {
        const canal =
            await guild.channels.fetch(
                config.canal_id
            );

        if (
            !canal ||
            !canal.isTextBased()
        ) {
            return false;
        }

        const mensagem =
            await canal.messages.fetch(
                config.mensagem_id
            );

        const embed =
            criarEmbedPainelInicial(config);

        const components =
            criarComponentesPainelInicial(
                guild.id,
                config
            );

        await mensagem.edit({
            embeds: [embed],
            components
        });

        return true;
    } catch (erro) {
        console.error(
            "❌ Erro ao atualizar painel de registro:",
            erro
        );

        return false;
    }
}

// =====================================================
// 🔄 ATUALIZAR PUBLICAÇÃO
// =====================================================

async function atualizarPublicacaoSeExistir(
    interaction,
    guildId
) {
    const config =
        await buscarConfiguracao(guildId);

    if (
        !config ||
        !config.canal_id ||
        !config.mensagem_id
    ) {
        return false;
    }

    return await atualizarMensagemRegistro(
        interaction.guild,
        config
    );
}

// =====================================================
// 📝 PAINEL PRINCIPAL
// =====================================================

async function montarPainelPrincipal(
    guild,
    conteudo = ""
) {
    const guildId = guild.id;

    const config =
        await garantirConfiguracao(guildId);

    const paginas =
        await buscarPaginas(guildId);

    const configurado =
        Boolean(Number(config.configurado));

    const cargoPosRegistro =
        config.cargo_registro_id
            ? `<@&${config.cargo_registro_id}>`
            : "Nenhum";

    const embed =
        new EmbedBuilder()
            .setTitle("📝 Sistema de Registro")
            .setDescription(
                [
                    "Configure o sistema de registro do servidor.",
                    "",
                    `📄 Páginas: **${paginas.length}/${MAX_PAGINAS}**`,
                    `📢 Status: **${
                        configurado
                            ? "Publicado"
                            : "Não publicado"
                    }**`,
                    `📺 Canal: ${
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "Não definido"
                    }`,
                    `🎭 Cargo pós-registro: ${cargoPosRegistro}`,
                    "",
                    `🎨 Painel inicial: **${
                        config.painel_titulo
                            ? "Configurado"
                            : "Padrão"
                    }**`,
                    `❓ Perguntas em sequência: **${
                        sequenciaAtiva(config)
                            ? "Ligado (cada página é uma pergunta)"
                            : "Desligado (o 1º botão conclui o registro)"
                    }**`,
                    "",
                    "Acima está a prévia do painel inicial que os membros verão. Selecione uma página para editar."
                ].join("\n")
            )
            .setColor(
                configurado
                    ? 0x57F287
                    : 0x5865F2
            );

    // Soma de todos os embeds da mensagem: máx. 6000 caracteres
    const embedPrevia =
        criarEmbedPainelInicial(config);

    const previa =
        tamanhoEmbed(embedPrevia) <= 4000
            ? embedPrevia
            : null;

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `registro_selecionar_pagina_${guildId}`
            )
            .setPlaceholder("📄 Escolha uma página");

    for (const pagina of paginas) {
        menu.addOptions({
            label:
                `Página ${pagina.pagina}`,
            description:
                String(
                    pagina.titulo ||
                    "Sem título"
                ).substring(0, 100),
            value:
                String(pagina.pagina)
        });
    }

    const rowMenu =
        new ActionRowBuilder()
            .addComponents(menu);

    const rowBotoes =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_painel_inicial_${guildId}`
                    )
                    .setLabel("Painel inicial")
                    .setEmoji("🎨")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_aparencia_painel_${guildId}`
                    )
                    .setLabel("Aparência")
                    .setEmoji("✨")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_canal_${guildId}`
                    )
                    .setLabel("Canal")
                    .setEmoji("📺")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_botao_painel_${guildId}`
                    )
                    .setLabel("Botão")
                    .setEmoji("🔘")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_cargo_${guildId}`
                    )
                    .setLabel("Cargo")
                    .setEmoji("🎭")
                    .setStyle(ButtonStyle.Secondary)
            );

    const rowPaginas =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_adicionar_pagina_${guildId}`
                    )
                    .setLabel("Adicionar página")
                    .setEmoji("➕")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(
                        paginas.length >= MAX_PAGINAS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_publicar_${guildId}`
                    )
                    .setLabel("Publicar / Atualizar")
                    .setEmoji("📢")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_toggle_sequencia_${guildId}`
                    )
                    .setLabel(
                        `Perguntas: ${sequenciaAtiva(config) ? "ON" : "OFF"}`
                    )
                    .setEmoji("❓")
                    .setStyle(
                        sequenciaAtiva(config)
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
            );

    const rowExcluir =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_excluir_${guildId}`
                    )
                    .setLabel("Excluir configuração")
                    .setEmoji("🗑️")
                    .setStyle(ButtonStyle.Danger)
            );

    return {
        content: conteudo,
        embeds:
            previa
                ? [previa, embed]
                : [embed],
        components: [
            rowMenu,
            rowBotoes,
            rowPaginas,
            rowExcluir
        ]
    };
}

async function mostrarPainel(interaction) {
    await garantirColunasExtrasRegistro();

    await interaction.reply({
        ...(
            await montarPainelPrincipal(
                interaction.guild
            )
        ),
        flags: EPHEMERAL
    });
}

// =====================================================
// 🎨 MODAL PAINEL INICIAL
// =====================================================

async function abrirModalPainelInicial(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    if (!config) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Configuração não encontrada.`,
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_painel_inicial_${guildId}`
            )
            .setTitle("Painel inicial");

    const titulo =
        new TextInputBuilder()
            .setCustomId("painel_titulo")
            .setLabel("Título")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256);

    if (config.painel_titulo) {
        titulo.setValue(
            String(config.painel_titulo)
        );
    }

    const descricao =
        new TextInputBuilder()
            .setCustomId("painel_descricao")
            .setLabel("Descrição / explicação")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000);

    if (config.painel_descricao) {
        descricao.setValue(
            String(config.painel_descricao)
        );
    }

    const imagem =
        new TextInputBuilder()
            .setCustomId("painel_imagem")
            .setLabel("URL da imagem")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (config.painel_imagem) {
        imagem.setValue(
            String(config.painel_imagem)
        );
    }

    const thumbnail =
        new TextInputBuilder()
            .setCustomId("painel_thumbnail")
            .setLabel("URL da thumbnail")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (config.painel_thumbnail) {
        thumbnail.setValue(
            String(config.painel_thumbnail)
        );
    }

    const rodape =
        new TextInputBuilder()
            .setCustomId("painel_rodape")
            .setLabel("Rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (config.painel_rodape) {
        rodape.setValue(
            String(config.painel_rodape)
        );
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(titulo),
        new ActionRowBuilder().addComponents(descricao),
        new ActionRowBuilder().addComponents(imagem),
        new ActionRowBuilder().addComponents(thumbnail),
        new ActionRowBuilder().addComponents(rodape)
    );

    await interaction.showModal(modal);
}

// =====================================================
// ✨ MODAL APARÊNCIA DO PAINEL INICIAL
// =====================================================

async function abrirModalAparenciaPainel(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    const campo = (id, label, valor, placeholder) =>
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder(placeholder)
                .setValue(String(valor || ""))
                .setMaxLength(
                    id === "cor" ? 20 : 2048
                )
        );

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_aparencia_painel_${guildId}`
            )
            .setTitle("✨ Aparência do painel");

    modal.addComponents(
        campo("cor", "Cor (#5865F2)", config?.painel_cor, "#5865F2"),
        campo("titulo_url", "Link do título (clicável)", config?.painel_titulo_url, "https://..."),
        campo("rodape_icone", "Ícone do rodapé (link)", config?.painel_rodape_icone, "https://...")
    );

    await interaction.showModal(modal);
}

// =====================================================
// ✨ MODAL APARÊNCIA DA PÁGINA
// =====================================================

async function abrirModalAparenciaPagina(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Página não encontrada.`,
            flags: EPHEMERAL
        });
    }

    const campo = (id, label, valor, placeholder) =>
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder(placeholder)
                .setValue(String(valor || ""))
                .setMaxLength(
                    id === "cor" ? 20 : 2048
                )
        );

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_aparencia_pagina_${guildId}_${numeroPagina}`
            )
            .setTitle(
                `✨ Aparência — Página ${numeroPagina}`
            );

    modal.addComponents(
        campo("cor", "Cor (#5865F2)", pagina.cor, "#5865F2"),
        campo("thumbnail", "Thumbnail (link)", pagina.thumbnail, "https://..."),
        campo("imagem", "Imagem grande (link)", pagina.imagem, "https://..."),
        campo("titulo_url", "Link do título (clicável)", pagina.titulo_url, "https://...")
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🔘 MODAL TEXTO DO BOTÃO
// =====================================================

async function abrirModalTextoBotaoPainel(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_botao_painel_${guildId}`
            )
            .setTitle("Botão do painel");

    const texto =
        new TextInputBuilder()
            .setCustomId("painel_botao_texto")
            .setLabel("Texto do botão")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(80)
            .setValue(
                String(
                    config?.painel_botao_texto ||
                    "Registrar"
                )
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(texto)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🎭 MODAL CARGO PÓS-REGISTRO
// =====================================================

async function abrirModalCargoRegistro(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    if (!config) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Configuração não encontrada.`,
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_cargo_${guildId}`
            )
            .setTitle("🎭 Cargo pós-registro");

    const cargo =
        new TextInputBuilder()
            .setCustomId("cargo")
            .setLabel("ID do cargo")
            .setPlaceholder(
                "Deixe vazio para não dar nenhum cargo"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(30);

    if (config.cargo_registro_id) {
        cargo.setValue(
            String(config.cargo_registro_id)
        );
    }

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(cargo)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 📺 SELECIONAR CANAL
// =====================================================

async function mostrarSelecaoCanal(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    const embed =
        new EmbedBuilder()
            .setTitle(
                "📺 Canal do painel de registro"
            )
            .setDescription(
                [
                    "Selecione abaixo o canal onde o painel inicial será publicado.",
                    "",
                    `Canal atual: ${
                        config?.canal_id
                            ? `<#${config.canal_id}>`
                            : "Nenhum"
                    }`
                ].join("\n")
            )
            .setColor(0x5865F2);

    const menu =
        new ChannelSelectMenuBuilder()
            .setCustomId(
                `registro_selecionar_canal_${guildId}`
            )
            .setPlaceholder("📺 Escolha o canal")
            .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
            )
            .setMinValues(1)
            .setMaxValues(1);

    const row =
        new ActionRowBuilder()
            .addComponents(menu);

    await interaction.update({
        embeds: [embed],
        components: [row]
    });
}

// =====================================================
// 📄 CONFIGURAÇÃO DA PÁGINA
// =====================================================

async function mostrarConfiguracaoPagina(
    interaction,
    guildId,
    numeroPagina,
    conteudo = ""
) {
    if (!pertenceAoServidor(interaction, guildId)) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Essa página não existe.`,
            flags: EPHEMERAL
        });
    }

    const botoes =
        await buscarBotoes(pagina.id);

    const resumo = (texto, max = 80) => {
        const limpo =
            String(texto || "")
                .replace(/\s+/g, " ")
                .trim();

        if (!limpo) {
            return "Não definido";
        }

        return limpo.length > max
            ? `${limpo.slice(0, max - 1)}…`
            : limpo;
    };

    const definido = valor =>
        valor
            ? `${EMOJIS.sucesso} Definido`
            : `${EMOJIS.erro} Nenhum`;

    const embed =
        new EmbedBuilder()
            .setTitle(
                `📄 Configuração — Página ${numeroPagina}`
            )
            .setDescription(
                [
                    "Acima está a prévia da página como o membro vai ver.",
                    "",
                    `**Título:** ${resumo(pagina.titulo)}`,
                    `**Descrição:** ${resumo(pagina.descricao)}`,
                    `**Rodapé:** ${resumo(pagina.rodape)}`,
                    `**Cor:** ${pagina.cor || "Padrão"}`,
                    `**Thumbnail:** ${definido(pagina.thumbnail)}`,
                    `**Imagem:** ${definido(pagina.imagem)}`,
                    `**Link do título:** ${definido(pagina.titulo_url)}`,
                    `**Pergunta opcional (botão Pular):** ${
                        Number(pagina.opcional) === 1
                            ? "Sim"
                            : "Não"
                    }`,
                    "",
                    `🔘 Botões: **${botoes.length}/${MAX_BOTOES}**`
                ].join("\n")
            )
            .setColor(0x5865F2);

    const embedPrevia =
        criarEmbedPagina(pagina);

    // Soma de todos os embeds da mensagem: máx. 6000 caracteres
    const previa =
        tamanhoEmbed(embedPrevia) <= 4500
            ? embedPrevia
            : null;

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_editar_texto_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Título / Descrição")
                    .setEmoji("📝")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_editar_rodape_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Rodapé")
                    .setEmoji("🔻")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_aparencia_pagina_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Aparência")
                    .setEmoji("✨")
                    .setStyle(ButtonStyle.Primary)
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_adicionar_botao_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Adicionar botão")
                    .setEmoji("🔘")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(
                        botoes.length >= MAX_BOTOES
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_botoes_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Editar botões")
                    .setEmoji("⚙️")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `registro_toggle_opcional_${guildId}_${numeroPagina}`
                    )
                    .setLabel(
                        `Opcional: ${Number(pagina.opcional) === 1 ? "ON" : "OFF"}`
                    )
                    .setEmoji("⏭️")
                    .setStyle(
                        Number(pagina.opcional) === 1
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_voltar_${guildId}`
                    )
                    .setLabel("Voltar")
                    .setEmoji("◀️")
                    .setStyle(ButtonStyle.Secondary)
            );

    await responderPainel(
        interaction,
        {
            content: conteudo,
            embeds:
                previa
                    ? [previa, embed]
                    : [embed],
            components: [
                row1,
                row2,
                row3
            ]
        }
    );
}

// =====================================================
// 📝 MODAL TÍTULO / DESCRIÇÃO
// =====================================================

async function abrirModalTexto(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Página não encontrada.`,
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_texto_${guildId}_${numeroPagina}`
            )
            .setTitle(
                `Editar página ${numeroPagina}`
            );

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256);

    if (pagina.titulo) {
        titulo.setValue(
            String(pagina.titulo)
        );
    }

    const descricao =
        new TextInputBuilder()
            .setCustomId("descricao")
            .setLabel("Descrição")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000);

    if (pagina.descricao) {
        descricao.setValue(
            String(pagina.descricao)
        );
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(titulo),
        new ActionRowBuilder().addComponents(descricao)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🔻 MODAL RODAPÉ
// =====================================================

async function abrirModalRodape(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Página não encontrada.`,
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_rodape_${guildId}_${numeroPagina}`
            )
            .setTitle(
                `Rodapé — Página ${numeroPagina}`
            );

    const rodape =
        new TextInputBuilder()
            .setCustomId("rodape")
            .setLabel("Texto do rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (pagina.rodape) {
        rodape.setValue(
            String(pagina.rodape)
        );
    }

    const icone =
        new TextInputBuilder()
            .setCustomId("rodape_icone")
            .setLabel("URL do ícone do rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

    if (pagina.rodape_icone) {
        icone.setValue(
            String(pagina.rodape_icone)
        );
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(rodape),
        new ActionRowBuilder().addComponents(icone)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🔘 MODAL NOVO BOTÃO
// =====================================================

async function abrirModalBotao(
    interaction,
    guildId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Página não encontrada.`,
            flags: EPHEMERAL
        });
    }

    const botoes =
        await buscarBotoes(pagina.id);

    if (botoes.length >= MAX_BOTOES) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Cada página pode ter no máximo ${MAX_BOTOES} botões.`,
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_botao_${guildId}_${numeroPagina}`
            )
            .setTitle(
                `Novo botão — Página ${numeroPagina}`
            );

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto do botão")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(80);

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji (opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100);

    const cargo =
        new TextInputBuilder()
            .setCustomId("cargo")
            .setLabel("ID do cargo (opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(30);

    const estilo =
        new TextInputBuilder()
            .setCustomId("estilo")
            .setLabel(
                "PRIMARY / SECONDARY / SUCCESS / DANGER"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue("PRIMARY")
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder().addComponents(texto),
        new ActionRowBuilder().addComponents(emoji),
        new ActionRowBuilder().addComponents(cargo),
        new ActionRowBuilder().addComponents(estilo)
    );

    await interaction.showModal(modal);
}

// =====================================================
// ⚙️ PAINEL DE BOTÕES
// =====================================================

async function mostrarBotoes(
    interaction,
    guildId,
    numeroPagina,
    conteudo = ""
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Página não encontrada.`,
            flags: EPHEMERAL
        });
    }

    const botoes =
        await buscarBotoes(pagina.id);

    const embed =
        new EmbedBuilder()
            .setTitle(
                `🔘 Botões — Página ${numeroPagina}`
            )
            .setDescription(
                botoes.length
                    ? botoes
                        .map(
                            (botao, index) =>
                                [
                                    `**${index + 1}. ${botao.texto}**`,
                                    `🎭 Cargo: ${
                                        botao.cargo_id
                                            ? `<@&${botao.cargo_id}>`
                                            : "Nenhum"
                                    }`,
                                    `🎨 Estilo: ${
                                        botao.estilo ||
                                        "PRIMARY"
                                    }`
                                ].join("\n")
                        )
                        .join("\n\n")
                    : "Nenhum botão configurado."
            )
            .setColor(0x5865F2);

    const components = [];

    const linhaEditar =
        new ActionRowBuilder();

    for (
        const botao of botoes.slice(0, MAX_BOTOES)
    ) {
        linhaEditar.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `registro_editar_botao_${guildId}_${botao.id}_${numeroPagina}`
                )
                .setLabel(
                    `✏️ ${String(
                        botao.texto ||
                        "Botão"
                    ).substring(0, 70)}`
                )
                .setStyle(ButtonStyle.Primary)
        );
    }

    if (linhaEditar.components.length) {
        components.push(linhaEditar);
    }

    const linhaExcluir =
        new ActionRowBuilder();

    for (
        const botao of botoes.slice(0, MAX_BOTOES)
    ) {
        linhaExcluir.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `registro_excluir_botao_${guildId}_${botao.id}_${numeroPagina}`
                )
                .setLabel(
                    `🗑️ ${String(
                        botao.texto ||
                        "Botão"
                    ).substring(0, 70)}`
                )
                .setStyle(ButtonStyle.Danger)
        );
    }

    if (linhaExcluir.components.length) {
        components.push(linhaExcluir);
    }

    components.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `registro_voltar_pagina_${guildId}_${numeroPagina}`
                    )
                    .setLabel("Voltar")
                    .setEmoji("◀️")
                    .setStyle(ButtonStyle.Secondary)
            )
    );

    await responderPainel(
        interaction,
        {
            content: conteudo,
            embeds: [embed],
            components
        }
    );
}

// =====================================================
// ✏️ MODAL EDITAR BOTÃO
// =====================================================

async function abrirModalEditarBotao(
    interaction,
    guildId,
    botaoId,
    numeroPagina
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (!pagina) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Página não encontrada.`,
            flags: EPHEMERAL
        });
    }

    const botoes =
        await buscarBotoes(pagina.id);

    const botao =
        botoes.find(
            item =>
                String(item.id) ===
                String(botaoId)
        );

    if (!botao) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Esse botão não existe nesta página.`,
            flags: EPHEMERAL
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `registro_modal_editar_botao_${guildId}_${botaoId}_${numeroPagina}`
            )
            .setTitle("Editar botão");

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(80)
            .setValue(
                String(botao.texto || "")
            );

    const emoji =
        new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100);

    if (botao.emoji) {
        emoji.setValue(
            String(botao.emoji)
        );
    }

    const cargo =
        new TextInputBuilder()
            .setCustomId("cargo")
            .setLabel(
                "ID do cargo — deixe vazio para nenhum"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(30);

    if (botao.cargo_id) {
        cargo.setValue(
            String(botao.cargo_id)
        );
    }

    const estilo =
        new TextInputBuilder()
            .setCustomId("estilo")
            .setLabel(
                "PRIMARY / SECONDARY / SUCCESS / DANGER"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    botao.estilo ||
                    "PRIMARY"
                ).toUpperCase()
            )
            .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder().addComponents(texto),
        new ActionRowBuilder().addComponents(emoji),
        new ActionRowBuilder().addComponents(cargo),
        new ActionRowBuilder().addComponents(estilo)
    );

    await interaction.showModal(modal);
}

// =====================================================
// 🎭 VALIDAR CARGO
// =====================================================

function obterCargoConfigurado(
    interaction,
    cargoTexto
) {
    if (!cargoTexto) {
        return {
            id: null,
            erro: null
        };
    }

    const cargoId =
        String(cargoTexto).trim();

    if (!/^\d{15,25}$/.test(cargoId)) {
        return {
            id: null,
            erro:
                `${EMOJIS.erro} O ID do cargo informado é inválido.`
        };
    }

    const cargo =
        interaction.guild.roles.cache.get(
            cargoId
        );

    if (!cargo) {
        return {
            id: null,
            erro:
                `${EMOJIS.erro} Não encontrei esse cargo no servidor.`
        };
    }

    if (cargo.managed) {
        return {
            id: null,
            erro:
                `${EMOJIS.erro} Esse cargo é gerenciado por uma integração e não pode ser atribuído pelo bot.`
        };
    }

    return {
        id: cargo.id,
        erro: null
    };
}

// =====================================================
// 🎭 VALIDAR SE O BOT CONSEGUE DAR O CARGO
// =====================================================

function verificarCargoDoBot(
    interaction,
    cargo
) {
    if (!cargo) {
        return {
            sucesso: true,
            erro: null
        };
    }

    const botMember =
        interaction.guild.members.me;

    if (!botMember) {
        return {
            sucesso: false,
            erro:
                `${EMOJIS.erro} Não consegui verificar as permissões do bot.`
        };
    }

    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {
        return {
            sucesso: false,
            erro:
                `${EMOJIS.erro} Eu não tenho a permissão **Gerenciar Cargos**.`
        };
    }

    if (
        cargo.managed ||
        cargo.position >=
            botMember.roles.highest.position
    ) {
        return {
            sucesso: false,
            erro:
                `${EMOJIS.erro} Não consigo adicionar esse cargo porque ele está acima ou no mesmo nível do meu maior cargo.`
        };
    }

    return {
        sucesso: true,
        erro: null
    };
}

// =====================================================
// 📢 PUBLICAR
// =====================================================

async function publicarRegistro(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    let config =
        await buscarConfiguracao(guildId);

    if (!config) {
        config =
            await garantirConfiguracao(guildId);
    }

    if (!config.canal_id) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Primeiro selecione o canal onde o painel de registro será publicado.`,
            flags: EPHEMERAL
        });
    }

    const canal =
        await interaction.guild.channels
            .fetch(config.canal_id)
            .catch(() => null);

    if (
        !canal ||
        !canal.isTextBased()
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} O canal configurado não existe ou não é um canal de texto.`,
            flags: EPHEMERAL
        });
    }

    if (config.mensagem_id) {
        const atualizado =
            await atualizarMensagemRegistro(
                interaction.guild,
                config
            );

        if (atualizado) {
            await pool.query(
                `
                UPDATE registro_config
                SET configurado = TRUE,
                    atualizado_em = $1
                WHERE guild_id = $2
                `,
                [
                    Date.now(),
                    guildId
                ]
            );

            return atualizarPainelPrincipal(
                interaction,
                guildId,
                `${EMOJIS.sucesso} Painel de registro atualizado com sucesso!`
            );
        }
    }

    const embed =
        criarEmbedPainelInicial(config);

    const components =
        criarComponentesPainelInicial(
            guildId,
            config
        );

    const mensagem =
        await canal.send({
            embeds: [embed],
            components
        });

    const paginas =
        await buscarPaginas(guildId);

    await salvarRegistroConfig(
        guildId,
        canal.id,
        mensagem.id,
        Math.max(1, paginas.length),
        true
    );

    await salvarMensagemRegistro(
        guildId,
        mensagem.id
    );

    return atualizarPainelPrincipal(
        interaction,
        guildId,
        `${EMOJIS.sucesso} Painel de registro publicado em <#${canal.id}>!`
    );
}

// =====================================================
// 🆕 ADICIONAR PÁGINA
// =====================================================

async function adicionarPagina(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para configurar o registro.`,
            flags: EPHEMERAL
        });
    }

    await garantirConfiguracao(guildId);

    const paginas =
        await buscarPaginas(guildId);

    if (paginas.length >= MAX_PAGINAS) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} O limite máximo é de ${MAX_PAGINAS} páginas.`,
            flags: EPHEMERAL
        });
    }

    const numero =
        paginas.length + 1;

    await criarRegistroPagina(
        guildId,
        numero,
        {
            titulo: `Página ${numero}`,
            descricao: "Configure esta página.",
            rodape: null,
            rodape_icone: null
        }
    );

    await pool.query(
        `
        UPDATE registro_config
        SET paginas = $1,
            atualizado_em = $2
        WHERE guild_id = $3
        `,
        [
            numero,
            Date.now(),
            guildId
        ]
    );

    await atualizarPublicacaoSeExistir(
        interaction,
        guildId
    );

    return atualizarPainelPrincipal(
        interaction,
        guildId,
        `${EMOJIS.sucesso} Página ${numero} criada!`
    );
}

// =====================================================
// 🗑️ EXCLUIR CONFIGURAÇÃO
// =====================================================

async function mostrarConfirmacaoExclusao(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para excluir o registro.`,
            flags: EPHEMERAL
        });
    }

    const embed =
        new EmbedBuilder()
            .setTitle("🗑️ Excluir o sistema de registro?")
            .setDescription(
                [
                    "Isso apaga **todas as páginas, botões e o registro dos membros** deste servidor, e remove o painel publicado.",
                    "",
                    "**Essa ação não pode ser desfeita.**"
                ].join("\n")
            )
            .setColor(0xED4245);

    await interaction.update({
        content: "",
        embeds: [embed],
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `registro_confirmar_excluir_${guildId}`
                        )
                        .setLabel("Sim, excluir tudo")
                        .setEmoji("🗑️")
                        .setStyle(ButtonStyle.Danger),

                    new ButtonBuilder()
                        .setCustomId(
                            `registro_cancelar_excluir_${guildId}`
                        )
                        .setLabel("Cancelar")
                        .setEmoji("↩️")
                        .setStyle(ButtonStyle.Secondary)
                )
        ]
    });
}

async function excluirRegistro(
    interaction,
    guildId
) {
    if (
        !podeConfigurar(interaction) ||
        !pertenceAoServidor(interaction, guildId)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você não tem permissão para excluir o registro.`,
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    if (!config) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Nenhum sistema de registro encontrado.`,
            flags: EPHEMERAL
        });
    }

    if (
        config.canal_id &&
        config.mensagem_id
    ) {
        try {
            const canal =
                await interaction.guild.channels.fetch(
                    config.canal_id
                );

            if (
                canal &&
                canal.isTextBased()
            ) {
                const mensagem =
                    await canal.messages
                        .fetch(config.mensagem_id)
                        .catch(() => null);

                if (mensagem) {
                    await mensagem.delete()
                        .catch(() => {});
                }
            }
        } catch {}
    }

    await pool.query(
        `
        DELETE FROM registro_usuarios
        WHERE guild_id = $1
        `,
        [guildId]
    );

    await pool.query(
        `
        DELETE b
        FROM registro_botoes b
        INNER JOIN registro_paginas p
            ON p.id = b.pagina_id
        WHERE p.guild_id = $1
        `,
        [guildId]
    );

    await pool.query(
        `
        DELETE FROM registro_paginas
        WHERE guild_id = $1
        `,
        [guildId]
    );

    await pool.query(
        `
        DELETE FROM registro_config
        WHERE guild_id = $1
        `,
        [guildId]
    );

    enviarLog(
        interaction,
        "registro_excluido",
        new EmbedBuilder()
            .setTitle("🗑️ Registro excluído")
            .setDescription(
                `${interaction.user} excluiu o sistema de registro do servidor.`
            )
            .addFields({
                name: "👤 Excluído por",
                value: `${interaction.user.tag}\n\`${interaction.user.id}\``
            })
            .setColor(0xED4245)
            .setTimestamp()
    );

    await interaction.update({
        content:
            "🗑️ Sistema de registro excluído com sucesso. Use `/registrar` para criar de novo.",
        embeds: [],
        components: []
    });
}

// =====================================================
// 📝 INICIAR REGISTRO PRIVADO
// =====================================================

async function iniciarRegistroPrivado(
    interaction,
    guildId
) {
    if (!pertenceAoServidor(interaction, guildId)) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Esse registro não pertence a este servidor.`,
            flags: EPHEMERAL
        });
    }

    const jaRegistrado =
        await usuarioJaRegistrado(
            interaction.guild.id,
            interaction.user.id
        );

    if (jaRegistrado) {
        return interaction.reply({
            content:
                "ℹ️ Você já fez este registro.",
            flags: EPHEMERAL
        });
    }

    const paginas =
        await buscarPaginas(guildId);

    if (!paginas.length) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Nenhuma página de registro foi configurada.`,
            flags: EPHEMERAL
        });
    }

    const pagina =
        await buscarPagina(guildId, 1);

    if (!pagina) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} A primeira página do registro não existe.`,
            flags: EPHEMERAL
        });
    }

    const configRegistro =
        await buscarConfiguracao(guildId);

    if (sequenciaAtiva(configRegistro)) {
        return interaction.reply({
            ...(
                await montarPaginaSequencia(
                    guildId,
                    pagina,
                    paginas.length,
                    1
                )
            ),
            flags: EPHEMERAL
        });
    }

    const embed =
        criarEmbedPagina(pagina);

    const components =
        await criarComponentesPagina(
            pagina,
            guildId,
            1
        );

    await interaction.reply({
        embeds: [embed],
        components,
        flags: EPHEMERAL
    });
}

// =====================================================
// ❓ MODO PERGUNTAS EM SEQUÊNCIA
// =====================================================

async function montarPaginaSequencia(
    guildId,
    pagina,
    total,
    posicao
) {
    const opcional =
        Number(pagina.opcional) === 1;

    return {
        content:
            `📝 Pergunta ${posicao} de ${total}${opcional ? " (opcional)" : ""}`,
        embeds: [
            criarEmbedPagina(pagina)
        ],
        components:
            await criarComponentesPagina(
                pagina,
                guildId,
                pagina.pagina,
                {
                    sequencia: true,
                    opcional
                }
            )
    };
}

// Vai para a próxima pergunta ou, se acabaram, conclui o registro
async function avancarSequencia(
    interaction,
    membro,
    config,
    numeroAtual,
    botaoRespondido
) {
    const guildId =
        interaction.guild.id;

    const paginas =
        await buscarPaginas(guildId);

    const indiceProxima =
        paginas.findIndex(
            pagina =>
                Number(pagina.pagina) >
                Number(numeroAtual)
        );

    if (indiceProxima !== -1) {
        return interaction.update(
            await montarPaginaSequencia(
                guildId,
                paginas[indiceProxima],
                paginas.length,
                indiceProxima + 1
            )
        );
    }

    return finalizarRegistroSequencia(
        interaction,
        membro,
        config,
        numeroAtual,
        botaoRespondido,
        paginas
    );
}

async function processarRespostaSequencia(
    interaction,
    botao,
    config
) {
    let cargoBotao = null;

    if (botao.cargo_id) {
        cargoBotao =
            interaction.guild.roles.cache.get(
                String(botao.cargo_id)
            );

        if (!cargoBotao) {
            return interaction.reply({
                content:
                    `${EMOJIS.erro} O cargo configurado para este botão não existe mais.`,
                flags: EPHEMERAL
            });
        }

        const verificacao =
            verificarCargoDoBot(
                interaction,
                cargoBotao
            );

        if (!verificacao.sucesso) {
            return interaction.reply({
                content:
                    verificacao.erro,
                flags: EPHEMERAL
            });
        }
    }

    const membro =
        await interaction.guild.members.fetch(
            interaction.user.id
        );

    // Uma resposta por pergunta: tira os cargos das outras respostas
    // desta mesma pergunta (caso o membro esteja refazendo).
    const botoesPagina =
        await buscarBotoes(botao.pagina_id);

    for (const outro of botoesPagina) {
        if (
            !outro.cargo_id ||
            String(outro.cargo_id) === String(botao.cargo_id)
        ) {
            continue;
        }

        if (
            membro.roles.cache.has(
                String(outro.cargo_id)
            )
        ) {
            await membro.roles
                .remove(String(outro.cargo_id))
                .catch(() => {});
        }
    }

    if (cargoBotao) {
        try {
            await membro.roles.add(cargoBotao);
        } catch (erro) {
            console.error(
                "❌ Erro ao dar cargo da resposta:",
                erro
            );

            return interaction.reply({
                content:
                    `${EMOJIS.erro} Não consegui adicionar o cargo configurado para esta resposta.`,
                flags: EPHEMERAL
            });
        }
    }

    return avancarSequencia(
        interaction,
        membro,
        config,
        botao.pagina,
        botao
    );
}

async function pularPergunta(
    interaction,
    guildId,
    numeroPagina
) {
    if (!pertenceAoServidor(interaction, guildId)) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Esse registro não pertence a este servidor.`,
            flags: EPHEMERAL
        });
    }

    const jaRegistrado =
        await usuarioJaRegistrado(
            guildId,
            interaction.user.id
        );

    if (jaRegistrado) {
        return interaction.reply({
            content:
                "ℹ️ Você já fez este registro.",
            flags: EPHEMERAL
        });
    }

    const config =
        await buscarConfiguracao(guildId);

    const pagina =
        await buscarPagina(
            guildId,
            numeroPagina
        );

    if (
        !sequenciaAtiva(config) ||
        !pagina ||
        Number(pagina.opcional) !== 1
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Essa pergunta não pode ser pulada.`,
            flags: EPHEMERAL
        });
    }

    const membro =
        await interaction.guild.members.fetch(
            interaction.user.id
        );

    return avancarSequencia(
        interaction,
        membro,
        config,
        numeroPagina,
        null
    );
}

async function finalizarRegistroSequencia(
    interaction,
    membro,
    config,
    numeroPagina,
    botaoRespondido,
    paginas
) {
    const guildId =
        interaction.guild.id;

    // =================================================
    // 🎭 CARGO PÓS-REGISTRO GLOBAL
    // =================================================

    let cargoPosRegistro = null;

    if (config?.cargo_registro_id) {
        cargoPosRegistro =
            interaction.guild.roles.cache.get(
                String(config.cargo_registro_id)
            );

        if (!cargoPosRegistro) {
            return interaction.reply({
                content:
                    `${EMOJIS.erro} O cargo pós-registro configurado não existe mais. Um administrador precisa corrigir a configuração do registro.`,
                flags: EPHEMERAL
            });
        }

        const verificacao =
            verificarCargoDoBot(
                interaction,
                cargoPosRegistro
            );

        if (!verificacao.sucesso) {
            return interaction.reply({
                content:
                    `${EMOJIS.erro} Não consigo adicionar o cargo pós-registro configurado.\n\n${verificacao.erro}`,
                flags: EPHEMERAL
            });
        }

        try {
            await membro.roles.add(cargoPosRegistro);
        } catch (erro) {
            console.error(
                "❌ Erro ao dar cargo pós-registro:",
                erro
            );

            return interaction.reply({
                content:
                    `${EMOJIS.erro} Não consegui adicionar o cargo pós-registro configurado.`,
                flags: EPHEMERAL
            });
        }
    }

    // =================================================
    // 💾 SALVAR REGISTRO (só agora, no fim)
    // =================================================

    const paginaFinal =
        paginas.find(
            pagina =>
                Number(pagina.pagina) ===
                Number(numeroPagina)
        );

    try {
        await registrarUsuario(
            guildId,
            interaction.user.id,
            paginaFinal?.id ?? null,
            botaoRespondido?.id ?? null,
            cargoPosRegistro?.id ??
                botaoRespondido?.cargo_id ??
                null
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao salvar usuário registrado:",
            erro
        );

        const agoraRegistrado =
            await usuarioJaRegistrado(
                guildId,
                interaction.user.id
            ).catch(() => false);

        return interaction.reply({
            content:
                agoraRegistrado
                    ? "ℹ️ Você já fez este registro."
                    : `${EMOJIS.erro} Ocorreu um erro ao salvar seu registro.`,
            flags: EPHEMERAL
        });
    }

    // =================================================
    // ✅ MENSAGEM FINAL (cargos ganhos nas respostas)
    // =================================================

    const cargos = new Set();

    for (const pagina of paginas) {
        if (
            Number(pagina.pagina) ===
            Number(numeroPagina)
        ) {
            continue;
        }

        const botoes =
            await buscarBotoes(pagina.id);

        for (const botao of botoes) {
            if (
                botao.cargo_id &&
                membro.roles.cache.has(
                    String(botao.cargo_id)
                )
            ) {
                cargos.add(String(botao.cargo_id));
            }
        }
    }

    if (botaoRespondido?.cargo_id) {
        cargos.add(String(botaoRespondido.cargo_id));
    }

    if (cargoPosRegistro) {
        cargos.add(String(cargoPosRegistro.id));
    }

    const lista =
        [...cargos]
            .map(id => `<@&${id}>`)
            .join(", ");

    enviarLog(
        interaction,
        "registro_concluido",
        embedRegistroConcluido(
            interaction.user,
            [...cargos].map(id => `<@&${id}>`)
        )
    );

    return interaction.update({
        content:
            lista
                ? `${EMOJIS.sucesso} Registro concluído com sucesso!\n\n🎭 Seus cargos: ${lista}`
                : `${EMOJIS.sucesso} Registro concluído com sucesso!`,
        embeds: [],
        components: []
    });
}

// =====================================================
// 📋 ENVIAR LOG (sistema /logs)
// =====================================================
// Nunca deixa o log atrapalhar o registro: qualquer erro aqui
// só aparece no console.

async function enviarLog(
    interaction,
    tipo,
    embed
) {
    try {
        if (
            interaction.guild &&
            typeof interaction.client.registrarLog === "function"
        ) {
            await interaction.client.registrarLog(
                interaction.guild,
                tipo,
                embed
            );
        }

    } catch (erro) {
        console.error(
            `❌ Erro ao enviar log de registro (${tipo}):`,
            erro
        );
    }
}

function embedRegistroConcluido(
    usuario,
    cargos
) {
    return new EmbedBuilder()
        .setTitle(`${EMOJIS.sucesso} Registro concluído`)
        .setDescription(
            `${usuario} concluiu o registro.`
        )
        .addFields(
            {
                name: "👤 Membro",
                value: `${usuario.tag}\n\`${usuario.id}\``,
                inline: true
            },
            {
                name: "🎭 Cargos recebidos",
                value:
                    cargos.length > 0
                        ? cargos.join(", ").slice(0, 1024)
                        : "Nenhum",
                inline: true
            }
        )
        .setThumbnail(
            usuario.displayAvatarURL({
                size: 256
            })
        )
        .setColor(0x57F287)
        .setTimestamp();
}

// =====================================================
// 🎯 PROCESSAR BOTÃO DE REGISTRO
// =====================================================

async function processarBotaoRegistro(
    interaction
) {
    const customId =
        interaction.customId;

    const resultado =
        await pool.query(
            `
            SELECT
                b.*,
                p.guild_id,
                p.pagina,
                p.id AS pagina_id
            FROM registro_botoes b
            INNER JOIN registro_paginas p
                ON p.id = b.pagina_id
            WHERE b.custom_id = $1
            LIMIT 1
            `,
            [customId]
        );

    const botao =
        resultado.rows &&
        resultado.rows[0];

    if (!botao) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Esse botão não está mais disponível.`,
            flags: EPHEMERAL
        });
    }

    if (
        String(botao.guild_id) !==
        String(interaction.guild.id)
    ) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Esse botão não pertence a este servidor.`,
            flags: EPHEMERAL
        });
    }

    const jaRegistrado =
        await usuarioJaRegistrado(
            interaction.guild.id,
            interaction.user.id
        );

    if (jaRegistrado) {
        return interaction.reply({
            content:
                "ℹ️ Você já fez este registro.",
            flags: EPHEMERAL
        });
    }

    const configSequencia =
        await buscarConfiguracao(
            interaction.guild.id
        );

    if (sequenciaAtiva(configSequencia)) {
        return processarRespostaSequencia(
            interaction,
            botao,
            configSequencia
        );
    }

    // =================================================
    // 🎭 CARGO DO BOTÃO
    // =================================================

    let cargoBotao = null;
    let cargoBotaoRecebido = false;

    if (botao.cargo_id) {
        cargoBotao =
            interaction.guild.roles.cache.get(
                String(botao.cargo_id)
            );

        if (!cargoBotao) {
            return interaction.reply({
                content:
                    `${EMOJIS.erro} O cargo configurado para este botão não existe mais.`,
                flags: EPHEMERAL
            });
        }

        const verificacao =
            verificarCargoDoBot(
                interaction,
                cargoBotao
            );

        if (!verificacao.sucesso) {
            return interaction.reply({
                content:
                    verificacao.erro,
                flags: EPHEMERAL
            });
        }
    }

    // =================================================
    // 🎭 CARGO PÓS-REGISTRO GLOBAL
    // =================================================

    const configRegistro =
        await buscarConfiguracao(
            interaction.guild.id
        );

    let cargoPosRegistro = null;

    if (
        configRegistro &&
        configRegistro.cargo_registro_id
    ) {
        cargoPosRegistro =
            interaction.guild.roles.cache.get(
                String(
                    configRegistro.cargo_registro_id
                )
            );

        if (!cargoPosRegistro) {
            console.error(
                `${EMOJIS.erro} O cargo pós-registro configurado (${configRegistro.cargo_registro_id}) não existe mais.`
            );

            return interaction.reply({
                content:
                    `${EMOJIS.erro} O cargo pós-registro configurado não existe mais. Um administrador precisa corrigir a configuração do registro.`,
                flags: EPHEMERAL
            });
        }

        const verificacao =
            verificarCargoDoBot(
                interaction,
                cargoPosRegistro
            );

        if (!verificacao.sucesso) {
            return interaction.reply({
                content:
                    `${EMOJIS.erro} Não consigo adicionar o cargo pós-registro configurado.\n\n${verificacao.erro}`,
                flags: EPHEMERAL
            });
        }
    }

    const membro =
        await interaction.guild.members.fetch(
            interaction.user.id
        );

    // =================================================
    // 🎭 DAR CARGO DO BOTÃO
    // =================================================

    if (cargoBotao) {
        try {
            await membro.roles.add(
                cargoBotao
            );

            cargoBotaoRecebido = true;
        } catch (erro) {
            console.error(
                "❌ Erro ao dar cargo do botão de registro:",
                erro
            );

            return interaction.reply({
                content:
                    `${EMOJIS.erro} Não consegui adicionar o cargo configurado para este botão.`,
                flags: EPHEMERAL
            });
        }
    }

    // =================================================
    // 🎭 DAR CARGO PÓS-REGISTRO
    // =================================================

    let cargoPosRegistroRecebido = false;

    if (cargoPosRegistro) {
        try {
            await membro.roles.add(
                cargoPosRegistro
            );

            cargoPosRegistroRecebido = true;
        } catch (erro) {
            console.error(
                "❌ Erro ao dar cargo pós-registro:",
                erro
            );

            return interaction.reply({
                content:
                    `${EMOJIS.erro} Não consegui adicionar o cargo pós-registro configurado.`,
                flags: EPHEMERAL
            });
        }
    }

    // =================================================
    // 💾 SALVAR REGISTRO
    // =================================================

    // Mantém o cargo do botão como o cargo principal salvo.
    // Se não houver cargo no botão, salva o cargo pós-registro.
    const cargoRecebido =
        cargoBotaoRecebido && cargoBotao
            ? cargoBotao.id
            : cargoPosRegistroRecebido &&
              cargoPosRegistro
                ? cargoPosRegistro.id
                : null;

    try {
        await registrarUsuario(
            interaction.guild.id,
            interaction.user.id,
            botao.pagina_id,
            botao.id,
            cargoRecebido
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao salvar usuário registrado:",
            erro
        );

        const agoraRegistrado =
            await usuarioJaRegistrado(
                interaction.guild.id,
                interaction.user.id
            ).catch(() => false);

        if (agoraRegistrado) {
            return interaction.reply({
                content:
                    "ℹ️ Você já fez este registro.",
                flags: EPHEMERAL
            });
        }

        return interaction.reply({
            content:
                `${EMOJIS.erro} Ocorreu um erro ao salvar seu registro.`,
            flags: EPHEMERAL
        });
    }

    // =================================================
    // ✅ MENSAGEM FINAL
    // =================================================

    const cargosRecebidos = [];

    if (
        cargoBotaoRecebido &&
        cargoBotao
    ) {
        cargosRecebidos.push(
            `<@&${cargoBotao.id}>`
        );
    }

    if (
        cargoPosRegistroRecebido &&
        cargoPosRegistro
    ) {
        cargosRecebidos.push(
            `<@&${cargoPosRegistro.id}>`
        );
    }

    enviarLog(
        interaction,
        "registro_concluido",
        embedRegistroConcluido(
            interaction.user,
            cargosRecebidos
        )
    );

    // Troca a página (com os botões) pela confirmação:
    // o membro não fica com botões velhos na tela.
    return interaction.update({
        content:
            cargosRecebidos.length > 0
                ? `${EMOJIS.sucesso} Registro concluído com sucesso!\n\n🎭 Cargos recebidos: ${cargosRecebidos.join(", ")}`
                : `${EMOJIS.sucesso} Registro concluído com sucesso!`,
        embeds: [],
        components: []
    });
}

// =====================================================
// 🧰 PAINEL PRINCIPAL
// =====================================================

async function atualizarPainelPrincipal(
    interaction,
    guildId,
    conteudo = ""
) {
    return responderPainel(
        interaction,
        await montarPainelPrincipal(
            interaction.guild,
            conteudo
        )
    );
}

// =====================================================
// 🖱️ INTERAÇÕES
// =====================================================

async function handleInteraction(interaction) {
    try {
        if (!interaction.guild) {
            return false;
        }

        const customId =
            interaction.customId || "";

        // =================================================
        // 📝 INICIAR REGISTRO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_iniciar_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_iniciar_",
                    ""
                );

            return await iniciarRegistroPrivado(
                interaction,
                guildId
            );
        }

        // =================================================
        // ⏭️ PULAR PERGUNTA OPCIONAL
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_pular_"
            )
        ) {
            const partes =
                customId.split("_");

            return await pularPergunta(
                interaction,
                partes[2],
                Number(partes[3])
            );
        }

        // =================================================
        // 🔘 BOTÃO DE REGISTRO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_botao_"
            ) &&
            !customId.startsWith(
                "registro_botao_painel_"
            )
        ) {
            return await processarBotaoRegistro(
                interaction
            );
        }

        // =================================================
        // 📄 NAVEGAÇÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_pagina_"
            )
        ) {
            const partes =
                customId.split("_");

            if (partes.length < 4) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Botão de navegação inválido.`,
                    flags: EPHEMERAL
                });
            }

            const guildId =
                partes[2];

            const numeroPagina =
                Number(partes[3]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const paginas =
                await buscarPaginas(guildId);

            if (!paginas.length) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Nenhuma página encontrada.`,
                    flags: EPHEMERAL
                });
            }

            const paginaSegura =
                Math.max(
                    1,
                    Math.min(
                        paginas.length,
                        numeroPagina
                    )
                );

            const pagina =
                await buscarPagina(
                    guildId,
                    paginaSegura
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Página não encontrada.`,
                    flags: EPHEMERAL
                });
            }

            const embed =
                criarEmbedPagina(pagina);

            const components =
                await criarComponentesPagina(
                    pagina,
                    guildId,
                    paginaSegura
                );

            return interaction.update({
                embeds: [embed],
                components
            });
        }

        // =================================================
        // 🔐 ADMINISTRATIVOS
        // =================================================

        const idsAdministrativos = [
            "registro_painel_inicial_",
            "registro_botao_painel_",
            "registro_canal_",
            "registro_cargo_",
            "registro_selecionar_canal_",
            "registro_modal_painel_inicial_",
            "registro_modal_botao_painel_",
            "registro_modal_cargo_",
            "registro_adicionar_pagina_",
            "registro_publicar_",
            "registro_excluir_",
            "registro_selecionar_pagina_",
            "registro_editar_texto_",
            "registro_editar_rodape_",
            "registro_adicionar_botao_",
            "registro_botoes_",
            "registro_editar_botao_",
            "registro_excluir_botao_",
            "registro_voltar_",
            "registro_modal_texto_",
            "registro_modal_rodape_",
            "registro_modal_botao_",
            "registro_modal_editar_botao_",
            "registro_aparencia_painel_",
            "registro_aparencia_pagina_",
            "registro_modal_aparencia_painel_",
            "registro_modal_aparencia_pagina_",
            "registro_confirmar_excluir_",
            "registro_cancelar_excluir_",
            "registro_toggle_sequencia_",
            "registro_toggle_opcional_"
        ];

        const ehAdministrativo =
            idsAdministrativos.some(
                prefixo =>
                    customId.startsWith(prefixo)
            );

        if (
            ehAdministrativo &&
            !podeConfigurar(interaction)
        ) {
            return interaction.reply({
                content:
                    `${EMOJIS.erro} Você precisa da permissão **Gerenciar Servidor** para configurar o sistema de registro.`,
                flags: EPHEMERAL
            });
        }

        if (ehAdministrativo) {
            await garantirColunasExtrasRegistro();
        }

        // =================================================
        // ❓ LIGAR / DESLIGAR PERGUNTAS EM SEQUÊNCIA
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_toggle_sequencia_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_toggle_sequencia_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const config =
                await buscarConfiguracao(guildId);

            const novo =
                !sequenciaAtiva(config);

            await salvarExtrasRegistro(
                "registro_config",
                "guild_id",
                guildId,
                {
                    modo_sequencia:
                        novo
                            ? 1
                            : 0
                }
            );

            return await atualizarPainelPrincipal(
                interaction,
                guildId,
                novo
                    ? `${EMOJIS.sucesso} Perguntas em sequência **ligado**: cada página é uma pergunta e responder avança para a próxima.`
                    : `${EMOJIS.sucesso} Perguntas em sequência **desligado**: o primeiro botão clicado conclui o registro.`
            );
        }

        // =================================================
        // ⏭️ PERGUNTA OPCIONAL (liga / desliga "Pular")
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_toggle_opcional_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(partes[4]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Página não encontrada.`,
                    flags: EPHEMERAL
                });
            }

            const novo =
                Number(pagina.opcional) !== 1;

            await salvarExtrasRegistro(
                "registro_paginas",
                "id",
                pagina.id,
                {
                    opcional:
                        novo
                            ? 1
                            : 0
                }
            );

            return await mostrarConfiguracaoPagina(
                interaction,
                guildId,
                numeroPagina,
                novo
                    ? `${EMOJIS.sucesso} Pergunta **opcional**: o membro verá o botão Pular.`
                    : `${EMOJIS.sucesso} Pergunta **obrigatória**: o membro precisa responder.`
            );
        }

        // =================================================
        // ✨ APARÊNCIA (abrir formulários)
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_aparencia_painel_"
            )
        ) {
            return await abrirModalAparenciaPainel(
                interaction,
                customId.replace(
                    "registro_aparencia_painel_",
                    ""
                )
            );
        }

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_aparencia_pagina_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalAparenciaPagina(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // ✨ APARÊNCIA DO PAINEL (salvar)
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_aparencia_painel_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_modal_aparencia_painel_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const cor =
                normalizarCor(
                    interaction.fields
                        .getTextInputValue("cor")
                );

            const tituloUrl =
                interaction.fields
                    .getTextInputValue("titulo_url")
                    .trim();

            const rodapeIcone =
                interaction.fields
                    .getTextInputValue("rodape_icone")
                    .trim();

            if (cor === null) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Cor inválida. Use o formato #RRGGBB (ex.: #5865F2).`,
                    flags: EPHEMERAL
                });
            }

            if (
                (tituloUrl && !urlValida(tituloUrl)) ||
                (rodapeIcone && !urlValida(rodapeIcone))
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Os links precisam começar com http:// ou https://`,
                    flags: EPHEMERAL
                });
            }

            await pool.query(
                `
                UPDATE registro_config
                SET painel_rodape_icone = $1,
                    atualizado_em = $2
                WHERE guild_id = $3
                `,
                [
                    rodapeIcone || null,
                    Date.now(),
                    guildId
                ]
            );

            await salvarExtrasRegistro(
                "registro_config",
                "guild_id",
                guildId,
                {
                    painel_cor: cor,
                    painel_titulo_url: tituloUrl
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            return await atualizarPainelPrincipal(
                interaction,
                guildId,
                `${EMOJIS.sucesso} Aparência do painel atualizada!`
            );
        }

        // =================================================
        // ✨ APARÊNCIA DA PÁGINA (salvar)
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_aparencia_pagina_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[4];

            const numeroPagina =
                Number(partes[5]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Página não encontrada.`,
                    flags: EPHEMERAL
                });
            }

            const cor =
                normalizarCor(
                    interaction.fields
                        .getTextInputValue("cor")
                );

            const thumbnail =
                interaction.fields
                    .getTextInputValue("thumbnail")
                    .trim();

            const imagem =
                interaction.fields
                    .getTextInputValue("imagem")
                    .trim();

            const tituloUrl =
                interaction.fields
                    .getTextInputValue("titulo_url")
                    .trim();

            if (cor === null) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Cor inválida. Use o formato #RRGGBB (ex.: #5865F2).`,
                    flags: EPHEMERAL
                });
            }

            if (
                (thumbnail && !urlValida(thumbnail)) ||
                (imagem && !urlValida(imagem)) ||
                (tituloUrl && !urlValida(tituloUrl))
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Os links precisam começar com http:// ou https://`,
                    flags: EPHEMERAL
                });
            }

            await salvarExtrasRegistro(
                "registro_paginas",
                "id",
                pagina.id,
                {
                    cor,
                    thumbnail,
                    imagem,
                    titulo_url: tituloUrl
                }
            );

            return await mostrarConfiguracaoPagina(
                interaction,
                guildId,
                numeroPagina,
                `${EMOJIS.sucesso} Aparência da página atualizada!`
            );
        }

        // =================================================
        // 🎨 PAINEL INICIAL
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_painel_inicial_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_painel_inicial_",
                    ""
                );

            return await abrirModalPainelInicial(
                interaction,
                guildId
            );
        }

        // =================================================
        // 🔘 BOTÃO DO PAINEL
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_botao_painel_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_botao_painel_",
                    ""
                );

            return await abrirModalTextoBotaoPainel(
                interaction,
                guildId
            );
        }

        // =================================================
        // 🎭 CARGO PÓS-REGISTRO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_cargo_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_cargo_",
                    ""
                );

            return await abrirModalCargoRegistro(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📺 CANAL
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_canal_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_canal_",
                    ""
                );

            return await mostrarSelecaoCanal(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📺 SALVAR CANAL
        // =================================================

        if (
            interaction.isChannelSelectMenu() &&
            customId.startsWith(
                "registro_selecionar_canal_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_selecionar_canal_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const canalId =
                interaction.values[0];

            const canal =
                await interaction.guild.channels
                    .fetch(canalId)
                    .catch(() => null);

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Esse canal não pode receber o painel.`,
                    flags: EPHEMERAL
                });
            }

            await pool.query(
                `
                UPDATE registro_config
                SET canal_id = $1,
                    atualizado_em = $2
                WHERE guild_id = $3
                `,
                [
                    canalId,
                    Date.now(),
                    guildId
                ]
            );

            return await atualizarPainelPrincipal(
                interaction,
                guildId,
                `${EMOJIS.sucesso} Canal selecionado: <#${canalId}>`
            );
        }

        // =================================================
        // ➕ ADICIONAR PÁGINA
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_adicionar_pagina_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_adicionar_pagina_",
                    ""
                );

            return await adicionarPagina(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📢 PUBLICAR
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_publicar_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_publicar_",
                    ""
                );

            return await publicarRegistro(
                interaction,
                guildId
            );
        }

        // =================================================
        // 🗑️ EXCLUIR
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_excluir_"
            ) &&
            !customId.startsWith(
                "registro_excluir_botao_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_excluir_",
                    ""
                );

            return await mostrarConfirmacaoExclusao(
                interaction,
                guildId
            );
        }

        // =================================================
        // 🗑️ CONFIRMAR EXCLUSÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_confirmar_excluir_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_confirmar_excluir_",
                    ""
                );

            return await excluirRegistro(
                interaction,
                guildId
            );
        }

        // =================================================
        // ↩️ CANCELAR EXCLUSÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_cancelar_excluir_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_cancelar_excluir_",
                    ""
                );

            return await atualizarPainelPrincipal(
                interaction,
                guildId,
                "↩️ Exclusão cancelada."
            );
        }

        // =================================================
        // 📋 SELECIONAR PÁGINA
        // =================================================

        if (
            interaction.isStringSelectMenu() &&
            customId.startsWith(
                "registro_selecionar_pagina_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_selecionar_pagina_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const numeroPagina =
                Number(
                    interaction.values[0]
                );

            return await mostrarConfiguracaoPagina(
                interaction,
                guildId,
                numeroPagina
            );
        }

        // =================================================
        // 📝 EDITAR TEXTO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_editar_texto_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalTexto(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // 🔻 EDITAR RODAPÉ
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_editar_rodape_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalRodape(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // ➕ ADICIONAR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_adicionar_botao_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalBotao(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // ⚙️ BOTÕES
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_botoes_"
            )
        ) {
            const partes =
                customId.split("_");

            return await mostrarBotoes(
                interaction,
                partes[2],
                Number(partes[3])
            );
        }

        // =================================================
        // ✏️ EDITAR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_editar_botao_"
            )
        ) {
            const partes =
                customId.split("_");

            return await abrirModalEditarBotao(
                interaction,
                partes[3],
                partes[4],
                Number(partes[5])
            );
        }

        // =================================================
        // 🗑️ EXCLUIR BOTÃO
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_excluir_botao_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const botaoId =
                partes[4];

            const numeroPagina =
                Number(partes[5]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa página não existe.`,
                    flags: EPHEMERAL
                });
            }

            const botoes =
                await buscarBotoes(
                    pagina.id
                );

            const botao =
                botoes.find(
                    item =>
                        String(item.id) ===
                        String(botaoId)
                );

            if (!botao) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Esse botão não existe nesta página.`,
                    flags: EPHEMERAL
                });
            }

            await excluirRegistroBotao(
                botaoId
            );

            return await mostrarBotoes(
                interaction,
                guildId,
                numeroPagina
            );
        }

        // =================================================
        // ◀️ VOLTAR PARA PÁGINA
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_voltar_pagina_"
            )
        ) {
            const partes =
                customId.split("_");

            return await mostrarConfiguracaoPagina(
                interaction,
                partes[3],
                Number(partes[4])
            );
        }

        // =================================================
        // ◀️ VOLTAR
        // =================================================

        if (
            interaction.isButton() &&
            customId.startsWith(
                "registro_voltar_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_voltar_",
                    ""
                );

            return await atualizarPainelPrincipal(
                interaction,
                guildId
            );
        }

        // =================================================
        // 📝 MODAL PAINEL INICIAL
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_painel_inicial_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_modal_painel_inicial_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const titulo =
                interaction.fields
                    .getTextInputValue(
                        "painel_titulo"
                    )
                    .trim();

            const descricao =
                interaction.fields
                    .getTextInputValue(
                        "painel_descricao"
                    )
                    .trim();

            const imagem =
                interaction.fields
                    .getTextInputValue(
                        "painel_imagem"
                    )
                    .trim();

            const thumbnail =
                interaction.fields
                    .getTextInputValue(
                        "painel_thumbnail"
                    )
                    .trim();

            const rodape =
                interaction.fields
                    .getTextInputValue(
                        "painel_rodape"
                    )
                    .trim();

            if (
                imagem &&
                !urlValida(imagem)
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} A URL da imagem é inválida.`,
                    flags: EPHEMERAL
                });
            }

            if (
                thumbnail &&
                !urlValida(thumbnail)
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} A URL da thumbnail é inválida.`,
                    flags: EPHEMERAL
                });
            }

            await pool.query(
                `
                UPDATE registro_config
                SET painel_titulo = $1,
                    painel_descricao = $2,
                    painel_imagem = $3,
                    painel_thumbnail = $4,
                    painel_rodape = $5,
                    atualizado_em = $6
                WHERE guild_id = $7
                `,
                [
                    titulo ||
                        "📝 Registro",
                    descricao ||
                        "Clique no botão abaixo para começar seu registro.",
                    imagem || null,
                    thumbnail || null,
                    rodape || null,
                    Date.now(),
                    guildId
                ]
            );

            const config =
                await buscarConfiguracao(
                    guildId
                );

            await atualizarMensagemRegistro(
                interaction.guild,
                config
            );

            return await atualizarPainelPrincipal(
                interaction,
                guildId,
                `${EMOJIS.sucesso} Painel inicial atualizado!`
            );
        }

        // =================================================
        // 🔘 MODAL BOTÃO DO PAINEL
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_botao_painel_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_modal_botao_painel_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const texto =
                interaction.fields
                    .getTextInputValue(
                        "painel_botao_texto"
                    )
                    .trim();

            await pool.query(
                `
                UPDATE registro_config
                SET painel_botao_texto = $1,
                    atualizado_em = $2
                WHERE guild_id = $3
                `,
                [
                    texto || "Registrar",
                    Date.now(),
                    guildId
                ]
            );

            const config =
                await buscarConfiguracao(
                    guildId
                );

            await atualizarMensagemRegistro(
                interaction.guild,
                config
            );

            return await atualizarPainelPrincipal(
                interaction,
                guildId,
                `${EMOJIS.sucesso} Texto do botão atualizado!`
            );
        }

        // =================================================
        // 🎭 MODAL CARGO PÓS-REGISTRO
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_cargo_"
            )
        ) {
            const guildId =
                customId.replace(
                    "registro_modal_cargo_",
                    ""
                );

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const cargoTexto =
                interaction.fields
                    .getTextInputValue(
                        "cargo"
                    )
                    .trim();

            const cargoResultado =
                obterCargoConfigurado(
                    interaction,
                    cargoTexto
                );

            if (cargoResultado.erro) {
                return interaction.reply({
                    content:
                        cargoResultado.erro,
                    flags: EPHEMERAL
                });
            }

            // Se informou um cargo, verifica se o bot
            // realmente consegue entregar esse cargo.
            if (cargoResultado.id) {
                const cargo =
                    interaction.guild.roles.cache.get(
                        String(
                            cargoResultado.id
                        )
                    );

                const verificacao =
                    verificarCargoDoBot(
                        interaction,
                        cargo
                    );

                if (!verificacao.sucesso) {
                    return interaction.reply({
                        content:
                            verificacao.erro,
                        flags: EPHEMERAL
                    });
                }
            }

            await pool.query(
                `
                UPDATE registro_config
                SET cargo_registro_id = $1,
                    atualizado_em = $2
                WHERE guild_id = $3
                `,
                [
                    cargoResultado.id,
                    Date.now(),
                    guildId
                ]
            );

            return await atualizarPainelPrincipal(
                interaction,
                guildId,
                cargoResultado.id
                    ? `${EMOJIS.sucesso} Cargo pós-registro definido: <@&${cargoResultado.id}>`
                    : `${EMOJIS.sucesso} Cargo pós-registro removido. Os usuários não receberão cargo automático.`
            );
        }

        // =================================================
        // 📝 MODAL TEXTO
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_texto_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(partes[4]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Página não encontrada.`,
                    flags: EPHEMERAL
                });
            }

            const titulo =
                interaction.fields
                    .getTextInputValue("titulo")
                    .trim();

            const descricao =
                interaction.fields
                    .getTextInputValue("descricao")
                    .trim();

            // O banco regrava os 4 campos de uma vez: mantém o rodapé
            await atualizarRegistroPagina(
                pagina.id,
                guildId,
                {
                    titulo:
                        titulo || null,
                    descricao:
                        descricao || null,
                    rodape:
                        pagina.rodape,
                    rodape_icone:
                        pagina.rodape_icone
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            return await mostrarConfiguracaoPagina(
                interaction,
                guildId,
                numeroPagina,
                `${EMOJIS.sucesso} Título e descrição atualizados!`
            );
        }

        // =================================================
        // 🔻 MODAL RODAPÉ
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_rodape_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(partes[4]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Página não encontrada.`,
                    flags: EPHEMERAL
                });
            }

            const rodape =
                interaction.fields
                    .getTextInputValue("rodape")
                    .trim();

            const icone =
                interaction.fields
                    .getTextInputValue(
                        "rodape_icone"
                    )
                    .trim();

            if (
                icone &&
                !urlValida(icone)
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} A URL do ícone do rodapé é inválida.`,
                    flags: EPHEMERAL
                });
            }

            // O banco regrava os 4 campos de uma vez: mantém título e descrição
            await atualizarRegistroPagina(
                pagina.id,
                guildId,
                {
                    titulo:
                        pagina.titulo,
                    descricao:
                        pagina.descricao,
                    rodape:
                        rodape || null,
                    rodape_icone:
                        icone || null
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            return await mostrarConfiguracaoPagina(
                interaction,
                guildId,
                numeroPagina,
                `${EMOJIS.sucesso} Rodapé atualizado!`
            );
        }

        // =================================================
        // 🔘 MODAL NOVO BOTÃO
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_botao_"
            ) &&
            !customId.startsWith(
                "registro_modal_botao_painel_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[3];

            const numeroPagina =
                Number(partes[4]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Página não encontrada.`,
                    flags: EPHEMERAL
                });
            }

            const botoes =
                await buscarBotoes(
                    pagina.id
                );

            if (botoes.length >= MAX_BOTOES) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} O limite é de ${MAX_BOTOES} botões por página.`,
                    flags: EPHEMERAL
                });
            }

            const texto =
                interaction.fields
                    .getTextInputValue("texto")
                    .trim();

            if (!texto) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} O texto do botão não pode ficar vazio.`,
                    flags: EPHEMERAL
                });
            }

            const emoji =
                interaction.fields
                    .getTextInputValue("emoji")
                    .trim();

            const cargo =
                interaction.fields
                    .getTextInputValue("cargo")
                    .trim();

            let estilo =
                interaction.fields
                    .getTextInputValue("estilo");

            estilo =
                String(
                    estilo || "PRIMARY"
                )
                    .toUpperCase()
                    .trim();

            if (!ESTILOS_BOTOES[estilo]) {
                estilo = "PRIMARY";
            }

            const cargoResultado =
                obterCargoConfigurado(
                    interaction,
                    cargo
                );

            if (cargoResultado.erro) {
                return interaction.reply({
                    content:
                        cargoResultado.erro,
                    flags: EPHEMERAL
                });
            }

            const customIdBotao =
                `registro_botao_${guildId}_${Date.now()}_${crypto
                    .randomBytes(5)
                    .toString("hex")}`;

            await criarRegistroBotao(
                pagina.id,
                {
                    texto,
                    emoji:
                        emoji || null,
                    estilo,
                    cargo_id:
                        cargoResultado.id,
                    custom_id:
                        customIdBotao,
                    ordem:
                        botoes.length + 1
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            return await mostrarConfiguracaoPagina(
                interaction,
                guildId,
                numeroPagina,
                cargoResultado.id
                    ? `${EMOJIS.sucesso} Botão criado e configurado para dar <@&${cargoResultado.id}>.`
                    : `${EMOJIS.sucesso} Botão criado sem cargo.`
            );
        }

        // =================================================
        // ✏️ MODAL EDITAR BOTÃO
        // =================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith(
                "registro_modal_editar_botao_"
            )
        ) {
            const partes =
                customId.split("_");

            const guildId =
                partes[4];

            const botaoId =
                partes[5];

            const numeroPagina =
                Number(partes[6]);

            if (
                !pertenceAoServidor(
                    interaction,
                    guildId
                )
            ) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Essa interação não pertence a este servidor.`,
                    flags: EPHEMERAL
                });
            }

            const pagina =
                await buscarPagina(
                    guildId,
                    numeroPagina
                );

            if (!pagina) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Página não encontrada.`,
                    flags: EPHEMERAL
                });
            }

            const botoes =
                await buscarBotoes(
                    pagina.id
                );

            const botao =
                botoes.find(
                    item =>
                        String(item.id) ===
                        String(botaoId)
                );

            if (!botao) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} Esse botão não existe nesta página.`,
                    flags: EPHEMERAL
                });
            }

            const texto =
                interaction.fields
                    .getTextInputValue("texto")
                    .trim();

            if (!texto) {
                return interaction.reply({
                    content:
                        `${EMOJIS.erro} O texto do botão não pode ficar vazio.`,
                    flags: EPHEMERAL
                });
            }

            const emoji =
                interaction.fields
                    .getTextInputValue("emoji")
                    .trim();

            const cargo =
                interaction.fields
                    .getTextInputValue("cargo")
                    .trim();

            let estilo =
                interaction.fields
                    .getTextInputValue("estilo");

            estilo =
                String(
                    estilo || "PRIMARY"
                )
                    .toUpperCase()
                    .trim();

            if (!ESTILOS_BOTOES[estilo]) {
                estilo = "PRIMARY";
            }

            const cargoResultado =
                obterCargoConfigurado(
                    interaction,
                    cargo
                );

            if (cargoResultado.erro) {
                return interaction.reply({
                    content:
                        cargoResultado.erro,
                    flags: EPHEMERAL
                });
            }

            await atualizarRegistroBotao(
                botaoId,
                {
                    texto,
                    emoji:
                        emoji || null,
                    estilo,
                    cargo_id:
                        cargoResultado.id
                }
            );

            await atualizarPublicacaoSeExistir(
                interaction,
                guildId
            );

            return await mostrarBotoes(
                interaction,
                guildId,
                numeroPagina,
                `${EMOJIS.sucesso} Botão atualizado!`
            );
        }

        return false;

    } catch (erro) {
        console.error(
            "❌ Erro no sistema /registrar:",
            erro
        );

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            return interaction.followUp({
                content:
                    `${EMOJIS.erro} Ocorreu um erro no sistema de registro. Verifique o console do bot.`,
                flags: EPHEMERAL
            }).catch(() => {});
        }

        return interaction.reply({
            content:
                `${EMOJIS.erro} Ocorreu um erro no sistema de registro. Verifique o console do bot.`,
            flags: EPHEMERAL
        }).catch(() => {});
    }
}

// =====================================================
// 📦 COMANDO
// =====================================================

const data =
    new SlashCommandBuilder()
        .setName("registrar")
        .setDescription(
            "Cria e configura o sistema de registro do servidor."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        );

// =====================================================
// ▶️ EXECUTAR
// =====================================================

async function execute(interaction) {
    if (!interaction.guild) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Este comando só pode ser usado em um servidor.`,
            flags: EPHEMERAL
        });
    }

    if (!podeConfigurar(interaction)) {
        return interaction.reply({
            content:
                `${EMOJIS.erro} Você precisa da permissão **Gerenciar Servidor** para usar este comando.`,
            flags: EPHEMERAL
        });
    }

    try {
        await mostrarPainel(interaction);
    } catch (erro) {
        console.error(
            "❌ Erro ao executar /registrar:",
            erro
        );

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            return;
        }

        return interaction.reply({
            content:
                `${EMOJIS.erro} Não foi possível abrir o sistema de registro. Verifique o console do bot.`,
            flags: EPHEMERAL
        });
    }
}

// =====================================================
// 📦 EXPORTAÇÕES
// =====================================================

module.exports = {
    data,
    execute,
    handleInteraction
};
