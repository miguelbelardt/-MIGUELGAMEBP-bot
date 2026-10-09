const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder
} = require("discord.js");

const {
    getJoinConfig,
    salvarJoinConfig,
    atualizarCanalJoin,
    mysqlPool
} = require("../database/database");

// =====================================================
// 🔄 SUBSTITUIR VARIÁVEIS
// =====================================================

function substituirVariaveis(texto, dados) {
    if (
        texto === null ||
        texto === undefined
    ) {
        return "";
    }

    return String(texto)
        .replace(/\{user\}/gi, dados.user)
        .replace(/\{username\}/gi, dados.username)
        .replace(/\{userid\}/gi, dados.userid)
        .replace(/\{avatar\}/gi, dados.avatar)
        .replace(/\{banner\}/gi, dados.banner || "")
        .replace(/\{members\}/gi, String(dados.members))
        .replace(/\{server\}/gi, dados.server);
}

// =====================================================
// 🧹 VERIFICAR URL
// =====================================================

function urlValida(url) {
    if (
        !url ||
        typeof url !== "string"
    ) {
        return false;
    }

    return (
        url.startsWith("http://") ||
        url.startsWith("https://")
    );
}

// =====================================================
// 🔢 CONVERTER COR
// =====================================================

function converterCor(cor) {
    if (typeof cor === "number") {
        return cor;
    }

    if (typeof cor === "string") {
        const valor = cor.trim();

        if (valor.startsWith("0x")) {
            const numero = Number.parseInt(
                valor,
                16
            );

            if (!Number.isNaN(numero)) {
                return numero;
            }
        }

        if (valor.startsWith("#")) {
            const numero = Number.parseInt(
                valor.slice(1),
                16
            );

            if (!Number.isNaN(numero)) {
                return numero;
            }
        }

        const numero = Number(valor);

        if (!Number.isNaN(numero)) {
            return numero;
        }
    }

    return 0x5865F2;
}

// =====================================================
// 🔘 VERIFICAR BOOLEAN
// =====================================================

function estaAtivado(valor) {
    return (
        valor === true ||
        valor === 1 ||
        valor === "1" ||
        valor === "true"
    );
}

// =====================================================
// 🔘 LER "SIM/NÃO" DIGITADO (aceita variações)
// =====================================================

function lerSimNao(texto, padrao = true) {
    const valor =
        String(texto ?? "")
            .trim()
            .toLowerCase();

    if (!valor) {
        return padrao;
    }

    return !/^(n|nao|não|no|off|0|false|desativado|desligado)$/.test(
        valor
    );
}

// =====================================================
// 🔗 LINKS
// =====================================================

function validarURL(url) {
    try {
        const resultado = new URL(url);

        return (
            resultado.protocol === "http:" ||
            resultado.protocol === "https:"
        );
    } catch {
        return false;
    }
}

// Ícones e imagens aceitam link ou as variáveis {avatar} / {banner}
function urlOuVariavel(valor) {
    return (
        !valor ||
        validarURL(valor) ||
        /^\{(avatar|banner)\}$/i.test(valor)
    );
}

// =====================================================
// 🧾 CAMPOS DO EMBED
// =====================================================

// Uma linha por campo:  Nome | Valor | sim   (sim = lado a lado)
// Use \n dentro do valor para quebrar linha. Aceita variáveis.

const MAX_CAMPOS_JOIN = 10;

