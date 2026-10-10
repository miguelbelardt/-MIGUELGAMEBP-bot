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
    getLeaveConfig,
    salvarLeaveConfig,
    atualizarCanalLeave,
    mysqlPool
} = require("../database/database");


// =====================================================
// 🚪 VARIÁVEIS
// =====================================================

function substituirVariaveis(texto, dados) {

    if (!texto) {
        return texto;
    }

    return String(texto)
        .replaceAll("{user}", dados.user ?? "")
        .replaceAll("{username}", dados.username ?? "")
        .replaceAll("{userid}", dados.userid ?? "")
        .replaceAll("{avatar}", dados.avatar ?? "")
        .replaceAll("{banner}", dados.banner ?? "")
        .replaceAll("{members}", String(dados.members ?? ""))
        .replaceAll("{server}", dados.server ?? "");
}


// =====================================================
// 🚪 UTILITÁRIOS
// =====================================================

function urlValida(url) {

    if (!url) {
        return false;
    }

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


function converterCor(cor) {

    if (!cor) {
        return 0xED4245;
    }

    const valor = String(cor).trim();

    if (/^#[0-9A-Fa-f]{6}$/.test(valor)) {
        return parseInt(
            valor.slice(1),
            16
        );
    }

    if (/^0x[0-9A-Fa-f]{6}$/.test(valor)) {
        return parseInt(
            valor,
            16
        );
    }

    if (/^[0-9]+$/.test(valor)) {
        return Number(valor);
    }

    return 0xED4245;
}


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

// Ícones e imagens aceitam link ou as variáveis {avatar} / {banner}
function urlOuVariavel(valor) {
    return (
        !valor ||
        urlValida(valor) ||
        /^\{(avatar|banner)\}$/i.test(valor)
    );
}

// =====================================================
// 🧾 CAMPOS DO EMBED
// =====================================================

// Uma linha por campo:  Nome | Valor | sim   (sim = lado a lado)
// Use \n dentro do valor para quebrar linha. Aceita variáveis.

const MAX_CAMPOS_LEAVE = 10;

function textoParaCampos(texto) {
    if (!texto || typeof texto !== "string") {
        return [];
    }

    const campos = [];

    for (const linha of texto.split("\n")) {
        if (campos.length >= MAX_CAMPOS_LEAVE) {
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

// O database.js não conhece essas colunas: o próprio leave.js
// cria (se faltarem) e salva depois do save normal.

let promessaColunasExtras = null;

function garantirColunasExtrasLeave() {
    if (!promessaColunasExtras) {
        promessaColunasExtras = (async () => {
            const [colunas] = await mysqlPool.query(
                "SHOW COLUMNS FROM leave_config"
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
                        `ALTER TABLE leave_config ADD COLUMN ${coluna} ${definicao}`
                    );
                }
            }
        })().catch(erro => {
            promessaColunasExtras = null;

            console.error(
                "❌ Erro ao preparar colunas extras do leave:",
                erro
            );
        });
    }

    return promessaColunasExtras;
}

async function salvarExtrasLeave(guildId, extras) {
    try {
        await garantirColunasExtrasLeave();

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
            UPDATE leave_config
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
            "❌ Erro ao salvar dados extras do leave:",
            erro
        );
    }
}


// =====================================================
// 🚪 DADOS DO MEMBRO
// =====================================================

async function pegarDadosMembro(membro) {

    let usuario;

    try {
        usuario =
            await membro.user.fetch();
    } catch (erro) {
        console.error(
            "❌ Não foi possível obter os dados do usuário que saiu:",
            erro
        );

        usuario =
            membro.user;
    }

    const avatar =
        usuario.displayAvatarURL({
            extension: "png",
            size: 1024
        });

    let banner = "";

    try {

        if (usuario.banner) {
            banner =
                usuario.bannerURL({
                    extension: "png",
                    size: 1024
                }) || "";
        }

    } catch {
        banner = "";
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
// 🚪 CRIAR EMBED
// =====================================================

function criarEmbedSaida(
    configBanco,
    dados
) {

    const config =
        configBanco || {};

    const embed =
        new EmbedBuilder()
            .setColor(
                converterCor(
                    config.embed_cor
                )
            );

    if (config.embed_titulo) {

        embed.setTitle(
            substituirVariaveis(
                config.embed_titulo,
                dados
            )
        );

        const tituloUrl =
            substituirVariaveis(
                config.titulo_url,
                dados
            );

        if (urlValida(tituloUrl)) {
            embed.setURL(tituloUrl);
        }
    }

    if (config.embed_descricao) {

        embed.setDescription(
            substituirVariaveis(
                config.embed_descricao,
                dados
            )
        );
    }

    if (
        estaAtivado(
            config.autor_habilitado
        ) &&
        config.autor_nome
    ) {

        const autor = {
            name:
                substituirVariaveis(
                    config.autor_nome,
                    dados
                )
        };

        const iconeAutor =
            substituirVariaveis(
                config.autor_icone,
                dados
            );

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
                config.autor_url,
                dados
            );

        if (urlValida(autorUrl)) {
            autor.url =
                autorUrl;
        }

        embed.setAuthor(autor);
    }

    if (config.thumbnail) {

        const thumbnail =
            substituirVariaveis(
                config.thumbnail,
                dados
            );

        if (urlValida(thumbnail)) {
            embed.setThumbnail(
                thumbnail
            );
        }
    }

    if (config.imagem) {

        const imagem =
            substituirVariaveis(
                config.imagem,
                dados
            );

        if (urlValida(imagem)) {
            embed.setImage(imagem);
        }
    }

    if (
        estaAtivado(
            config.footer_habilitado
        )
    ) {

        const textoFooter =
            substituirVariaveis(
                config.footer_texto,
                dados
            );

        const footer = {
            text:
                textoFooter ||
                "Massa Com Chika"
        };

        const iconeFooter =
            substituirVariaveis(
                config.footer_icone,
                dados
            );

        if (
            urlValida(
                iconeFooter
            )
        ) {

            footer.iconURL =
                iconeFooter;
        }

        embed.setFooter(
            footer
        );
    }

    const campos =
        textoParaCampos(
            config.campos
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

    if (
        estaAtivado(
            config.timestamp
        )
    ) {

        embed.setTimestamp();
    }

    return embed;
}


// =====================================================
// 🚪 ENVIAR MENSAGEM DE SAÍDA
// =====================================================

async function enviarSaida(membro) {

    try {

        if (
            !membro ||
            !membro.guild
        ) {
            return;
        }

        const guild =
            membro.guild;

        const config =
            await getLeaveConfig(
                guild.id
            );

        if (!config) {
            return;
        }

        if (
            !estaAtivado(
                config.habilitado
            )
        ) {
            return;
        }

        if (!config.canal_id) {
            return;
        }

        const canal =
            await guild.channels
                .fetch(
                    config.canal_id
                )
                .catch(
                    () => null
                );

        if (!canal) {
            console.warn(
                `⚠️ Canal de saída não encontrado: ${config.canal_id}`
            );

            return;
        }

        if (!canal.isTextBased()) {
            console.warn(
                `⚠️ O canal configurado para Leave não é de texto: ${config.canal_id}`
            );

            return;
        }

        const dados =
            await pegarDadosMembro(
                membro
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

        if (
            estaAtivado(
                config.embed_habilitado
            )
        ) {

            mensagem.embeds = [
                criarEmbedSaida(
                    config,
                    dados
                )
            ];
        }

        if (
            !mensagem.content &&
            !mensagem.embeds
        ) {
            console.warn(
                `⚠️ O Leave de ${guild.name} não possui conteúdo configurado.`
            );

            return;
        }

        await canal.send(
            mensagem
        );

        console.log(
            `🚪 Mensagem de saída enviada para ${membro.user?.tag || membro.user?.username || membro.id} em ${guild.name}`
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao enviar mensagem de saída:",
            erro
        );
    }
}


// =====================================================
// 🚪 DADOS PARA TESTE
// =====================================================

async function pegarDadosTeste(interaction) {

    let usuario;

    try {
        usuario =
            await interaction.user.fetch();
    } catch {
        usuario =
            interaction.user;
    }

    let banner = "";

    try {

        if (usuario.banner) {

            banner =
                usuario.bannerURL({
                    extension: "png",
                    size: 1024
                }) || "";
        }

    } catch {
        banner = "";
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
// 🚪 PAINEL
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

function criarPainelLeave(
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
            .setColor(0xED4245)
            .setTitle(
                "🚪 Configuração de Leave"
            )
            .setDescription(
                "Configure abaixo como a mensagem de saída será enviada.\n\n" +
                "💬 **Mensagem**, 🎨 **Embed**, 👤 **Autor**, 🖼️ **Imagens**, 📝 **Footer** e 🧾 **Campos** abrem formulários.\n" +
                "Os botões **ON/OFF** ligam e desligam cada parte do embed.\n\n" +
                "Variáveis: `{user}` `{username}` `{userid}` `{avatar}` `{banner}` `{members}` `{server}`"
            )
            .addFields(
                {
                    name: "🚪 Sistema",
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
                    name: "📝 Footer",
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
            )
            .setFooter({
                text:
                    "Massa Com Chika • Sistema de Leave"
            });

    const canalSelect =
        new ChannelSelectMenuBuilder()
            .setCustomId(
                "leave_config_canal"
            )
            .setPlaceholder(
                "📢 Escolha o canal de saída"
            )
            .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
            );

    const linhaCanal =
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

    const linha1 =
        new ActionRowBuilder()
            .addComponents(
                botao("leave_config_mensagem", "Mensagem", "💬"),
                botao("leave_config_embed", "Embed", "🎨"),
                botao("leave_config_autor", "Autor", "👤"),
                botao("leave_config_imagens", "Imagens", "🖼️"),
                botao("leave_config_footer", "Footer", "📝")
            );

    const linha2 =
        new ActionRowBuilder()
            .addComponents(
                botao("leave_config_campos", "Campos", "🧾"),
                alternar("leave_toggle_embed", "Embed", "🎨", config.embed_habilitado),
                alternar("leave_toggle_autor", "Autor", "👤", config.autor_habilitado),
                alternar("leave_toggle_footer", "Footer", "📝", config.footer_habilitado),
                alternar("leave_toggle_timestamp", "Horário", "⏰", config.timestamp)
            );

    const linha3 =
        new ActionRowBuilder()
            .addComponents(
                botao("leave_config_ativar", "Ativar", "🟢", ButtonStyle.Success),
                botao("leave_config_desativar", "Desativar", "🔴", ButtonStyle.Danger),
                botao("leave_config_status", "Status", "📊", ButtonStyle.Secondary),
                botao("leave_config_teste", "Testar", "🧪", ButtonStyle.Success),
                botao("leave_config_fechar", "Fechar", "❌", ButtonStyle.Danger)
            );

    return {
        content: textoMensagem,
        embeds:
            previa
                ? [previa, embed]
                : [embed],
        components: [
            linhaCanal,
            linha1,
            linha2,
            linha3
        ]
    };
}

// Monta o painel com a prévia ao vivo do embed (dados do próprio
// administrador no lugar de quem saiu) e o texto da mensagem.
async function montarPainelLeave(
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

        if (estaAtivado(config.embed_habilitado)) {
            const embedPrevia =
                criarEmbedSaida(
                    config,
                    dados
                );

            // Soma de todos os embeds da mensagem: máx. 6000 caracteres
            if (tamanhoEmbed(embedPrevia) <= 4500) {
                previa = embedPrevia;
            }
        }

        if (config.content) {
            textoMensagem =
                (
                    "💬 **Mensagem de saída:**\n" +
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

    return criarPainelLeave(
        config,
        previa,
        textoMensagem
    );
}

// Atualiza o painel NO LUGAR (botão/menu/modal do painel) em vez de
// mandar uma mensagem solta de confirmação.
async function responderPainelLeave(
    interaction
) {
    const config =
        (
            await getLeaveConfig(
                interaction.guild.id
            )
        ) || {};

    const painel =
        await montarPainelLeave(
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
// 🚪 MODAL — MENSAGEM
// =====================================================

function criarModalMensagem(
    config
) {

    const mensagem =
        new TextInputBuilder()
            .setCustomId(
                "content"
            )
            .setLabel(
                "Mensagem"
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.content ??
                    ""
                )
            )
            .setMaxLength(
                2000
            );

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_mensagem"
            )
            .setTitle(
                "💬 Mensagem de saída"
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                mensagem
            )
    );

    return modal;
}


// =====================================================
// 🚪 MODAL — EMBED
// =====================================================

function criarModalEmbed(
    config
) {

    const titulo =
        new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config?.embed_titulo ?? ""
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
                    config?.embed_descricao ?? ""
                )
            )
            .setMaxLength(4000);

    const cor =
        new TextInputBuilder()
            .setCustomId("cor")
            .setLabel("Cor (#ED4245, 0xED4245 ou número)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config?.embed_cor ?? "#ED4245"
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
                String(
                    config?.titulo_url ?? ""
                )
            )
            .setMaxLength(1000);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_embed"
            )
            .setTitle(
                "🎨 Configuração do Embed"
            );

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
// 🚪 MODAL — AUTOR
// =====================================================

function criarModalAutor(
    config
) {

    const nome =
        new TextInputBuilder()
            .setCustomId("nome")
            .setLabel("Nome do autor")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config?.autor_nome ?? ""
                )
            )
            .setMaxLength(256);

    const icone =
        new TextInputBuilder()
            .setCustomId("icone")
            .setLabel("Ícone do autor (link ou {avatar})")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config?.autor_icone ?? ""
                )
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
                String(
                    config?.autor_url ?? ""
                )
            )
            .setMaxLength(1000);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_autor"
            )
            .setTitle(
                "👤 Autor do Embed"
            );

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
// 🚪 MODAL — IMAGENS
// =====================================================

function criarModalImagens(
    config
) {

    const thumbnail =
        new TextInputBuilder()
            .setCustomId(
                "thumbnail"
            )
            .setLabel(
                "Thumbnail"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.thumbnail ??
                    ""
                )
            )
            .setMaxLength(
                1000
            );

    const imagem =
        new TextInputBuilder()
            .setCustomId(
                "imagem"
            )
            .setLabel(
                "Imagem"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                String(
                    config?.imagem ??
                    ""
                )
            )
            .setMaxLength(
                1000
            );

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_imagens"
            )
            .setTitle(
                "🖼️ Imagens do Embed"
            );

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                thumbnail
            ),

        new ActionRowBuilder()
            .addComponents(
                imagem
            )
    );

    return modal;
}


