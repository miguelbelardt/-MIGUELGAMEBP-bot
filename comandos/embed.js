const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const {
    criarEmbedBanco,
    atualizarEmbedBanco,
    getEmbedsDoServidor,
    getEmbedPorId,
    salvarMensagemEmbed,
    atualizarCanalEmbed,
    excluirEmbedBanco,
    mysqlPool
} = require("../database/database");

// =====================================================
// 💾 CONFIGURAÇÕES TEMPORÁRIAS
// =====================================================

const configuracoes = new Map();

// =====================================================
// 🛠️ FUNÇÕES AUXILIARES
// =====================================================

function chaveConfiguracao(userId, guildId) {
    return `${guildId}:${userId}`;
}

function criarConfiguracao() {
    return {
        nome: "Embed",

        titulo: "",
        descricao: "",
        imagem: "",
        thumbnail: "",
        cor: "#5865F2",
        timestamp: false,

        autor: "",
        autorIcone: "",

        footer: "",
        footerIcone: "",

        tituloUrl: "",
        autorUrl: "",
        campos: "",
        mensagem: "",

        canalId: "",
        mensagemId: "",

        editandoEmbedId: null
    };
}

function validarURL(url) {
    try {
        const resultado = new URL(url);

        // O Discord só aceita http/https em links e imagens.
        return (
            resultado.protocol === "http:" ||
            resultado.protocol === "https:"
        );
    } catch {
        return false;
    }
}

// =====================================================
// 🧾 CAMPOS DO EMBED
// =====================================================

// Formato (uma linha por campo):
//   Nome | Valor | sim   (sim = lado a lado, vazio/nao = linha inteira)
// Use \n dentro do valor para quebrar linha.

const MAX_CAMPOS = 25;

function textoParaCampos(texto) {
    if (!texto || typeof texto !== "string") {
        return [];
    }

    const campos = [];

    for (const linha of texto.split("\n")) {
        if (campos.length >= MAX_CAMPOS) {
            break;
        }

        const partes =
            linha.split("|").map(
                parte => parte.trim()
            );

        if (partes.length < 2 || !partes[0] || !partes[1]) {
            continue;
        }

        campos.push({
            name: partes[0].slice(0, 256),

            value:
                partes[1]
                    .replace(/\\n/g, "\n")
                    .slice(0, 1024),

            inline:
                /^(sim|s|true|1|yes)$/i.test(
                    partes[2] || ""
                )
        });
    }

    return campos;
}

function camposParaTexto(campos) {
    return campos
        .map(campo =>
            `${campo.name} | ${campo.value.replace(/\n/g, "\\n")} | ${campo.inline ? "sim" : "nao"}`
        )
        .join("\n");
}

// =====================================================
// 💾 COLUNAS EXTRAS (link do título/autor, campos, texto)
// =====================================================

// O database.js não conhece essas colunas, então o próprio
// embed.js cria (se faltarem) e salva elas depois do save normal.

let promessaColunasExtras = null;

function garantirColunasExtras() {
    if (!promessaColunasExtras) {
        promessaColunasExtras = (async () => {
            const [colunas] = await mysqlPool.query(
                "SHOW COLUMNS FROM embeds_personalizados"
            );

            const existentes = colunas.map(
                coluna => coluna.Field
            );

            const extras = {
                titulo_url: "TEXT",
                autor_url: "TEXT",
                campos: "TEXT",
                mensagem_texto: "TEXT"
            };

            for (const [coluna, definicao] of Object.entries(extras)) {
                if (!existentes.includes(coluna)) {
                    await mysqlPool.query(
                        `ALTER TABLE embeds_personalizados ADD COLUMN ${coluna} ${definicao}`
                    );
                }
            }
        })().catch(erro => {
            // Tenta de novo na próxima vez
            promessaColunasExtras = null;

            console.error(
                "❌ Erro ao preparar colunas extras do embed:",
                erro
            );
        });
    }

    return promessaColunasExtras;
}

async function salvarExtras(id, guildId, config) {
    try {
        await garantirColunasExtras();

        await mysqlPool.query(
            `
            UPDATE embeds_personalizados
            SET
                titulo_url = ?,
                autor_url = ?,
                campos = ?,
                mensagem_texto = ?
            WHERE id = ?
            AND guild_id = ?
            `,
            [
                config.tituloUrl || null,
                config.autorUrl || null,
                config.campos || null,
                config.mensagem || null,
                id,
                guildId
            ]
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao salvar dados extras do embed:",
            erro
        );
    }
}

// =====================================================
// 🔄 CONVERTER DADOS DO BANCO PARA CONFIGURAÇÃO
// =====================================================

function criarConfigAPartirDoBanco(dados) {
    return {
        nome: dados.nome || "Embed",

        titulo: dados.titulo || "",
        descricao: dados.descricao || "",

        imagem: dados.imagem || "",
        thumbnail: dados.thumbnail || "",

        cor: dados.cor || "#5865F2",

        timestamp: Boolean(
            dados.timestamp
        ),

        autor: dados.autor_nome || "",
        autorIcone: dados.autor_icone || "",

        footer: dados.rodape || "",
        footerIcone: dados.rodape_icone || "",

        tituloUrl: dados.titulo_url || "",
        autorUrl: dados.autor_url || "",
        campos: dados.campos || "",
        mensagem: dados.mensagem_texto || "",

        canalId: dados.canal_id || "",
        mensagemId: dados.mensagem_id || "",

        editandoEmbedId: dados.id
    };
}

// =====================================================
// 🎨 CRIAR EMBED
// =====================================================