function textoParaCampos(texto) {
    if (!texto || typeof texto !== "string") {
        return [];
    }

    const campos = [];

    for (const linha of texto.split("\n")) {
        if (campos.length >= MAX_CAMPOS_JOIN) {
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
// 💾 COLUNAS EXTRAS (link do título, link do autor, campos)
// =====================================================

// O database.js não conhece essas colunas: o próprio join.js
// cria (se faltarem) e salva depois do save normal.

let promessaColunasExtras = null;

function garantirColunasExtrasJoin() {
    if (!promessaColunasExtras) {
        promessaColunasExtras = (async () => {
            const [colunas] = await mysqlPool.query(
                "SHOW COLUMNS FROM join_config"
            );

            const existentes = colunas.map(
                coluna => coluna.Field
            );

            const extras = {
                titulo_url: "TEXT",
                autor_url: "TEXT",
                campos: "TEXT"
            };

            for (const [coluna, definicao] of Object.entries(extras)) {
                if (!existentes.includes(coluna)) {
                    await mysqlPool.query(
                        `ALTER TABLE join_config ADD COLUMN ${coluna} ${definicao}`
                    );
                }
            }
        })().catch(erro => {
            promessaColunasExtras = null;

            console.error(
                "❌ Erro ao preparar colunas extras do join:",
                erro
            );
        });
    }

    return promessaColunasExtras;
}

async function salvarExtrasJoin(guildId, extras) {
    try {
        await garantirColunasExtrasJoin();

        const permitidas = [
            "titulo_url",
            "autor_url",
            "campos"
        ];

        const colunas =
            Object.keys(extras).filter(
                coluna => permitidas.includes(coluna)
            );

        if (!colunas.length) {
            return;
        }

        await mysqlPool.query(
            `
            UPDATE join_config
            SET ${colunas.map(coluna => `${coluna} = ?`).join(", ")}
            WHERE guild_id = ?
            `,
            [
                ...colunas.map(
                    coluna => extras[coluna] || null
                ),
                guildId
            ]
        );
    } catch (erro) {
        console.error(
            "❌ Erro ao salvar dados extras do join:",
            erro
        );
    }
}

// =====================================================
// 👤 PEGAR DADOS DO USUÁRIO
// =====================================================

async function pegarDadosMembro(membro) {
    let usuario = membro.user;

    try {
        usuario = await membro.user.fetch();
    } catch (erro) {
        console.warn(
            "⚠️ Não foi possível atualizar os dados do usuário:",
            erro
        );
    }

    const avatar =
        usuario.displayAvatarURL({
            extension: "png",
            size: 1024
        });

    let banner = "";

    if (usuario.banner) {
        banner =
            usuario.bannerURL({
                extension: "png",
                size: 2048
            }) || "";
    }

    return {
        user: `<@${membro.id}>`,
        username: usuario.username,
        userid: membro.id,
        avatar,
        banner,
        members: membro.guild.memberCount,
        server: membro.guild.name
    };
}

// =====================================================
// 🎨 CRIAR EMBED
// =====================================================

function criarEmbedBoasVindas(
    configBanco,
    dados
) {
    if (
        !estaAtivado(
            configBanco.embed_habilitado
        )
    ) {
        return null;
    }

    const embed =
        new EmbedBuilder();

    // =================================================
    // 📝 TÍTULO
    // =================================================

    if (configBanco.embed_titulo) {
        const titulo =
            substituirVariaveis(
                configBanco.embed_titulo,
                dados
            );

        if (titulo) {
            embed.setTitle(titulo);

            const tituloUrl =
                substituirVariaveis(
                    configBanco.titulo_url,
                    dados
                );

            if (validarURL(tituloUrl)) {
                embed.setURL(tituloUrl);
            }
        }
    }

    // =================================================
    // 📄 DESCRIÇÃO
    // =================================================

    if (configBanco.embed_descricao) {
        const descricao =
            substituirVariaveis(
                configBanco.embed_descricao,
                dados
            );

        if (descricao) {
            embed.setDescription(
                descricao
            );
        }
    }

    // =================================================
    // 🎨 COR
    // =================================================

    if (
        configBanco.embed_cor !== null &&
        configBanco.embed_cor !== undefined &&
        configBanco.embed_cor !== ""
    ) {
        embed.setColor(
            converterCor(
                configBanco.embed_cor
            )
        );
    }

    // =================================================
    // 👤 AUTOR
    // =================================================

    if (
        estaAtivado(
            configBanco.autor_habilitado
        )
    ) {
        const nomeAutor =
            substituirVariaveis(
                configBanco.autor_nome,
                dados
            );

        const iconeAutor =
            substituirVariaveis(
                configBanco.autor_icone,
                dados
            );

        if (nomeAutor) {
            const autor = {
                name: nomeAutor
            };

            if (
                urlValida(
                    iconeAutor
                )
            ) {
                autor.iconURL =
                    iconeAutor;
            }

            const autorUrl =
                substituirVariaveis(
                    configBanco.autor_url,
                    dados
                );

            if (validarURL(autorUrl)) {
                autor.url =
                    autorUrl;
            }

            embed.setAuthor(autor);
        }
    }

    // =================================================
    // 🖼️ THUMBNAIL
    // =================================================

    if (configBanco.thumbnail) {
        const thumbnail =
            substituirVariaveis(
                configBanco.thumbnail,
                dados
            );

        if (
            urlValida(thumbnail)
        ) {
            embed.setThumbnail(
                thumbnail
            );
        }
    }

    // =================================================
    // 🖼️ IMAGEM
    // =================================================

    if (configBanco.imagem) {
        const imagem =
            substituirVariaveis(
                configBanco.imagem,
                dados
            );

        if (
            urlValida(imagem)
        ) {
            embed.setImage(imagem);
        }
    }

    // =================================================
    // 📌 RODAPÉ
    // =================================================

    if (
        estaAtivado(
            configBanco.footer_habilitado
        )
    ) {
        const textoFooter =
            substituirVariaveis(
                configBanco.footer_texto,
                dados
            );

        const iconeFooter =
            substituirVariaveis(
                configBanco.footer_icone,
                dados
            );

        const footer = {
            text:
                textoFooter ||
                "Massa Com Chika"
        };

        if (
            urlValida(
                iconeFooter
            )
        ) {
            footer.iconURL =
                iconeFooter;
        }

        embed.setFooter(footer);
    }

    // =================================================
    // 🧾 CAMPOS
    // =================================================

    const campos =
        textoParaCampos(
            configBanco.campos
        )
            .map(campo => ({
                name:
                    substituirVariaveis(
                        campo.name,
                        dados
                    ).slice(0, 256),

                value:
                    substituirVariaveis(
                        campo.value,
                        dados
                    ).slice(0, 1024),

                inline:
                    campo.inline
            }))
            .filter(
                campo =>
                    campo.name &&
                    campo.value
            );

    if (campos.length) {
        embed.addFields(
            campos
        );
    }

    // =================================================
    // ⏰ TIMESTAMP
    // =================================================

    if (
        estaAtivado(
            configBanco.timestamp
        )
    ) {
        embed.setTimestamp();
    }

    return embed;
}

// =====================================================
// 👋 ENVIAR BOAS-VINDAS
// =====================================================

async function enviarBoasVindas(membro) {
    try {
        if (
            !membro ||
            !membro.guild
        ) {
            return;
        }

        const guild =
            membro.guild;

        let configBanco = null;

        try {
            configBanco =
                await getJoinConfig(
                    guild.id
                );
        } catch (erro) {
            console.error(
                "❌ Erro ao buscar configuração de boas-vindas no banco:",
                erro
            );

            return;
        }

        if (!configBanco) {
            console.log(
                `⚠️ Sistema de boas-vindas não configurado para ${guild.name}.`
            );

            return;
        }

        if (
            !estaAtivado(
                configBanco.habilitado
            )
        ) {
            return;
        }

        const canalId =
            configBanco.canal_id;

        if (!canalId) {
            console.log(
                `⚠️ Canal de boas-vindas não configurado em ${guild.name}.`
            );

            return;
        }

        const canal =
            guild.channels.cache.get(
                canalId
            );

        if (!canal) {
            console.error(
                `❌ Canal de boas-vindas não encontrado: ${canalId}`
            );

            return;
        }

        if (!canal.isTextBased()) {
            console.error(
                `❌ O canal configurado para boas-vindas não é de texto: ${canalId}`
            );

            return;
        }

        const dados =
            await pegarDadosMembro(
                membro
            );

        const embed =
            criarEmbedBoasVindas(
                configBanco,
                dados
            );

        const mensagem = {};

        if (
            configBanco.content !== null &&
            configBanco.content !== undefined &&
            configBanco.content !== ""
        ) {
            mensagem.content =
                substituirVariaveis(
                    configBanco.content,
                    dados
                );
        }

        if (embed) {
            mensagem.embeds = [
                embed
            ];
        }

        if (
            !mensagem.content &&
            !mensagem.embeds
        ) {
            console.warn(
                `⚠️ A configuração de boas-vindas de ${guild.name} não possui conteúdo para enviar.`
            );

            return;
        }

        await canal.send(
            mensagem
        );

        console.log(
            `👋 Boas-vindas enviadas para ${membro.user.tag} em ${guild.name}`
        );

    } catch (erro) {
        console.error(
            "❌ Erro ao enviar mensagem de boas-vindas:",
            erro
        );
    }
}

// =====================================================
// 🧪 GERAR DADOS DE TESTE
// =====================================================

async function pegarDadosTeste(interaction) {
    const usuario =
        interaction.user;

    let banner = "";

    try {
        const usuarioAtualizado =
            await usuario.fetch();

        if (
            usuarioAtualizado.banner
        ) {
            banner =
                usuarioAtualizado.bannerURL({
                    extension: "png",
                    size: 2048
                }) || "";
        }
    } catch (erro) {
        console.warn(
            "⚠️ Não foi possível obter o banner no teste:",
            erro
        );
    }

    return {
        user:
            `<@${interaction.user.id}>`,
        username:
            interaction.user.username,
        userid:
            interaction.user.id,
        avatar:
            interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024
            }),
        banner,
        members:
            interaction.guild.memberCount,
        server:
            interaction.guild.name
    };
}

// =====================================================
// 🧩 PAINEL DE CONFIGURAÇÃO
// =====================================================

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

function criarPainelJoin(
    config = {},
    previa = null,
    textoMensagem = ""
) {
    const qtdCampos =
        textoParaCampos(
            config.campos
        ).length;

    const estado = valor =>
        estaAtivado(valor)
            ? "🟢 Ativado"
            : "🔴 Desativado";

    const embed =
        new EmbedBuilder()
            .setTitle("👋 Configuração de Boas-vindas")
            .setDescription(
                "Use os botões abaixo para configurar o sistema de boas-vindas.\n\n" +
                "📝 **Mensagem**, 🎨 **Embed**, 👤 **Autor**, 🖼️ **Imagens**, 📌 **Rodapé** e 🧾 **Campos** abrem formulários.\n" +
                "Os botões **ON/OFF** ligam e desligam cada parte do embed.\n\n" +
                "Variáveis: `{user}` `{username}` `{userid}` `{avatar}` `{banner}` `{members}` `{server}`"
            )
            .setColor(
                converterCor(
                    config.embed_cor
                )
            )
            .addFields(
                {
                    name: "⚙️ Sistema",
                    value: estado(config.habilitado),
                    inline: true
                },
                {
                    name: "🎨 Embed",
                    value: estado(config.embed_habilitado),
                    inline: true
                },
                {
                    name: "📢 Canal",
                    value:
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "❌ Não configurado",
                    inline: true
                },
                {
                    name: "👤 Autor",
                    value: estado(config.autor_habilitado),
                    inline: true
                },
                {
                    name: "📌 Rodapé",
                    value: estado(config.footer_habilitado),
                    inline: true
                },
                {
                    name: "⏰ Horário",
                    value: estado(config.timestamp),
                    inline: true
                },
                {
                    name: "🧾 Campos",
                    value:
                        qtdCampos
                            ? `${qtdCampos} campo(s)`
                            : "Nenhum",
                    inline: true
                },
                {
                    name: "🔗 Link do título",
                    value:
                        config.titulo_url
                            ? "✅ Definido"
                            : "❌ Nenhum",
                    inline: true
                }
            );

    const canalSelect =
        new ChannelSelectMenuBuilder()
            .setCustomId(
                "join_config_canal"
            )
            .setPlaceholder(
                "📢 Selecione o canal de boas-vindas"
            )
            .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
            );

    const rowCanal =
        new ActionRowBuilder()
            .addComponents(
                canalSelect
            );

    const botao = (
        id,
        label,
        emoji,
        estilo = ButtonStyle.Primary
    ) =>
        new ButtonBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setEmoji(emoji)
            .setStyle(estilo);

    const alternar = (
        id,
        nome,
        emoji,
        valor
    ) =>
        botao(
            id,
            `${nome}: ${estaAtivado(valor) ? "ON" : "OFF"}`,
            emoji,
            estaAtivado(valor)
                ? ButtonStyle.Success
                : ButtonStyle.Secondary
        );

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                botao("join_config_mensagem", "Mensagem", "📝"),
                botao("join_config_embed", "Embed", "🎨"),
                botao("join_config_autor", "Autor", "👤"),
                botao("join_config_imagens", "Imagens", "🖼️"),
                botao("join_config_footer", "Rodapé", "📌")
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                botao(
                    "join_config_campos",
                    "Campos",
                    "🧾",
                    ButtonStyle.Primary
                ),
                alternar("join_toggle_embed", "Embed", "🎨", config.embed_habilitado),
                alternar("join_toggle_autor", "Autor", "👤", config.autor_habilitado),
                alternar("join_toggle_footer", "Rodapé", "📌", config.footer_habilitado),
                alternar("join_toggle_timestamp", "Horário", "⏰", config.timestamp)
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                botao("join_config_ativar", "Ativar", "🟢", ButtonStyle.Success),
                botao("join_config_desativar", "Desativar", "🔴", ButtonStyle.Danger),
                botao("join_config_status", "Status", "📊", ButtonStyle.Secondary),
                botao("join_config_teste", "Testar", "🧪", ButtonStyle.Success),
                botao("join_config_fechar", "Fechar", "❌", ButtonStyle.Danger)
            );

    return {
        content: textoMensagem,
        embeds:
            previa
                ? [previa, embed]
                : [embed],
        components: [
            rowCanal,
            row1,
            row2,
            row3
        ]
    };
}