// =====================================================
// 🚪 MODAL — FOOTER
// =====================================================

function criarModalFooter(
    config
) {

    const texto =
        new TextInputBuilder()
            .setCustomId("texto")
            .setLabel("Texto do footer")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config?.footer_texto ?? ""
                )
            )
            .setMaxLength(2048);

    const icone =
        new TextInputBuilder()
            .setCustomId("icone")
            .setLabel("Ícone do footer (link ou {avatar})")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(
                String(
                    config?.footer_icone ?? ""
                )
            )
            .setMaxLength(1000);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_footer"
            )
            .setTitle(
                "📝 Footer do Embed"
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(texto),

        new ActionRowBuilder()
            .addComponents(icone)
    );

    return modal;
}


// =====================================================
// 🚪 MODAL — CAMPOS
// =====================================================

function criarModalCampos(
    config
) {

    const campos =
        new TextInputBuilder()
            .setCustomId("campos")
            .setLabel("Nome | Valor | sim (lado a lado) — máx. 10")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder("Servidor | {server} | sim")
            .setValue(
                String(
                    config?.campos ?? ""
                )
            )
            .setMaxLength(4000);

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_campos"
            )
            .setTitle(
                "🧾 Campos do embed"
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(campos)
    );

    return modal;
}


// =====================================================
// 🚪 MODAL — OPÇÕES
// =====================================================