function criarEmbed(config, usuario) {
    if (
        !config.titulo &&
        !config.descricao &&
        !config.imagem &&
        !config.thumbnail &&
        !config.autor &&
        !config.footer &&
        !config.campos
    ) {
        return {
            sucesso: false,
            erro:
                "❌ Configure pelo menos um campo antes de continuar."
        };
    }

    const embed = new EmbedBuilder()
        .setColor(
            config.cor || "#5865F2"
        );

    // =================================================
    // 📝 TÍTULO
    // =================================================

    if (config.titulo) {
        embed.setTitle(
            config.titulo
        );

        if (
            config.tituloUrl &&
            validarURL(config.tituloUrl)
        ) {
            embed.setURL(
                config.tituloUrl
            );
        }
    }

    // =================================================
    // 📄 DESCRIÇÃO
    // =================================================

    if (config.descricao) {
        embed.setDescription(
            config.descricao
        );
    }

    // =================================================
    // 🖼️ IMAGEM
    // =================================================

    if (config.imagem) {
        embed.setImage(
            config.imagem
        );
    }

    // =================================================
    // 🔗 THUMBNAIL
    // =================================================

    if (config.thumbnail) {
        embed.setThumbnail(
            config.thumbnail
        );
    }

    // =================================================
    // 👤 AUTOR
    // =================================================

    if (config.autor) {
        const autor = {
            name: config.autor
        };

        if (config.autorIcone) {
            autor.iconURL =
                config.autorIcone;
        }

        if (
            config.autorUrl &&
            validarURL(config.autorUrl)
        ) {
            autor.url =
                config.autorUrl;
        }

        embed.setAuthor(
            autor
        );
    }

    // =================================================
    // 📝 RODAPÉ
    // =================================================

    if (config.footer) {
        const footer = {
            text: config.footer
        };

        if (config.footerIcone) {
            footer.iconURL =
                config.footerIcone;
        }

        embed.setFooter(
            footer
        );
    } else if (usuario) {
        embed.setFooter({
            text:
                `Enviado por ${usuario.username}`
        });
    }

    // =================================================
    // 🕐 TIMESTAMP
    // =================================================

    // =================================================
    // 🧾 CAMPOS
    // =================================================

    const campos =
        textoParaCampos(
            config.campos
        );

    if (campos.length) {
        embed.addFields(
            campos
        );
    }

    if (config.timestamp) {
        embed.setTimestamp();
    }

    return {
        sucesso: true,
        embed
    };
}

// =====================================================
// 📋 PAINEL PRINCIPAL DO /EMBED
// =====================================================

function criarPainelPrincipal() {
    const embed =
        new EmbedBuilder()
            .setTitle(
                "🎨 GERENCIADOR DE EMBEDS"
            )
            .setDescription(
                "Escolha uma opção abaixo.\n\n" +
                "➕ **Criar** — Cria e envia um novo embed.\n" +
                "⚙️ **Configurar** — Gerencia os embeds já criados neste servidor."
            )
            .setColor("#5865F2");

    const linha =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "embed_criar"
                    )
                    .setLabel("Criar")
                    .setEmoji("➕")
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_configurar"
                    )
                    .setLabel("Configurar")
                    .setEmoji("⚙️")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    return {
        embeds: [embed],
        components: [linha]
    };
}

// =====================================================
// ⚙️ PAINEL DE CONFIGURAÇÃO DOS EMBEDS
// =====================================================

async function criarPainelConfiguracao(
    guildId,
    pagina = 0
) {
    const embeds =
        await getEmbedsDoServidor(
            guildId
        );

    const painel =
        new EmbedBuilder()
            .setTitle(
                "⚙️ CONFIGURAR EMBEDS"
            )
            .setColor("#5865F2");

    if (
        !embeds ||
        embeds.length === 0
    ) {
        painel.setDescription(
            "📭 Nenhum embed foi criado neste servidor ainda.\n\n" +
            "Use **➕ Criar** para criar um novo embed."
        );

        const linha =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            "embed_criar"
                        )
                        .setLabel("Criar novo")
                        .setEmoji("➕")
                        .setStyle(
                            ButtonStyle.Success
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            "embed_voltar"
                        )
                        .setLabel("Voltar")
                        .setEmoji("↩️")
                        .setStyle(
                            ButtonStyle.Secondary
                        )
                );

        return {
            embeds: [painel],
            components: [linha]
        };
    }

    // =================================================
    // 📄 PAGINAÇÃO
    // =================================================

    const porPagina = 4;

    const totalPaginas =
        Math.ceil(
            embeds.length / porPagina
        );

    if (pagina < 0) {
        pagina = 0;
    }

    if (pagina >= totalPaginas) {
        pagina =
            totalPaginas - 1;
    }

    const inicio =
        pagina * porPagina;

    const fim =
        inicio + porPagina;

    const embedsExibidos =
        embeds.slice(
            inicio,
            fim
        );

    painel.setDescription(
        "Selecione um embed abaixo para configurar.\n\n" +
        `📦 **${embeds.length}** embed(s) encontrado(s).\n` +
        `📄 Página **${pagina + 1}/${totalPaginas}**`
    );

    const componentes = [];

    // =================================================
    // ⚙️ BOTÕES DOS EMBEDS
    // =================================================

    for (
        let i = 0;
        i < embedsExibidos.length;
        i++
    ) {
        const dados =
            embedsExibidos[i];

        // Número visual sequencial global.
        const numero =
            `#${inicio + i + 1}`;

        const nome =
            dados.titulo &&
            dados.titulo.trim()
                ? dados.titulo
                    .trim()
                    .substring(0, 60)
                : "Embed sem título";

        const configurar =
            new ButtonBuilder()
                .setCustomId(
                    `embed_edit_${dados.id}`
                )
                .setLabel(
                    `Configurar ${numero}`
                )
                .setEmoji("⚙️")
                .setStyle(
                    ButtonStyle.Primary
                );

        const linha =
            new ActionRowBuilder()
                .addComponents(
                    configurar
                );

        componentes.push(
            linha
        );

        painel.addFields({
            name:
                `${numero} • ${nome}`,

            value:
                dados.canal_id
                    ? `📍 Canal: <#${dados.canal_id}>`
                    : "📍 Canal não definido",

            inline: false
        });
    }

    // =================================================
    // ◀️ / ▶️ PAGINAÇÃO
    // =================================================

    const linhaNavegacao =
        new ActionRowBuilder();

    if (pagina > 0) {
        linhaNavegacao.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `embed_pagina_${pagina - 1}`
                )
                .setLabel("Anterior")
                .setEmoji("⬅️")
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
    }

    if (pagina < totalPaginas - 1) {
        linhaNavegacao.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `embed_pagina_${pagina + 1}`
                )
                .setLabel("Próxima")
                .setEmoji("➡️")
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
    }

    linhaNavegacao.addComponents(
        new ButtonBuilder()
            .setCustomId(
                "embed_criar"
            )
            .setLabel("Criar novo")
            .setEmoji("➕")
            .setStyle(
                ButtonStyle.Success
            ),

        new ButtonBuilder()
            .setCustomId(
                "embed_voltar"
            )
            .setLabel("Voltar")
            .setEmoji("↩️")
            .setStyle(
                ButtonStyle.Secondary
            )
    );

    componentes.push(
        linhaNavegacao
    );

    return {
        embeds: [painel],
        components: componentes
    };
}