// Monta o painel com a prévia ao vivo do embed (dados do próprio
// administrador no lugar do novo membro) e o texto da mensagem.
async function montarPainelJoin(
    interaction,
    config = {}
) {
    let previa = null;
    let textoMensagem = "";

    try {
        const dados =
            await pegarDadosTeste(
                interaction
            );

        const embedPrevia =
            criarEmbedBoasVindas(
                config,
                dados
            );

        // Soma de todos os embeds da mensagem: máx. 6000 caracteres
        if (
            embedPrevia &&
            tamanhoEmbed(embedPrevia) <= 4500
        ) {
            previa = embedPrevia;
        }

        if (config.content) {
            textoMensagem =
                (
                    "📝 **Mensagem de boas-vindas:**\n" +
                    substituirVariaveis(
                        config.content,
                        dados
                    )
                ).slice(0, 1900);
        }
    } catch (erro) {
        console.error(
            "⚠️ Prévia do painel ignorada:",
            erro.message
        );
    }

    return criarPainelJoin(
        config,
        previa,
        textoMensagem
    );
}

// Atualiza o painel NO LUGAR (botão/menu/modal do painel) em vez de
// mandar uma mensagem solta de confirmação.
async function responderPainelJoin(
    interaction
) {
    const config =
        (
            await getJoinConfig(
                interaction.guild.id
            )
        ) || {};

    const painel =
        await montarPainelJoin(
            interaction,
            config
        );

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
        );

    if (doPainel) {
        await interaction.update(
            painel
        );
    } else {
        await interaction.reply({
            ...painel,
            flags:
                MessageFlags.Ephemeral
        });
    }

    return true;
}