function criarModalOpcoes(
    config
) {

    const embed =
        new TextInputBuilder()
            .setCustomId(
                "embed_habilitado"
            )
            .setLabel(
                "Embed ativado? (sim/não)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config?.embed_habilitado
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(
                10
            );

    const timestamp =
        new TextInputBuilder()
            .setCustomId(
                "timestamp"
            )
            .setLabel(
                "Timestamp ativado? (sim/não)"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
                estaAtivado(
                    config?.timestamp
                )
                    ? "sim"
                    : "não"
            )
            .setMaxLength(
                10
            );

    const modal =
        new ModalBuilder()
            .setCustomId(
                "leave_modal_opcoes"
            )
            .setTitle(
                "⚙️ Opções do Leave"
            );

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                embed
            ),

        new ActionRowBuilder()
            .addComponents(
                timestamp
            )
    );

    return modal;
}


// =====================================================
// 🚪 TRATAR INTERAÇÕES
// =====================================================

async function tratarInteracao(
    interaction
) {

    if (
        !interaction.customId ||
        !interaction.customId.startsWith(
            "leave_"
        )
    ) {
        return false;
    }

    if (
        !interaction.guild
    ) {
        return false;
    }

    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {

        await interaction.reply({
            content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para configurar o sistema de Leave.",
            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    const guildId =
        interaction.guild.id;

    await garantirColunasExtrasLeave();

    // =================================================
    // 📢 SELEÇÃO DO CANAL
    // =================================================

    if (
        interaction.isChannelSelectMenu() &&
        interaction.customId ===
            "leave_config_canal"
    ) {

        await atualizarCanalLeave(
            guildId,
            interaction.values[0]
        );

        return responderPainelLeave(
            interaction
        );
    }


    // =================================================
    // 🔘 BOTÕES
    // =================================================

    if (
        interaction.isButton()
    ) {

        const config =
            await getLeaveConfig(
                guildId
            ) || {};


        // =============================================
        // 🟢 ATIVAR / 🔴 DESATIVAR
        // =============================================

        if (
            interaction.customId ===
            "leave_config_ativar" ||
            interaction.customId ===
            "leave_config_desativar"
        ) {

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    habilitado:
                        interaction.customId ===
                        "leave_config_ativar"
                }
            );

            return responderPainelLeave(
                interaction
            );
        }


        // =============================================
        // 🧾 CAMPOS
        // =============================================

        if (
            interaction.customId ===
            "leave_config_campos"
        ) {

            await interaction.showModal(
                criarModalCampos(
                    config
                )
            );

            return true;
        }


        // =============================================
        // 🔘 LIGAR / DESLIGAR PARTES DO EMBED
        // =============================================

        const alternadores = {
            leave_toggle_embed: "embed_habilitado",
            leave_toggle_autor: "autor_habilitado",
            leave_toggle_footer: "footer_habilitado",
            leave_toggle_timestamp: "timestamp"
        };

        if (
            alternadores[
                interaction.customId
            ]
        ) {

            const campo =
                alternadores[
                    interaction.customId
                ];

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    [campo]:
                        !estaAtivado(
                            config[campo]
                        )
                }
            );

            return responderPainelLeave(
                interaction
            );
        }


        // =============================================
        // 💬 MENSAGEM
        // =============================================

        if (
            interaction.customId ===
            "leave_config_mensagem"
        ) {

            await interaction.showModal(
                criarModalMensagem(
                    config
                )
            );

            return true;
        }


        // =============================================
        // 🎨 EMBED
        // =============================================

        if (
            interaction.customId ===
            "leave_config_embed"
        ) {

            await interaction.showModal(
                criarModalEmbed(
                    config
                )
            );

            return true;
        }


        // =============================================
        // 👤 AUTOR
        // =============================================

        if (
            interaction.customId ===
            "leave_config_autor"
        ) {

            await interaction.showModal(
                criarModalAutor(
                    config
                )
            );

            return true;
        }


        // =============================================
        // 🖼️ IMAGENS
        // =============================================

        if (
            interaction.customId ===
            "leave_config_imagens"
        ) {

            await interaction.showModal(
                criarModalImagens(
                    config
                )
            );

            return true;
        }


        // =============================================
        // 📝 FOOTER
        // =============================================

        if (
            interaction.customId ===
            "leave_config_footer"
        ) {

            await interaction.showModal(
                criarModalFooter(
                    config
                )
            );

            return true;
        }


        // =============================================
        // ⚙️ OPÇÕES
        // =============================================

        if (
            interaction.customId ===
            "leave_config_opcoes"
        ) {

            await interaction.showModal(
                criarModalOpcoes(
                    config
                )
            );

            return true;
        }


        // =============================================
        // 📊 STATUS
        // =============================================

        if (
            interaction.customId ===
            "leave_config_status"
        ) {

            const status =
                estaAtivado(
                    config.habilitado
                )
                    ? "🟢 Ativado"
                    : "🔴 Desativado";

            const canal =
                config.canal_id
                    ? `<#${config.canal_id}>`
                    : "❌ Nenhum canal definido";

            const embedStatus =
                estaAtivado(
                    config.embed_habilitado
                )
                    ? "🟢 Ativado"
                    : "🔴 Desativado";

            await interaction.reply({
                content:
                    `🚪 **Status do Leave**\n\n` +
                    `Sistema: ${status}\n` +
                    `Canal: ${canal}\n` +
                    `Embed: ${embedStatus}`,
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }


        // =============================================
        // 🧪 TESTAR
        // =============================================

        if (
            interaction.customId ===
            "leave_config_teste"
        ) {

            const dados =
                await pegarDadosTeste(
                    interaction
                );

            const configTeste =
                config || {};

            const resposta = {};

            if (
                configTeste.content
            ) {

                resposta.content =
                    substituirVariaveis(
                        configTeste.content,
                        dados
                    );
            }

            if (
                estaAtivado(
                    configTeste.embed_habilitado
                )
            ) {

                resposta.embeds = [
                    criarEmbedSaida(
                        configTeste,
                        dados
                    )
                ];
            }

            if (
                !resposta.content &&
                !resposta.embeds
            ) {

                await interaction.reply({
                    content:
                        "⚠️ Não há conteúdo configurado para testar.",
                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            /*
             * IMPORTANTE:
             * O teste é enviado como resposta efêmera
             * da interação. Ele NÃO é enviado por DM.
             */
            await interaction.reply({
                ...resposta,
                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }


        // =============================================
        // ❌ FECHAR
        // =============================================

        if (
            interaction.customId ===
            "leave_config_fechar"
        ) {

            await interaction.update({
                content:
                    "🚪 Painel de Leave fechado.",
                embeds: [],
                components: []
            });

            return true;
        }
    }


    // =================================================
    // 📝 MODAIS
    // =================================================

    if (
        interaction.isModalSubmit()
    ) {

        const id =
            interaction.customId;

        const config =
            await getLeaveConfig(
                guildId
            ) || {};

        const valor = nome =>
            interaction.fields
                .getTextInputValue(nome)
                .trim();

        const recusar = texto =>
            interaction.reply({
                content: texto,
                flags:
                    MessageFlags.Ephemeral
            }).then(() => true);


        // 💬 MENSAGEM
        if (id === "leave_modal_mensagem") {

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    content:
                        interaction.fields.getTextInputValue(
                            "content"
                        )
                }
            );

            return responderPainelLeave(
                interaction
            );
        }


        // 🎨 EMBED
        if (id === "leave_modal_embed") {

            const tituloUrl =
                valor("titulo_url");

            if (
                tituloUrl &&
                !urlValida(tituloUrl)
            ) {
                return recusar(
                    "❌ O link do título precisa começar com http:// ou https://"
                );
            }

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,

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

            await salvarExtrasLeave(
                guildId,
                {
                    titulo_url: tituloUrl
                }
            );

            return responderPainelLeave(
                interaction
            );
        }


        // 👤 AUTOR
        if (id === "leave_modal_autor") {

            const nome =
                valor("nome");

            const icone =
                valor("icone");

            const autorUrl =
                valor("autor_url");

            if (
                !urlOuVariavel(icone) ||
                (autorUrl && !urlValida(autorUrl))
            ) {
                return recusar(
                    "❌ Os links precisam começar com http:// ou https:// (o ícone também aceita {avatar})."
                );
            }

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,

                    autor_nome: nome,
                    autor_icone: icone,

                    // Preencheu o nome → liga o autor.
                    // (Para desligar, use o botão Autor: ON/OFF.)
                    autor_habilitado:
                        nome
                            ? true
                            : estaAtivado(
                                config.autor_habilitado
                            )
                }
            );

            await salvarExtrasLeave(
                guildId,
                {
                    autor_url: autorUrl
                }
            );

            return responderPainelLeave(
                interaction
            );
        }


        // 🖼️ IMAGENS
        if (id === "leave_modal_imagens") {

            const thumbnail =
                valor("thumbnail");

            const imagem =
                valor("imagem");

            if (
                !urlOuVariavel(thumbnail) ||
                !urlOuVariavel(imagem)
            ) {
                return recusar(
                    "❌ Use links começando com http:// ou https:// (ou as variáveis {avatar} / {banner})."
                );
            }

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,
                    thumbnail,
                    imagem
                }
            );

            return responderPainelLeave(
                interaction
            );
        }


        // 📝 FOOTER
        if (id === "leave_modal_footer") {

            const texto =
                valor("texto");

            const icone =
                valor("icone");

            if (!urlOuVariavel(icone)) {
                return recusar(
                    "❌ O ícone precisa ser um link http:// ou https:// (ou {avatar})."
                );
            }

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,

                    footer_texto: texto,
                    footer_icone: icone,

                    // Preencheu o texto → liga o footer.
                    footer_habilitado:
                        texto
                            ? true
                            : estaAtivado(
                                config.footer_habilitado
                            )
                }
            );

            return responderPainelLeave(
                interaction
            );
        }


        // 🧾 CAMPOS
        if (id === "leave_modal_campos") {

            // Guarda já normalizado: só o que foi aceito de verdade
            await salvarExtrasLeave(
                guildId,
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

            return responderPainelLeave(
                interaction
            );
        }


        // ⚙️ OPÇÕES (formulário antigo, mantido por compatibilidade)
        if (id === "leave_modal_opcoes") {

            await salvarLeaveConfig(
                guildId,
                {
                    ...config,

                    embed_habilitado:
                        lerSimNao(
                            interaction.fields.getTextInputValue(
                                "embed_habilitado"
                            )
                        ),

                    timestamp:
                        lerSimNao(
                            interaction.fields.getTextInputValue(
                                "timestamp"
                            )
                        )
                }
            );

            return responderPainelLeave(
                interaction
            );
        }

        return false;
    }

    return false;
}