// =====================================================
// 📋 PAINEL PRINCIPAL DO CONFIGURADOR
// =====================================================

function criarPainel(config, usuario = null) {
    const embed =
        new EmbedBuilder()
            .setTitle(
                "🎨 CONFIGURADOR DE EMBED"
            )
            .setDescription(
                "Configure seu embed usando os botões abaixo.\n\n" +
                "🔒 **Somente administradores podem utilizar este painel.**\n\n" +
                "👀 Depois de enviar, o embed ficará visível para todos no servidor.\n" +
                "⚙️ Depois você poderá voltar em `/embed` → **Configurar** para alterar este embed."
            )
            .setColor(
                config.cor || "#5865F2"
            );

    // =================================================
    // 📍 CANAL
    // =================================================

    const canalTexto =
        config.canalId
            ? `📍 Canal configurado: <#${config.canalId}>`
            : "📍 Canal: canal atual";

    embed.addFields({
        name: "📤 Destino",
        value: canalTexto
    });

    const qtdCampos =
        textoParaCampos(
            config.campos
        ).length;

    const marca = ativo =>
        ativo ? "✅" : "❌";

    embed.addFields({
        name: "📊 Status",

        value:
            `${marca(config.titulo)} Título  ` +
            `${marca(config.descricao)} Descrição  ` +
            `${marca(config.autor)} Autor  ` +
            `${marca(config.footer)} Rodapé\n` +
            `${marca(config.imagem)} Imagem  ` +
            `${marca(config.thumbnail)} Thumbnail  ` +
            `${marca(config.tituloUrl || config.autorUrl)} Links  ` +
            `${marca(qtdCampos)} Campos${qtdCampos ? ` (${qtdCampos})` : ""}\n` +
            `${marca(config.mensagem)} Mensagem  ` +
            `${marca(config.timestamp)} Horário`
    });

    // =================================================
    // LINHA 1
    // =================================================

    const linha1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "embed_titulo"
                    )
                    .setLabel("📝 Título")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_descricao"
                    )
                    .setLabel("📄 Descrição")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_autor"
                    )
                    .setLabel("👤 Autor")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_footer"
                    )
                    .setLabel("📝 Rodapé")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_cor"
                    )
                    .setLabel("🎨 Cor")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    // =================================================
    // LINHA 2
    // =================================================

    const linha2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "embed_imagem"
                    )
                    .setLabel("🖼️ Imagem")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_thumbnail"
                    )
                    .setLabel("🔗 Thumbnail")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_links"
                    )
                    .setLabel("🌐 Links")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_campos"
                    )
                    .setLabel("🧾 Campos")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_timestamp"
                    )
                    .setLabel(
                        config.timestamp
                            ? "🕐 Horário: ON"
                            : "🕐 Horário: OFF"
                    )
                    .setStyle(
                        config.timestamp
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
            );

    // =================================================
    // LINHA 3
    // =================================================

    const linha3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "embed_canal"
                    )
                    .setLabel("📍 Canal")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_mensagem"
                    )
                    .setLabel("💬 Mensagem")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_preview"
                    )
                    .setLabel(
                        "👀 Pré-visualizar"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "embed_send"
                    )
                    .setLabel(
                        config.editandoEmbedId
                            ? "💾 Atualizar"
                            : "📤 Enviar"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
            );

    const componentes = [
        linha1,
        linha2,
        linha3
    ];

    // =================================================
    // 🗑️ EXCLUIR EMBED
    // =================================================

    if (config.editandoEmbedId) {
        const linhaExcluir =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            "embed_delete_current"
                        )
                        .setLabel(
                            "Excluir Embed"
                        )
                        .setEmoji("🗑️")
                        .setStyle(
                            ButtonStyle.Danger
                        )
                );

        componentes.push(
            linhaExcluir
        );
    }

    // =================================================
    // 👀 PRÉVIA AO VIVO (embed de verdade, em cima do painel)
    // =================================================

    const embeds = [embed];

    const tamanhoPrevia =
        (config.titulo || "").length +
        (config.descricao || "").length +
        (config.autor || "").length +
        (config.footer || "").length +
        textoParaCampos(config.campos).reduce(
            (total, campo) =>
                total +
                campo.name.length +
                campo.value.length,
            0
        );

    // O Discord limita a soma de todos os embeds da mensagem
    // a 6000 caracteres; passou disso, usa o botão Pré-visualizar.
    if (tamanhoPrevia <= 5000) {
        try {
            const previa =
                criarEmbed(
                    config,
                    usuario
                );

            if (previa.sucesso) {
                embeds.unshift(
                    previa.embed
                );
            }
        } catch (erro) {
            console.error(
                "⚠️ Prévia ao vivo ignorada:",
                erro.message
            );
        }
    }

    return {
        embeds,
        components: componentes
    };
}