// =====================================================
// 📝 MODAL - MENSAGEM
// =====================================================

function criarModalMensagem(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_mensagem"
            )
            .setTitle(
                "📝 Mensagem de boas-vindas"
            );

    const content =
        new TextInputBuilder()
            .setCustomId("content")
            .setLabel("Content da mensagem")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder(
                "Ex.: 👋 Seja bem-vindo(a), {user}!"
            )
            .setValue(
                config.content || ""
            )
            .setMaxLength(2000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(content)
    );

    return modal;
}

// =====================================================
// 🎨 MODAL - EMBED
// =====================================================

function criarModalEmbed(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_embed"
            )
            .setTitle(
                "🎨 Configuração do Embed"
            );

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config.embed_titulo ?? ""
                )
            )
            .setMaxLength(256);

    const descricao =
        new TextInputBuilder()
            .setCustomId("descricao")
            .setLabel("Descrição")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue(
                String(
                    config.embed_descricao ?? ""
                )
            )
            .setMaxLength(4000);

    const cor =
        new TextInputBuilder()
            .setCustomId("cor")
            .setLabel(
                "Cor (#5865F2, 0x5865F2 ou número)"
            )
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config.embed_cor ?? "#5865F2"
                )
            )
            .setMaxLength(20);

    const tituloUrl =
        new TextInputBuilder()
            .setCustomId("titulo_url")
            .setLabel("Link do título (clicável)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("https://...")
            .setValue(
                config.titulo_url || ""
            )
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(titulo),

        new ActionRowBuilder()
            .addComponents(descricao),

        new ActionRowBuilder()
            .addComponents(cor),

        new ActionRowBuilder()
            .addComponents(tituloUrl)
    );

    return modal;
}

