const {
    EmbedBuilder
} = require("discord.js");

const {
    getJoinConfig
} = require("../database/database");

// =====================================================
// 🔄 SUBSTITUIR VARIÁVEIS
// =====================================================

function substituirVariaveis(
    texto,
    dados
) {

    if (
        texto === null ||
        texto === undefined
    ) {
        return "";
    }

    return String(texto)

        .replace(
            /\{user\}/gi,
            dados.user
        )

        .replace(
            /\{username\}/gi,
            dados.username
        )

        .replace(
            /\{userid\}/gi,
            dados.userid
        )

        .replace(
            /\{avatar\}/gi,
            dados.avatar
        )

        .replace(
            /\{banner\}/gi,
            dados.banner || ""
        )

        .replace(
            /\{members\}/gi,
            String(dados.members)
        )

        .replace(
            /\{server\}/gi,
            dados.server
        );
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

    if (
        typeof cor === "number"
    ) {
        return cor;
    }

    if (
        typeof cor === "string"
    ) {

        const valor =
            cor.trim();

        if (
            valor.startsWith("0x")
        ) {

            const numero =
                Number.parseInt(
                    valor,
                    16
                );

            if (
                !Number.isNaN(numero)
            ) {
                return numero;
            }
        }

        if (
            valor.startsWith("#")
        ) {

            const numero =
                Number.parseInt(
                    valor.slice(1),
                    16
                );

            if (
                !Number.isNaN(numero)
            ) {
                return numero;
            }
        }

        const numero =
            Number(valor);

        if (
            !Number.isNaN(numero)
        ) {
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
// 👋 ENVIAR BOAS-VINDAS
// =====================================================

async function enviarBoasVindas(
    membro
) {

    try {

        // =================================================
        // 🛡️ VERIFICAÇÕES
        // =================================================

        if (
            !membro ||
            !membro.guild
        ) {
            return;
        }

        const guild =
            membro.guild;

        // =================================================
        // 🗄️ BUSCAR CONFIGURAÇÃO DO BANCO
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
        // ⚙️ VERIFICAR CONFIGURAÇÃO
        // =================================================

        if (
            !configBanco
        ) {

            console.log(
                `⚠️ Sistema de boas-vindas não configurado para ${guild.name}.`
            );

            return;
        }

        // =================================================
        // 🔴 SISTEMA DESATIVADO
        // =================================================

        if (
            configBanco.habilitado === false ||
            configBanco.habilitado === 0 ||
            configBanco.habilitado === "0" ||
            configBanco.habilitado === "false"
        ) {

            return;
        }

        // =================================================
        // 📢 CANAL CONFIGURADO
        // =================================================

        const canalId =
            configBanco.canal_id;

        if (
            !canalId
        ) {

            console.log(
                `⚠️ Canal de boas-vindas não configurado em ${guild.name}.`
            );

            return;
        }

        // =================================================
        // 🔎 BUSCAR CANAL
        // =================================================

        const canal =
            guild.channels.cache.get(
                canalId
            );

        if (
            !canal
        ) {

            console.error(
                `❌ Canal de boas-vindas não encontrado: ${canalId}`
            );

            return;
        }

        // =================================================
        // 📝 VERIFICAR CANAL DE TEXTO
        // =================================================

        if (
            !canal.isTextBased()
        ) {

            console.error(
                `❌ O canal configurado para boas-vindas não é um canal de texto: ${canalId}`
            );

            return;
        }

        // =================================================
        // 👤 BUSCAR DADOS ATUALIZADOS DO USUÁRIO
        // =================================================

        let usuario =
            membro.user;

        try {

            usuario =
                await membro.user.fetch();

        } catch (erro) {

            console.warn(
                "⚠️ Não foi possível atualizar os dados do usuário:",
                erro
            );
        }

        // =================================================
        // 🖼️ AVATAR
        // =================================================

        const avatar =
            usuario.displayAvatarURL({
                extension: "png",
                size: 1024
            });

        // =================================================
        // 🖼️ BANNER
        // =================================================

        let banner =
            "";

        if (
            usuario.banner
        ) {

            banner =
                usuario.bannerURL({
                    extension: "png",
                    size: 2048
                }) || "";
        }

        // =================================================
        // 👥 QUANTIDADE DE MEMBROS
        // =================================================

        const membros =
            guild.memberCount;

        // =================================================
        // 📦 DADOS DAS VARIÁVEIS
        // =================================================

        const dados = {

            user:
                `<@${membro.id}>`,

            username:
                usuario.username,

            userid:
                membro.id,

            avatar:
                avatar,

            banner:
                banner,

            members:
                membros,

            server:
                guild.name
        };

        // =================================================
        // 🎨 EMBED
        // =================================================

        let embed = null;

        if (
            estaAtivado(
                configBanco.embed_habilitado
            )
        ) {

            embed =
                new EmbedBuilder();

            // =================================================
            // 📝 TÍTULO
            // =================================================

            if (
                configBanco.embed_titulo
            ) {

                const titulo =
                    substituirVariaveis(
                        configBanco.embed_titulo,
                        dados
                    );

                if (
                    titulo
                ) {

                    embed.setTitle(
                        titulo
                    );
                }
            }

            // =================================================
            // 📄 DESCRIÇÃO
            // =================================================

            if (
                configBanco.embed_descricao
            ) {

                const descricao =
                    substituirVariaveis(
                        configBanco.embed_descricao,
                        dados
                    );

                if (
                    descricao
                ) {

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

                if (
                    nomeAutor
                ) {

                    const autor = {
                        name:
                            nomeAutor
                    };

                    if (
                        urlValida(
                            iconeAutor
                        )
                    ) {

                        autor.iconURL =
                            iconeAutor;
                    }

                    embed.setAuthor(
                        autor
                    );
                }
            }

            // =================================================
            // 🖼️ THUMBNAIL
            // =================================================

            if (
                configBanco.thumbnail
            ) {

                const thumbnail =
                    substituirVariaveis(
                        configBanco.thumbnail,
                        dados
                    );

                if (
                    urlValida(
                        thumbnail
                    )
                ) {

                    embed.setThumbnail(
                        thumbnail
                    );
                }
            }

            // =================================================
            // 🖼️ IMAGEM / BANNER
            // =================================================

            if (
                configBanco.imagem
            ) {

                const imagem =
                    substituirVariaveis(
                        configBanco.imagem,
                        dados
                    );

                if (
                    urlValida(
                        imagem
                    )
                ) {

                    embed.setImage(
                        imagem
                    );
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

                embed.setFooter(
                    footer
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

                // Adiciona somente a data/hora
                // em que a mensagem foi enviada.

                embed.setTimestamp();
            }
        }

        // =================================================
        // 📤 MONTAR MENSAGEM
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

        if (
            embed
        ) {

            mensagem.embeds = [
                embed
            ];
        }

        // =================================================
        // 🛑 NADA PARA ENVIAR
        // =================================================

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
        // 📩 ENVIAR MENSAGEM
        // =================================================

        await canal.send(
            mensagem
        );

        // =================================================
        // 📋 LOG
        // =================================================

        console.log(
            `👋 Boas-vindas enviadas para ${usuario.tag} em ${guild.name}`
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao enviar mensagem de boas-vindas:",
            erro
        );
    }
}

// =====================================================
// 📤 EXPORTAR
// =====================================================

module.exports = {
    enviarBoasVindas
};