// =====================================================
// 🚪 COMANDO /LEAVE
// =====================================================

const data =
    new SlashCommandBuilder()
        .setName("leave")
        .setDescription(
            "Configura o sistema de saída do servidor"
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
                        "Abrir o painel de configuração"
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("ativar")
                    .setDescription(
                        "Ativar o sistema de Leave"
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("desativar")
                    .setDescription(
                        "Desativar o sistema de Leave"
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("status")
                    .setDescription(
                        "Ver o status do sistema"
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("teste")
                    .setDescription(
                        "Testar a mensagem de saída"
                    )
        );


// =====================================================
// 🚪 EXECUTAR /LEAVE
// =====================================================

async function execute(
    interaction
) {

    if (
        !interaction.guild
    ) {

        return interaction.reply({
            content:
                "❌ Este comando só pode ser usado dentro de um servidor.",
            flags:
                MessageFlags.Ephemeral
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
            flags:
                MessageFlags.Ephemeral
        });
    }

    const subcomando =
        interaction.options.getSubcommand();

    let config =
        await getLeaveConfig(
            interaction.guild.id
        );


    // =================================================
    // ⚙️ CONFIGURAR
    // =================================================

    if (
        subcomando ===
        "configurar"
    ) {

        if (!config) {

            config =
                await salvarLeaveConfig(
                    interaction.guild.id,
                    {}
                );
        }

        await garantirColunasExtrasLeave();

        config =
            await getLeaveConfig(
                interaction.guild.id
            );

        return interaction.reply({
            ...(
                await montarPainelLeave(
                    interaction,
                    config || {}
                )
            ),
            flags:
                MessageFlags.Ephemeral
        });
    }


    // =================================================
    // 🟢 ATIVAR
    // =================================================

    if (
        subcomando ===
        "ativar"
    ) {

        config =
            await salvarLeaveConfig(
                interaction.guild.id,
                {
                    ...(config || {}),
                    habilitado: true
                }
            );

        return interaction.reply({
            content:
                "🟢 Sistema de Leave **ativado**!",
            flags:
                MessageFlags.Ephemeral
        });
    }


    // =================================================
    // 🔴 DESATIVAR
    // =================================================

    if (
        subcomando ===
        "desativar"
    ) {

        config =
            await salvarLeaveConfig(
                interaction.guild.id,
                {
                    ...(config || {}),
                    habilitado: false
                }
            );

        return interaction.reply({
            content:
                "🔴 Sistema de Leave **desativado**!",
            flags:
                MessageFlags.Ephemeral
        });
    }


    // =================================================
    // 📊 STATUS
    // =================================================

    if (
        subcomando ===
        "status"
    ) {

        const status =
            config &&
            estaAtivado(
                config.habilitado
            )
                ? "🟢 Ativado"
                : "🔴 Desativado";

        const canal =
            config?.canal_id
                ? `<#${config.canal_id}>`
                : "Nenhum";

        return interaction.reply({
            content:
                `🚪 **Sistema de Leave**\n\n` +
                `Status: ${status}\n` +
                `Canal: ${canal}\n` +
                `Embed: ${
                    config &&
                    estaAtivado(
                        config.embed_habilitado
                    )
                        ? "🟢 Ativado"
                        : "🔴 Desativado"
                }`,
            flags:
                MessageFlags.Ephemeral
        });
    }


    // =================================================
    // 🧪 TESTE
    // =================================================

    if (
        subcomando ===
        "teste"
    ) {

        if (!config) {

            return interaction.reply({
                content:
                    "❌ O sistema de Leave ainda não foi configurado.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const dados =
            await pegarDadosTeste(
                interaction
            );

        const resposta = {};

        if (config.content) {

            resposta.content =
                substituirVariaveis(
                    config.content,
                    dados
                );
        }

        if (
            estaAtivado(
                config.embed_habilitado
            )
        ) {

            resposta.embeds = [
                criarEmbedSaida(
                    config,
                    dados
                )
            ];
        }

        if (
            !resposta.content &&
            !resposta.embeds
        ) {

            return interaction.reply({
                content:
                    "⚠️ Não há conteúdo configurado para testar.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        /*
         * O teste é uma resposta efêmera da interação.
         * Não é enviado para DM.
         */
        return interaction.reply({
            ...resposta,
            flags:
                MessageFlags.Ephemeral
        });
    }
}


// =====================================================
// 🚪 EXPORTAR
// =====================================================

module.exports = {
    data,
    execute,
    enviarSaida,
    tratarInteracao
};