// =====================================================
// 👤 MODAL - AUTOR
// =====================================================

function criarModalAutor(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_autor"
            )
            .setTitle(
                "👤 Configuração do Autor"
            );

    const nome =
        new TextInputBuilder()
            .setCustomId("nome")
            .setLabel("Nome do autor")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.autor_nome || ""
            )
            .setMaxLength(256);

    const icone =
        new TextInputBuilder()
            .setCustomId("icone")
            .setLabel("Ícone do autor (link ou {avatar})")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.autor_icone || ""
            )
            .setMaxLength(1000);

    const autorUrl =
        new TextInputBuilder()
            .setCustomId("autor_url")
            .setLabel("Link do autor (clicável)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("https://...")
            .setValue(
                config.autor_url || ""
            )
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(nome),

        new ActionRowBuilder()
            .addComponents(icone),

        new ActionRowBuilder()
            .addComponents(autorUrl)
    );

    return modal;
}

// =====================================================
// 🖼️ MODAL - IMAGENS
// =====================================================

function criarModalImagens(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_imagens"
            )
            .setTitle(
                "🖼️ Imagens"
            );

    const thumbnail =
        new TextInputBuilder()
            .setCustomId("thumbnail")
            .setLabel("Thumbnail / URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.thumbnail || ""
            )
            .setMaxLength(1000);

    const imagem =
        new TextInputBuilder()
            .setCustomId("imagem")
            .setLabel("Imagem grande / URL")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.imagem || ""
            )
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(thumbnail),

        new ActionRowBuilder()
            .addComponents(imagem)
    );

    return modal;
}

// =====================================================
// 📌 MODAL - RODAPÉ
// =====================================================

function criarModalFooter(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_footer"
            )
            .setTitle(
                "📌 Configuração do Rodapé"
            );

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto do rodapé")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.footer_texto || ""
            )
            .setMaxLength(2048);

    const icone =
        new TextInputBuilder()
            .setCustomId("icone")
            .setLabel("Ícone do rodapé (link ou {avatar})")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                config.footer_icone || ""
            )
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(texto),

        new ActionRowBuilder()
            .addComponents(icone)
    );

    return modal;
}

// =====================================================
// 🧾 MODAL - CAMPOS
// =====================================================

function criarModalCampos(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_campos"
            )
            .setTitle(
                "🧾 Campos do embed"
            );

    const campos =
        new TextInputBuilder()
            .setCustomId("campos")
            .setLabel(
                `Nome | Valor | sim (lado a lado) — máx. ${MAX_CAMPOS_JOIN}`
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder(
                "Membro | #{members} | sim"
            )
            .setValue(
                config.campos || ""
            )
            .setMaxLength(4000);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(campos)
    );

    return modal;
}

// =====================================================
// ⚙️ MODAL - OPÇÕES
// =====================================================