// =====================================================
// 🔁 ATUALIZAR O PAINEL NO LUGAR
// =====================================================

// Botão/modal que veio do painel → edita a MESMA mensagem
// (sem mandar "✅ atualizado!" em mensagens soltas).
async function atualizarPainelEmbed(
    interaction,
    config
) {
    const painel =
        criarPainel(
            config,
            interaction.user
        );

    const veioDoPainel =
        (
            typeof interaction.isFromMessage === "function" &&
            interaction.isFromMessage()
        ) ||
        (
            typeof interaction.isButton === "function" &&
            interaction.isButton()
        );

    if (veioDoPainel) {
        return interaction.update({
            embeds:
                painel.embeds,
            components:
                painel.components
        });
    }

    return interaction.reply({
        embeds:
            painel.embeds,
        components:
            painel.components,
        flags:
            MessageFlags.Ephemeral
    });
}

// =====================================================
// 🔐 VERIFICAR ADMIN
// =====================================================

function isAdmin(interaction) {
    return (
        interaction.member &&
        interaction.member.permissions &&
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    );
}

// =====================================================
// 📦 EXPORTAÇÃO
// =====================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName("embed")
            .setDescription(
                "Abre o painel para criar e gerenciar embeds."
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ),

    // =================================================
    // 🚀 /EMBED
    // =================================================

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Este comando só pode ser usado dentro de um servidor.",
                ephemeral: true
            });
        }

        if (!isAdmin(interaction)) {
            return interaction.reply({
                content:
                    "❌ Você precisa da permissão de **Administrador do Discord** para usar este comando.",
                ephemeral: true
            });
        }

        const painel =
            criarPainelPrincipal();

        return interaction.reply({
            embeds:
                painel.embeds,
            components:
                painel.components,
            ephemeral: true
        });
    },

    // =================================================
    // 🔘 BOTÕES
    // =================================================

    async handleButton(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Este sistema só funciona dentro de servidores.",
                ephemeral: true
            });
        }

        if (!isAdmin(interaction)) {
            return interaction.reply({
                content:
                    "❌ Somente administradores podem configurar ou editar embeds.",
                ephemeral: true
            });
        }

        const userId =
            interaction.user.id;

        const guildId =
            interaction.guild.id;

        await garantirColunasExtras();

        // =================================================
        // ➕ CRIAR
        // =================================================

        if (
            interaction.customId ===
            "embed_criar"
        ) {
            const chave =
                chaveConfiguracao(
                    userId,
                    guildId
                );

            const config =
                criarConfiguracao();

            configuracoes.set(
                chave,
                config
            );

            const painel =
                criarPainel(
                    config,
                    interaction.user
                );

            return interaction.update({
                content: "",
                embeds:
                    painel.embeds,
                components:
                    painel.components
            });
        }

        // =================================================
        // ⚙️ CONFIGURAR
        // =================================================

        if (
            interaction.customId ===
            "embed_configurar"
        ) {
            try {
                const painel =
                    await criarPainelConfiguracao(
                        guildId,
                        0
                    );

                return interaction.update({
                    content: "",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao carregar embeds:",
                    erro
                );

                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    return interaction.reply({
                        content:
                            "❌ Não foi possível carregar os embeds deste servidor.",
                        ephemeral: true
                    });
                }
            }

            return;
        }

        // =================================================
        // 📄 PAGINAÇÃO
        // =================================================

        if (
            interaction.customId.startsWith(
                "embed_pagina_"
            )
        ) {
            try {
                const pagina =
                    parseInt(
                        interaction.customId.replace(
                            "embed_pagina_",
                            ""
                        ),
                        10
                    );

                if (
                    Number.isNaN(
                        pagina
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Página inválida.",
                        ephemeral: true
                    });
                }

                const painel =
                    await criarPainelConfiguracao(
                        guildId,
                        pagina
                    );

                return interaction.update({
                    content: "",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao trocar página dos embeds:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível carregar essa página.",
                    ephemeral: true
                });
            }
        }

        // =================================================
        // ↩️ VOLTAR
        // =================================================

        if (
            interaction.customId ===
            "embed_voltar"
        ) {
            const painel =
                criarPainelPrincipal();

            return interaction.update({
                content: "",
                embeds:
                    painel.embeds,
                components:
                    painel.components
            });
        }

        // =================================================
        // ✏️ EDITAR / CONFIGURAR EMBED EXISTENTE
        // =================================================

        if (
            interaction.customId.startsWith(
                "embed_edit_"
            )
        ) {
            try {
                const embedId =
                    interaction.customId.replace(
                        "embed_edit_",
                        ""
                    );

                const dados =
                    await getEmbedPorId(
                        embedId,
                        guildId
                    );

                if (!dados) {
                    return interaction.reply({
                        content:
                            "❌ Não encontrei esse embed neste servidor.",
                        ephemeral: true
                    });
                }

                const config =
                    criarConfigAPartirDoBanco(
                        dados
                    );

                const chave =
                    chaveConfiguracao(
                        userId,
                        guildId
                    );

                configuracoes.set(
                    chave,
                    config
                );

                const painel =
                    criarPainel(
                        config,
                        interaction.user
                    );

                return interaction.update({
                    content:
                        "✏️ **Modo de configuração ativado.**\nAs alterações serão aplicadas na mesma mensagem.",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao configurar embed:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível abrir a configuração desse embed.",
                    ephemeral: true
                });
            }
        }

        // =================================================
        // ⚙️ CONFIGURAR EMBED - COMPATIBILIDADE
        // =================================================

        if (
            interaction.customId.startsWith(
                "embed_config_"
            )
        ) {
            try {
                const embedId =
                    interaction.customId.replace(
                        "embed_config_",
                        ""
                    );

                const dados =
                    await getEmbedPorId(
                        embedId,
                        guildId
                    );

                if (!dados) {
                    return interaction.reply({
                        content:
                            "❌ Não encontrei esse embed neste servidor.",
                        ephemeral: true
                    });
                }

                const config =
                    criarConfigAPartirDoBanco(
                        dados
                    );

                const chave =
                    chaveConfiguracao(
                        userId,
                        guildId
                    );

                configuracoes.set(
                    chave,
                    config
                );

                const painel =
                    criarPainel(
                        config,
                        interaction.user
                    );

                return interaction.reply({
                    content:
                        "⚙️ **Configuração do embed ativada.**",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components,
                    ephemeral: true
                });

            } catch (erro) {
                console.error(
                    "❌ Erro na configuração do embed:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível configurar esse embed.",
                    ephemeral: true
                });
            }
        }

        // =================================================
        // 🗑️ EXCLUIR EMBED ATUAL
        // =================================================

        if (
            interaction.customId ===
            "embed_delete_current"
        ) {
            try {
                const chave =
                    chaveConfiguracao(
                        userId,
                        guildId
                    );

                const config =
                    configuracoes.get(
                        chave
                    );

                if (
                    !config ||
                    !config.editandoEmbedId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Nenhum embed está sendo configurado.",
                        ephemeral: true
                    });
                }

                const embedId =
                    config.editandoEmbedId;

                const dados =
                    await getEmbedPorId(
                        embedId,
                        guildId
                    );

                if (!dados) {
                    configuracoes.delete(
                        chave
                    );

                    return interaction.reply({
                        content:
                            "❌ Não encontrei esse embed no banco de dados.",
                        ephemeral: true
                    });
                }

                // =========================================
                // 🗑️ EXCLUIR MENSAGEM DO DISCORD
                // =========================================

                if (
                    dados.canal_id &&
                    dados.mensagem_id
                ) {
                    const canal =
                        await interaction.guild.channels
                            .fetch(
                                dados.canal_id
                            )
                            .catch(
                                () => null
                            );

                    if (
                        canal &&
                        canal.isTextBased()
                    ) {
                        const mensagem =
                            await canal.messages
                                .fetch(
                                    dados.mensagem_id
                                )
                                .catch(
                                    () => null
                                );

                        if (mensagem) {
                            await mensagem
                                .delete()
                                .catch(
                                    () => {}
                                );
                        }
                    }
                }

                // =========================================
                // 🗑️ EXCLUIR DO BANCO
                // =========================================

                await excluirEmbedBanco(
                    embedId,
                    guildId
                );

                configuracoes.delete(
                    chave
                );

                const painel =
                    await criarPainelConfiguracao(
                        guildId,
                        0
                    );

                return interaction.update({
                    content:
                        "🗑️ Embed excluído com sucesso.",
                    embeds:
                        painel.embeds,
                    components:
                        painel.components
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao excluir embed:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível excluir o embed.",
                    ephemeral: true
                });
            }
        }

        // =================================================
        // 🔧 CONFIGURAÇÃO TEMPORÁRIA
        // =================================================

        const chave =
            chaveConfiguracao(
                userId,
                guildId
            );

        const config =
            configuracoes.get(
                chave
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua configuração expirou. Use `/embed` novamente.",
                ephemeral: true
            });
        }

        // =================================================
        // 📝 TÍTULO
        // =================================================

        if (
            interaction.customId ===
            "embed_titulo"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_titulo"
                    )
                    .setTitle(
                        "📝 Configurar título"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "titulo"
                    )
                    .setLabel(
                        "Título do embed"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(256)
                    .setValue(
                        config.titulo ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 📄 DESCRIÇÃO
        // =================================================

        if (
            interaction.customId ===
            "embed_descricao"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_descricao"
                    )
                    .setTitle(
                        "📄 Configurar descrição"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "descricao"
                    )
                    .setLabel(
                        "Descrição do embed"
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(false)
                    .setMaxLength(4000)
                    .setValue(
                        config.descricao ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🖼️ IMAGEM
        // =================================================

        if (
            interaction.customId ===
            "embed_imagem"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_imagem"
                    )
                    .setTitle(
                        "🖼️ Configurar imagem"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "imagem"
                    )
                    .setLabel(
                        "URL da imagem"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "https://exemplo.com/imagem.png"
                    )
                    .setValue(
                        config.imagem ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🔗 THUMBNAIL
        // =================================================

        if (
            interaction.customId ===
            "embed_thumbnail"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_thumbnail"
                    )
                    .setTitle(
                        "🔗 Configurar thumbnail"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "thumbnail"
                    )
                    .setLabel(
                        "URL da thumbnail"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "https://exemplo.com/imagem.png"
                    )
                    .setValue(
                        config.thumbnail ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🎨 COR
        // =================================================

        if (
            interaction.customId ===
            "embed_cor"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_cor"
                    )
                    .setTitle(
                        "🎨 Configurar cor"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "cor"
                    )
                    .setLabel(
                        "Cor hexadecimal"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "#5865F2"
                    )
                    .setValue(
                        config.cor ||
                        "#5865F2"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 👤 AUTOR
        // =================================================

        if (
            interaction.customId ===
            "embed_autor"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_autor"
                    )
                    .setTitle(
                        "👤 Configurar autor"
                    );

            const nome =
                new TextInputBuilder()
                    .setCustomId(
                        "autor"
                    )
                    .setLabel(
                        "Nome do autor"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(256)
                    .setValue(
                        config.autor ||
                        ""
                    );

            const icone =
                new TextInputBuilder()
                    .setCustomId(
                        "autor_icone"
                    )
                    .setLabel(
                        "URL do ícone do autor"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "https://exemplo.com/icone.png"
                    )
                    .setValue(
                        config.autorIcone ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                icone
                            )
                    )
            );

            // Corrige a estrutura das linhas do modal
            modal.setComponents(
                new ActionRowBuilder()
                    .addComponents(
                        nome
                    ),

                new ActionRowBuilder()
                    .addComponents(
                        icone
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 📝 RODAPÉ
        // =================================================

        if (
            interaction.customId ===
            "embed_footer"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_footer"
                    )
                    .setTitle(
                        "📝 Configurar rodapé"
                    );

            const texto =
                new TextInputBuilder()
                    .setCustomId(
                        "footer"
                    )
                    .setLabel(
                        "Texto do rodapé"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setMaxLength(2048)
                    .setValue(
                        config.footer ||
                        ""
                    );

            const icone =
                new TextInputBuilder()
                    .setCustomId(
                        "footer_icone"
                    )
                    .setLabel(
                        "URL do ícone do rodapé"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "https://exemplo.com/icone.png"
                    )
                    .setValue(
                        config.footerIcone ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        texto
                    ),

                new ActionRowBuilder()
                    .addComponents(
                        icone
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 📍 CANAL
        // =================================================

        if (
            interaction.customId ===
            "embed_canal"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_canal"
                    )
                    .setTitle(
                        "📍 Configurar canal"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "canal"
                    )
                    .setLabel(
                        "ID do canal"
                    )
                    .setStyle(
                        TextInputStyle.Short
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "Ex: 123456789012345678"
                    )
                    .setValue(
                        config.canalId ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🌐 LINKS (título e autor)
        // =================================================

        if (
            interaction.customId ===
            "embed_links"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_links"
                    )
                    .setTitle(
                        "🌐 Links do embed"
                    );

            const campoLink = (
                id,
                label,
                valor
            ) =>
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(id)
                            .setLabel(label)
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(false)
                            .setPlaceholder(
                                "https://..."
                            )
                            .setValue(
                                valor || ""
                            )
                    );

            modal.addComponents(
                campoLink(
                    "titulo_url",
                    "Link do título (clicável)",
                    config.tituloUrl
                ),

                campoLink(
                    "autor_url",
                    "Link do autor (clicável)",
                    config.autorUrl
                )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🧾 CAMPOS
        // =================================================

        if (
            interaction.customId ===
            "embed_campos"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_campos"
                    )
                    .setTitle(
                        "🧾 Campos do embed"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "campos"
                    )
                    .setLabel(
                        "Nome | Valor | sim (lado a lado)"
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(false)
                    .setPlaceholder(
                        "Horário | Seg a Sex, 9h às 18h | sim"
                    )
                    .setMaxLength(4000)
                    .setValue(
                        config.campos ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 💬 MENSAGEM (texto acima do embed)
        // =================================================

        if (
            interaction.customId ===
            "embed_mensagem"
        ) {
            const modal =
                new ModalBuilder()
                    .setCustomId(
                        "embed_modal_mensagem"
                    )
                    .setTitle(
                        "💬 Mensagem acima do embed"
                    );

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        "mensagem"
                    )
                    .setLabel(
                        "Texto (aparece fora do embed)"
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(false)
                    .setMaxLength(2000)
                    .setValue(
                        config.mensagem ||
                        ""
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );

            return interaction.showModal(
                modal
            );
        }

        // =================================================
        // 🕐 TIMESTAMP
        // =================================================

        if (
            interaction.customId ===
            "embed_timestamp"
        ) {
            config.timestamp =
                !config.timestamp;

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 👀 PRÉ-VISUALIZAÇÃO
        // =================================================

        if (
            interaction.customId ===
            "embed_preview"
        ) {
            const resultado =
                criarEmbed(
                    config,
                    interaction.user
                );

            if (!resultado.sucesso) {
                return interaction.reply({
                    content:
                        resultado.erro,
                    ephemeral: true
                });
            }

            return interaction.reply({
                content: (
                    "👀 **Pré-visualização:**" +
                    (
                        config.mensagem
                            ? `\n\n${config.mensagem}`
                            : ""
                    )
                ).slice(0, 2000),
                embeds: [
                    resultado.embed
                ],
                ephemeral: true
            });
        }

        // =================================================
        // 📤 ENVIAR / ATUALIZAR
        // =================================================

        if (
            interaction.customId ===
            "embed_send"
        ) {
            const resultado =
                criarEmbed(
                    config,
                    interaction.user
                );

            if (!resultado.sucesso) {
                return interaction.reply({
                    content:
                        resultado.erro,
                    ephemeral: true
                });
            }

            let canal;

            if (config.canalId) {
                canal =
                    await interaction.guild.channels
                        .fetch(
                            config.canalId
                        )
                        .catch(
                            () => null
                        );
            } else {
                canal =
                    interaction.channel;
            }

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        "❌ O canal configurado não existe ou não é um canal de texto válido.",
                    ephemeral: true
                });
            }

            // =================================================
            // ✏️ ATUALIZAR EXISTENTE
            // =================================================

            if (
                config.editandoEmbedId
            ) {
                const dados =
                    await getEmbedPorId(
                        config.editandoEmbedId,
                        guildId
                    );

                if (!dados) {
                    return interaction.reply({
                        content:
                            "❌ Não encontrei o embed que você estava configurando.",
                        ephemeral: true
                    });
                }

                try {
                    let mensagem = null;
                    let moveu = false;

                    // =========================================
                    // 🔎 PROCURAR MENSAGEM ANTIGA
                    // =========================================

                    if (
                        dados.canal_id &&
                        dados.mensagem_id
                    ) {
                        const canalAntigo =
                            await interaction.guild.channels
                                .fetch(
                                    dados.canal_id
                                )
                                .catch(
                                    () => null
                                );

                        if (
                            canalAntigo &&
                            canalAntigo.isTextBased()
                        ) {
                            mensagem =
                                await canalAntigo.messages
                                    .fetch(
                                        dados.mensagem_id
                                    )
                                    .catch(
                                        () => null
                                    );
                        }
                    }

                    // =========================================
                    // 📦 MUDOU DE CANAL: APAGA A ANTIGA E REENVIA
                    // =========================================

                    if (
                        mensagem &&
                        config.canalId &&
                        mensagem.channel.id !== canal.id
                    ) {
                        await mensagem
                            .delete()
                            .catch(
                                () => {}
                            );

                        mensagem = null;
                        moveu = true;
                    }

                    // =========================================
                    // ✏️ EDITAR MESMA MENSAGEM
                    // =========================================

                    if (mensagem) {
                        await mensagem.edit({
                            content:
                                config.mensagem || null,

                            embeds: [
                                resultado.embed
                            ],
                            components: []
                        });

                        await atualizarEmbedBanco(
                            dados.id,
                            guildId,
                            {
                                config: {
                                    ...config,
                                    editandoEmbedId:
                                        null
                                },

                                canalId:
                                    mensagem.channel.id,

                                mensagemId:
                                    mensagem.id
                            }
                        );

                        await salvarExtras(
                            dados.id,
                            guildId,
                            config
                        );

                        configuracoes.delete(
                            chave
                        );

                        return interaction.update({
                            content:
                                "✅ Embed atualizado com sucesso na mesma mensagem!",
                            embeds: [],
                            components: []
                        });
                    }

                    // =========================================
                    // 🆕 MENSAGEM ANTIGA NÃO EXISTE
                    // =========================================

                    const novaMensagem =
                        await canal.send({
                            content:
                                config.mensagem || undefined,

                            embeds: [
                                resultado.embed
                            ],
                            components: []
                        });

                    await atualizarEmbedBanco(
                        dados.id,
                        guildId,
                        {
                            config: {
                                ...config,
                                editandoEmbedId:
                                    null
                            },

                            canalId:
                                novaMensagem.channel.id,

                            mensagemId:
                                novaMensagem.id
                        }
                    );

                    await salvarExtras(
                        dados.id,
                        guildId,
                        config
                    );

                    configuracoes.delete(
                        chave
                    );

                    return interaction.update({
                        content:
                            moveu
                                ? `✅ Embed movido para <#${novaMensagem.channel.id}>. A mensagem antiga foi apagada.`
                                : "⚠️ A mensagem antiga não foi encontrada. Um novo embed foi enviado.",
                        embeds: [],
                        components: []
                    });

                } catch (erro) {
                    console.error(
                        "❌ Erro ao atualizar embed:",
                        erro
                    );

                    return interaction.reply({
                        content:
                            "❌ Não foi possível atualizar o embed.",
                        ephemeral: true
                    });
                }
            }

            // =================================================
            // 🆕 CRIAR NOVO EMBED
            // =================================================

            try {
                const dadosBanco =
                    await criarEmbedBanco(
                        guildId,
                        interaction.user.id,
                        config
                    );

                const mensagem =
                    await canal.send({
                        content:
                            config.mensagem || undefined,

                        embeds: [
                            resultado.embed
                        ],
                        components: []
                    });

                await salvarMensagemEmbed(
                    dadosBanco.id,
                    canal.id,
                    mensagem.id
                );

                await salvarExtras(
                    dadosBanco.id,
                    guildId,
                    config
                );

                configuracoes.delete(
                    chave
                );

                return interaction.update({
                    content:
                        `✅ Embed enviado com sucesso em <#${canal.id}>!`,
                    embeds: [],
                    components: []
                });

            } catch (erro) {
                console.error(
                    "❌ Erro ao enviar embed:",
                    erro
                );

                return interaction.reply({
                    content:
                        "❌ Não foi possível enviar o embed nesse canal. Verifique as permissões do bot e a conexão com o banco.",
                    ephemeral: true
                });
            }
        }
    },

    // =====================================================
    // 📝 MODAIS
    // =====================================================

    async handleModal(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Este sistema só funciona dentro de servidores.",
                ephemeral: true
            });
        }

        if (!isAdmin(interaction)) {
            return interaction.reply({
                content:
                    "❌ Somente administradores podem alterar embeds.",
                ephemeral: true
            });
        }

        const userId =
            interaction.user.id;

        const guildId =
            interaction.guild.id;

        const chave =
            chaveConfiguracao(
                userId,
                guildId
            );

        const config =
            configuracoes.get(
                chave
            );

        if (!config) {
            return interaction.reply({
                content:
                    "❌ Sua configuração de embed expirou. Use `/embed` novamente.",
                ephemeral: true
            });
        }

        // =================================================
        // 📝 TÍTULO
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_titulo"
        ) {
            config.titulo =
                interaction.fields
                    .getTextInputValue(
                        "titulo"
                    )
                    .trim();

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 📄 DESCRIÇÃO
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_descricao"
        ) {
            config.descricao =
                interaction.fields
                    .getTextInputValue(
                        "descricao"
                    )
                    .trim();

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 🖼️ IMAGEM
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_imagem"
        ) {
            const imagem =
                interaction.fields
                    .getTextInputValue(
                        "imagem"
                    )
                    .trim();

            if (
                imagem &&
                !validarURL(imagem)
            ) {
                return interaction.reply({
                    content:
                        "❌ URL da imagem inválida.",
                    ephemeral: true
                });
            }

            config.imagem =
                imagem;

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 🔗 THUMBNAIL
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_thumbnail"
        ) {
            const thumbnail =
                interaction.fields
                    .getTextInputValue(
                        "thumbnail"
                    )
                    .trim();

            if (
                thumbnail &&
                !validarURL(thumbnail)
            ) {
                return interaction.reply({
                    content:
                        "❌ URL da thumbnail inválida.",
                    ephemeral: true
                });
            }

            config.thumbnail =
                thumbnail;

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 🎨 COR
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_cor"
        ) {
            const cor =
                interaction.fields
                    .getTextInputValue(
                        "cor"
                    )
                    .trim();

            if (
                cor &&
                !/^#[0-9A-Fa-f]{6}$/.test(
                    cor
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Cor inválida! Use o formato `#5865F2`.",
                    ephemeral: true
                });
            }

            config.cor =
                cor ||
                "#5865F2";

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 👤 AUTOR
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_autor"
        ) {
            const autor =
                interaction.fields
                    .getTextInputValue(
                        "autor"
                    )
                    .trim();

            const autorIcone =
                interaction.fields
                    .getTextInputValue(
                        "autor_icone"
                    )
                    .trim();

            if (
                autorIcone &&
                !validarURL(
                    autorIcone
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ URL do ícone do autor inválida.",
                    ephemeral: true
                });
            }

            config.autor =
                autor;

            config.autorIcone =
                autorIcone;

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 📝 RODAPÉ
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_footer"
        ) {
            const footer =
                interaction.fields
                    .getTextInputValue(
                        "footer"
                    )
                    .trim();

            const footerIcone =
                interaction.fields
                    .getTextInputValue(
                        "footer_icone"
                    )
                    .trim();

            if (
                footerIcone &&
                !validarURL(
                    footerIcone
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ URL do ícone do rodapé inválida.",
                    ephemeral: true
                });
            }

            config.footer =
                footer;

            config.footerIcone =
                footerIcone;

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 📍 CANAL
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_canal"
        ) {
            const canalId =
                interaction.fields
                    .getTextInputValue(
                        "canal"
                    )
                    .trim();

            if (!canalId) {
                config.canalId =
                    "";

                return atualizarPainelEmbed(
                    interaction,
                    config
                );
            }

            const canal =
                await interaction.guild.channels
                    .fetch(
                        canalId
                    )
                    .catch(
                        () => null
                    );

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        "❌ Canal inválido. Coloque o ID de um canal de texto deste servidor.",
                    ephemeral: true
                });
            }

            config.canalId =
                canal.id;

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 🌐 LINKS
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_links"
        ) {
            const tituloUrl =
                interaction.fields
                    .getTextInputValue(
                        "titulo_url"
                    )
                    .trim();

            const autorUrl =
                interaction.fields
                    .getTextInputValue(
                        "autor_url"
                    )
                    .trim();

            if (
                (tituloUrl && !validarURL(tituloUrl)) ||
                (autorUrl && !validarURL(autorUrl))
            ) {
                return interaction.reply({
                    content:
                        "❌ Link inválido. Use um endereço que comece com http:// ou https://",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            config.tituloUrl =
                tituloUrl;

            config.autorUrl =
                autorUrl;

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 🧾 CAMPOS
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_campos"
        ) {
            // Guarda já normalizado: só o que foi aceito de verdade
            config.campos =
                camposParaTexto(
                    textoParaCampos(
                        interaction.fields
                            .getTextInputValue(
                                "campos"
                            )
                    )
                );

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }

        // =================================================
        // 💬 MENSAGEM
        // =================================================

        if (
            interaction.customId ===
            "embed_modal_mensagem"
        ) {
            config.mensagem =
                interaction.fields
                    .getTextInputValue(
                        "mensagem"
                    )
                    .trim();

            return atualizarPainelEmbed(
                interaction,
                config
            );
        }
    }
};
