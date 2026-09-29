const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

const {
    getJoinConfig,
    salvarJoinConfig,
    atualizarCanalJoin
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
            const numero = Number.parseInt(valor, 16);

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

    const avatar = usuario.displayAvatarURL({
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

function criarEmbedBoasVindas(configBanco, dados) {
    if (
        !estaAtivado(
            configBanco.embed_habilitado
        )
    ) {
        return null;
    }

    const embed = new EmbedBuilder();

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
            embed.setDescription(descricao);
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

            if (urlValida(iconeAutor)) {
                autor.iconURL = iconeAutor;
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

        if (urlValida(thumbnail)) {
            embed.setThumbnail(thumbnail);
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

        if (urlValida(imagem)) {
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

        if (urlValida(iconeFooter)) {
            footer.iconURL = iconeFooter;
        }

        embed.setFooter(footer);
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

        const guild = membro.guild;

        // =================================================
        // 🗄️ BUSCAR CONFIGURAÇÃO
        // =================================================

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

        // =================================================
        // ⚙️ NÃO CONFIGURADO
        // =================================================

        if (!configBanco) {
            console.log(
                `⚠️ Sistema de boas-vindas não configurado para ${guild.name}.`
            );

            return;
        }

        // =================================================
        // 🔴 DESATIVADO
        // =================================================

        if (
            !estaAtivado(
                configBanco.habilitado
            )
        ) {
            return;
        }

        // =================================================
        // 📢 CANAL
        // =================================================

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

        // =================================================
        // 👤 DADOS
        // =================================================

        const dados =
            await pegarDadosMembro(
                membro
            );

        // =================================================
        // 🎨 EMBED
        // =================================================

        const embed =
            criarEmbedBoasVindas(
                configBanco,
                dados
            );

        // =================================================
        // 📤 MENSAGEM
        // =================================================

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

        // =================================================
        // 📩 ENVIAR
        // =================================================

        await canal.send(mensagem);

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
// ⚙️ COMANDO /JOIN
// =====================================================

const data = new SlashCommandBuilder()
    .setName("join")
    .setDescription(
        "Configura o sistema de boas-vindas"
    )
    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild.toString()
    )

    // =================================================
    // 📢 CONFIGURAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("configurar")
            .setDescription(
                "Define o canal das mensagens de boas-vindas"
            )
            .addChannelOption(option =>
                option
                    .setName("canal")
                    .setDescription(
                        "Canal onde as boas-vindas serão enviadas"
                    )
                    .addChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    )
                    .setRequired(true)
            )
    )

    // =================================================
    // 🟢 ATIVAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("ativar")
            .setDescription(
                "Ativa o sistema de boas-vindas"
            )
    )

    // =================================================
    // 🔴 DESATIVAR
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("desativar")
            .setDescription(
                "Desativa o sistema de boas-vindas"
            )
    )

    // =================================================
    // 📊 STATUS
    // =================================================

    .addSubcommand(subcommand =>
        subcommand
            .setName("status")
            .setDescription(
                "Mostra a configuração atual"
            )
    )

    // =================================================
    // 🧪 TESTE
    // =================================================

    .addSubcommand(subcommand =>
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
        // 📢 CONFIGURAR CANAL
        // =================================================

        if (
            subcomando === "configurar"
        ) {
            const canal =
                interaction.options.getChannel(
                    "canal"
                );

            const configAtual =
                await getJoinConfig(
                    guildId
                );

            if (configAtual) {
                await atualizarCanalJoin(
                    guildId,
                    canal.id
                );
            } else {
                await salvarJoinConfig(
                    guildId,
                    {
                        canalId: canal.id
                    }
                );
            }

            await interaction.reply({
                content:
                    `✅ Canal de boas-vindas configurado para ${canal}.`,
                ephemeral: true
            });

            return;
        }

        // =================================================
        // 🟢 ATIVAR
        // =================================================

        if (
            subcomando === "ativar"
        ) {
            const configAtual =
                await getJoinConfig(
                    guildId
                );

            const novaConfig = {
                ...(configAtual || {}),
                habilitado: true
            };

            await salvarJoinConfig(
                guildId,
                novaConfig
            );

            await interaction.reply({
                content:
                    "✅ Sistema de boas-vindas ativado!",
                ephemeral: true
            });

            return;
        }

        // =================================================
        // 🔴 DESATIVAR
        // =================================================

        if (
            subcomando === "desativar"
        ) {
            const configAtual =
                await getJoinConfig(
                    guildId
                );

            const novaConfig = {
                ...(configAtual || {}),
                habilitado: false
            };

            await salvarJoinConfig(
                guildId,
                novaConfig
            );

            await interaction.reply({
                content:
                    "🔴 Sistema de boas-vindas desativado!",
                ephemeral: true
            });

            return;
        }

        // =================================================
        // 📊 STATUS
        // =================================================

        if (
            subcomando === "status"
        ) {
            const config =
                await getJoinConfig(
                    guildId
                );

            if (!config) {
                await interaction.reply({
                    content:
                        "⚠️ O sistema de boas-vindas ainda não foi configurado.",
                    ephemeral: true
                });

                return;
            }

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        "👋 Configuração de Boas-vindas"
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
                                    : "Não configurado",
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
                ephemeral: true
            });

            return;
        }

        // =================================================
        // 🧪 TESTE
        // =================================================

        if (
            subcomando === "teste"
        ) {
            const config =
                await getJoinConfig(
                    guildId
                );

            if (!config) {
                await interaction.reply({
                    content:
                        "⚠️ Configure o sistema primeiro com `/join configurar`.",
                    ephemeral: true
                });

                return;
            }

            if (!config.canal_id) {
                await interaction.reply({
                    content:
                        "⚠️ Nenhum canal de boas-vindas foi configurado.",
                    ephemeral: true
                });

                return;
            }

            const canal =
                interaction.guild.channels.cache.get(
                    config.canal_id
                );

            if (!canal) {
                await interaction.reply({
                    content:
                        "❌ O canal configurado não foi encontrado.",
                    ephemeral: true
                });

                return;
            }

            const dados = {
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
                banner: "",
                members:
                    interaction.guild.memberCount,
                server:
                    interaction.guild.name
            };

            const embed =
                criarEmbedBoasVindas(
                    config,
                    dados
                );

            const mensagem = {};

            if (
                config.content
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
                    ephemeral: true
                });

                return;
            }

            await canal.send(
                mensagem
            );

            await interaction.reply({
                content:
                    `✅ Mensagem de teste enviada em ${canal}.`,
                ephemeral: true
            });

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
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content:
                    "❌ Ocorreu um erro ao executar o comando.",
                ephemeral: true
            });
        }
    }
}

// =====================================================
// 📤 EXPORTAR
// =====================================================

module.exports = {
    data,
    execute,
    enviarBoasVindas
};