function criarModalOpcoes(config) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                "join_modal_opcoes"
            )
            .setTitle(
                "⚙️ Opções do Join"
            );

    const embed =
        new TextInputBuilder()
            .setCustomId("embed_habilitado")
            .setLabel("Embed ativado? (sim/não)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config.embed_habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(5);

    const timestamp =
        new TextInputBuilder()
            .setCustomId("timestamp")
            .setLabel("Timestamp ativado? (sim/não)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config.timestamp
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(5);

    const sistema =
        new TextInputBuilder()
            .setCustomId("habilitado")
            .setLabel("Sistema ativado? (sim/não)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config.habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(5);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(embed),

        new ActionRowBuilder()
            .addComponents(timestamp),

        new ActionRowBuilder()
            .addComponents(sistema)
    );

    return modal;
}

// =====================================================
// 📊 STATUS
// =====================================================

async function enviarStatusJoin(interaction) {
    const config =
        await getJoinConfig(
            interaction.guild.id
        );

    if (!config) {
        await interaction.reply({
            content:
                "⚠️ O sistema ainda não possui uma configuração salva.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    const embed =
        new EmbedBuilder()
            .setTitle(
                "📊 Status do sistema de boas-vindas"
            )
            .setColor(
                converterCor(
                    config.embed_cor
                )
            )
            .addFields(
                {
                    name: "📢 Canal",
                    value:
                        config.canal_id
                            ? `<#${config.canal_id}>`
                            : "❌ Não configurado",
                    inline: true
                },
                {
                    name: "⚙️ Sistema",
                    value:
                        estaAtivado(
                            config.habilitado
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "🎨 Embed",
                    value:
                        estaAtivado(
                            config.embed_habilitado
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "👤 Autor",
                    value:
                        estaAtivado(
                            config.autor_habilitado
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "📌 Rodapé",
                    value:
                        estaAtivado(
                            config.footer_habilitado
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                },
                {
                    name: "⏰ Timestamp",
                    value:
                        estaAtivado(
                            config.timestamp
                        )
                            ? "🟢 Ativado"
                            : "🔴 Desativado",
                    inline: true
                }
            );

    await interaction.reply({
        embeds: [embed],
        flags:
            MessageFlags.Ephemeral
    });
}

// =====================================================
// 🧪 TESTAR JOIN
// =====================================================

async function testarJoin(interaction) {
    const config =
        await getJoinConfig(
            interaction.guild.id
        );

    if (!config) {
        await interaction.reply({
            content:
                "⚠️ Configure o sistema primeiro.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    if (!config.canal_id) {
        await interaction.reply({
            content:
                "⚠️ Nenhum canal de boas-vindas foi configurado.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    const canal =
        interaction.guild.channels.cache.get(
            config.canal_id
        );

    if (!canal || !canal.isTextBased()) {
        await interaction.reply({
            content:
                "❌ O canal configurado não foi encontrado ou não é um canal de texto.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    const dados =
        await pegarDadosTeste(
            interaction
        );

    const embed =
        criarEmbedBoasVindas(
            config,
            dados
        );

    const mensagem = {};

    if (
        config.content !== null &&
        config.content !== undefined &&
        config.content !== ""
    ) {
        mensagem.content =
            substituirVariaveis(
                config.content,
                dados
            );
    }

    if (embed) {
        mensagem.embeds = [
            embed
        ];
    }

    if (
        !mensagem.content &&
        !mensagem.embeds
    ) {
        await interaction.reply({
            content:
                "⚠️ Não há conteúdo configurado para testar.",
            flags:
                MessageFlags.Ephemeral
        });

        return;
    }

    await canal.send(
        mensagem
    );

    await interaction.reply({
        content:
            `✅ Mensagem de teste enviada em ${canal}.`,
        flags:
            MessageFlags.Ephemeral
    });
}

// =====================================================
// ⚙️ COMANDO /JOIN
// =====================================================

const data =
    new SlashCommandBuilder()
        .setName("join")
        .setDescription(
            "Configura o sistema de boas-vindas"
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
        .setDMPermission(false)

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("configurar")
                    .setDescription(
                        "Abre o painel de configuração do Join"
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("ativar")
                    .setDescription(
                        "Ativa o sistema de boas-vindas"
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("desativar")
                    .setDescription(
                        "Desativa o sistema de boas-vindas"
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("status")
                    .setDescription(
                        "Mostra a configuração atual"
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("teste")
                    .setDescription(
                        "Envia uma mensagem de teste"
                    )
        );

// =====================================================
// ⚡ EXECUTAR COMANDO
// =====================================================

async function execute(interaction) {
    try {
        const subcomando =
            interaction.options.getSubcommand();

        const guildId =
            interaction.guild.id;

        // =================================================
        // 🧩 PAINEL
        // =================================================

        if (
            subcomando ===
            "configurar"
        ) {
            let config =
                await getJoinConfig(
                    guildId
                );

            if (!config) {
                config =
                    await salvarJoinConfig(
                        guildId,
                        {}
                    );
            }

            await garantirColunasExtrasJoin();

            config =
                await getJoinConfig(
                    guildId
                );

            await interaction.reply({
                ...(
                    await montarPainelJoin(
                        interaction,
                        config || {}
                    )
                ),
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // =================================================
        // 🟢 ATIVAR
        // =================================================

        if (
            subcomando ===
            "ativar"
        ) {
            const configAtual =
                await getJoinConfig(
                    guildId
                );

            await salvarJoinConfig(
                guildId,
                {
                    ...(configAtual || {}),
                    habilitado: true
                }
            );

            await interaction.reply({
                content:
                    "✅ Sistema de boas-vindas ativado!",
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // =================================================
        // 🔴 DESATIVAR
        // =================================================

        if (
            subcomando ===
            "desativar"
        ) {
            const configAtual =
                await getJoinConfig(
                    guildId
                );

            await salvarJoinConfig(
                guildId,
                {
                    ...(configAtual || {}),
                    habilitado: false
                }
            );

            await interaction.reply({
                content:
                    "🔴 Sistema de boas-vindas desativado!",
                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        // =================================================
        // 📊 STATUS
        // =================================================

        if (
            subcomando ===
            "status"
        ) {
            await enviarStatusJoin(
                interaction
            );

            return;
        }

        // =================================================
        // 🧪 TESTE
        // =================================================

        if (
            subcomando ===
            "teste"
        ) {
            await testarJoin(
                interaction
            );

            return;
        }

    } catch (erro) {
        console.error(
            "❌ Erro no comando /join:",
            erro
        );

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            await interaction.followUp({
                content:
                    "❌ Ocorreu um erro ao executar o comando.",
                flags:
                    MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({
                content:
                    "❌ Ocorreu um erro ao executar o comando.",
                flags:
                    MessageFlags.Ephemeral
            });
        }
    }
}

// =====================================================
// 🖱️ TRATAR INTERAÇÕES DO PAINEL
// =====================================================

async function tratarInteracao(interaction) {
    if (
        !interaction.guild
    ) {
        return false;
    }

    // Segurança extra
    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        if (
            interaction.isButton() ||
            interaction.isChannelSelectMenu()
        ) {
            await interaction.reply({
                content:
                    "❌ Você não possui permissão para configurar o sistema de boas-vindas.",
                flags:
                    MessageFlags.Ephemeral
            });
        } else if (
            interaction.isModalSubmit()
        ) {
            await interaction.reply({
                content:
                    "❌ Você não possui permissão para configurar o sistema de boas-vindas.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    const id =
        interaction.customId || "";

    await garantirColunasExtrasJoin();

    // =================================================
    // 📢 SELECIONAR CANAL
    // =================================================

    if (
        interaction.isChannelSelectMenu() &&
        id === "join_config_canal"
    ) {
        const canal =
            interaction.channels.first();

        if (!canal) {
            await interaction.reply({
                content:
                    "❌ Nenhum canal foi selecionado.",
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await atualizarCanalJoin(
            interaction.guild.id,
            canal.id
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 📝 MENSAGEM
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_mensagem"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalMensagem(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 🎨 EMBED
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_embed"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalEmbed(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 👤 AUTOR
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_autor"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalAutor(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 🖼️ IMAGENS
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_imagens"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalImagens(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 📌 FOOTER
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_footer"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalFooter(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // ⚙️ OPÇÕES
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_opcoes"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalOpcoes(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 🧾 CAMPOS
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_campos"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await interaction.showModal(
            criarModalCampos(
                config || {}
            )
        );

        return true;
    }

    // =================================================
    // 🔘 LIGAR / DESLIGAR PARTES DO EMBED
    // =================================================

    const alternadores = {
        join_toggle_embed: "embed_habilitado",
        join_toggle_autor: "autor_habilitado",
        join_toggle_footer: "footer_habilitado",
        join_toggle_timestamp: "timestamp"
    };

    if (
        interaction.isButton() &&
        alternadores[id]
    ) {
        const campo =
            alternadores[id];

        const config =
            (
                await getJoinConfig(
                    interaction.guild.id
                )
            ) || {};

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...config,
                [campo]:
                    !estaAtivado(
                        config[campo]
                    )
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 🟢 ATIVAR PELO PAINEL
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_ativar"
    ) {
        const configAtual =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(configAtual || {}),
                habilitado: true
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 🔴 DESATIVAR PELO PAINEL
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_desativar"
    ) {
        const configAtual =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(configAtual || {}),
                habilitado: false
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 📊 STATUS
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_status"
    ) {
        await enviarStatusJoin(
            interaction
        );

        return true;
    }

    // =================================================
    // 🧪 TESTE
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_teste"
    ) {
        await testarJoin(
            interaction
        );

        return true;
    }

    // =================================================
    // ❌ FECHAR
    // =================================================

    if (
        interaction.isButton() &&
        id === "join_config_fechar"
    ) {
        await interaction.update({
            content:
                "✅ Painel de configuração fechado.",
            embeds: [],
            components: []
        });

        return true;
    }

    // =================================================
    // 📝 SALVAR MENSAGEM
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_mensagem"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                content:
                    interaction.fields.getTextInputValue(
                        "content"
                    )
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 🎨 SALVAR EMBED
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_embed"
    ) {
        const tituloUrl =
            interaction.fields
                .getTextInputValue(
                    "titulo_url"
                )
                .trim();

        if (
            tituloUrl &&
            !validarURL(tituloUrl)
        ) {
            await interaction.reply({
                content:
                    "❌ O link do título precisa começar com http:// ou https://",
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                embed_titulo:
                    interaction.fields.getTextInputValue(
                        "titulo"
                    ),
                embed_descricao:
                    interaction.fields.getTextInputValue(
                        "descricao"
                    ),
                embed_cor:
                    interaction.fields.getTextInputValue(
                        "cor"
                    )
            }
        );

        await salvarExtrasJoin(
            interaction.guild.id,
            {
                titulo_url: tituloUrl
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 👤 SALVAR AUTOR
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_autor"
    ) {
        const nome =
            interaction.fields
                .getTextInputValue(
                    "nome"
                )
                .trim();

        const icone =
            interaction.fields
                .getTextInputValue(
                    "icone"
                )
                .trim();

        const autorUrl =
            interaction.fields
                .getTextInputValue(
                    "autor_url"
                )
                .trim();

        if (
            !urlOuVariavel(icone) ||
            (autorUrl && !validarURL(autorUrl))
        ) {
            await interaction.reply({
                content:
                    "❌ Os links precisam começar com http:// ou https:// (o ícone também aceita {avatar}).",
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                autor_nome: nome,
                autor_icone: icone,

                // Preencheu o nome → liga o autor.
                // (Para desligar, use o botão Autor: ON/OFF.)
                autor_habilitado:
                    nome
                        ? true
                        : estaAtivado(
                            config?.autor_habilitado
                        )
            }
        );

        await salvarExtrasJoin(
            interaction.guild.id,
            {
                autor_url: autorUrl
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 🖼️ SALVAR IMAGENS
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_imagens"
    ) {
        const thumbnail =
            interaction.fields
                .getTextInputValue(
                    "thumbnail"
                )
                .trim();

        const imagem =
            interaction.fields
                .getTextInputValue(
                    "imagem"
                )
                .trim();

        if (
            !urlOuVariavel(thumbnail) ||
            !urlOuVariavel(imagem)
        ) {
            await interaction.reply({
                content:
                    "❌ Use links começando com http:// ou https:// (ou as variáveis {avatar} / {banner}).",
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                thumbnail,
                imagem
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 📌 SALVAR FOOTER
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_footer"
    ) {
        const texto =
            interaction.fields
                .getTextInputValue(
                    "texto"
                )
                .trim();

        const icone =
            interaction.fields
                .getTextInputValue(
                    "icone"
                )
                .trim();

        if (!urlOuVariavel(icone)) {
            await interaction.reply({
                content:
                    "❌ O ícone precisa ser um link http:// ou https:// (ou {avatar}).",
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                footer_texto: texto,
                footer_icone: icone,

                // Preencheu o texto → liga o rodapé.
                footer_habilitado:
                    texto
                        ? true
                        : estaAtivado(
                            config?.footer_habilitado
                        )
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // 🧾 SALVAR CAMPOS
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_campos"
    ) {
        // Guarda já normalizado: só o que foi aceito de verdade
        await salvarExtrasJoin(
            interaction.guild.id,
            {
                campos:
                    camposParaTexto(
                        textoParaCampos(
                            interaction.fields
                                .getTextInputValue(
                                    "campos"
                                )
                        )
                    )
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    // =================================================
    // ⚙️ SALVAR OPÇÕES (formulário antigo, mantido por compatibilidade)
    // =================================================

    if (
        interaction.isModalSubmit() &&
        id === "join_modal_opcoes"
    ) {
        const config =
            await getJoinConfig(
                interaction.guild.id
            );

        const valorBooleano = nome =>
            lerSimNao(
                interaction.fields
                    .getTextInputValue(nome)
            );

        await salvarJoinConfig(
            interaction.guild.id,
            {
                ...(config || {}),
                embed_habilitado:
                    valorBooleano(
                        "embed_habilitado"
                    ),
                timestamp:
                    valorBooleano(
                        "timestamp"
                    ),
                habilitado:
                    valorBooleano(
                        "habilitado"
                    )
            }
        );

        return responderPainelJoin(
            interaction
        );
    }

    return false;
}

// =====================================================
// 📤 EXPORTAR
// =====================================================

module.exports = {
    data,
    execute,
    enviarBoasVindas,
    tratarInteracao
};
