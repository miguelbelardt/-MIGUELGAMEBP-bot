const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Criar tabelas e corrigir dados antigos
async function inicializarBanco() {

    // ================================
    // 👤 USUÁRIOS
    // ================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id VARCHAR(30) PRIMARY KEY,
            saldo BIGINT NOT NULL DEFAULT 0,
            xp BIGINT NOT NULL DEFAULT 0,
            ultimo_daily BIGINT,
            notificacao_daily BOOLEAN NOT NULL DEFAULT FALSE,
            notificacao_daily_em BIGINT
        )
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS ultimo_daily BIGINT
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS notificacao_daily BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS notificacao_daily_em BIGINT
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS xp BIGINT NOT NULL DEFAULT 0
    `);

    await pool.query(`
        UPDATE usuarios
        SET saldo = 0
        WHERE saldo IS NULL
    `);

    await pool.query(`
        UPDATE usuarios
        SET xp = 0
        WHERE xp IS NULL
    `);

    await pool.query(`
        UPDATE usuarios
        SET notificacao_daily = FALSE
        WHERE notificacao_daily IS NULL
    `);

    await pool.query(`
        UPDATE usuarios
        SET notificacao_daily_em = NULL
        WHERE notificacao_daily = FALSE
    `);

    // ================================
    // 👑 ADMS
    // ================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS adms (
            id VARCHAR(30) PRIMARY KEY
        )
    `);

    // ================================
    // 🎉 SORTEIOS
    // ================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sorteios (
            id BIGSERIAL PRIMARY KEY,
            guild_id VARCHAR(30) NOT NULL,
            canal_id VARCHAR(30) NOT NULL,
            titulo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            cor VARCHAR(20),
            imagem TEXT,
            thumbnail TEXT,
            encerra_em BIGINT NOT NULL,
            vencedores INTEGER NOT NULL DEFAULT 1,
            vencedores_ids VARCHAR(30)[] DEFAULT '{}',
            encerrado BOOLEAN NOT NULL DEFAULT FALSE,
            criado_em BIGINT NOT NULL DEFAULT (
                EXTRACT(EPOCH FROM NOW()) * 1000
            )
        )
    `);

    await pool.query(`
        ALTER TABLE sorteios
        ADD COLUMN IF NOT EXISTS criador_id VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE sorteios
        ADD COLUMN IF NOT EXISTS mensagem_id VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE sorteios
        ADD COLUMN IF NOT EXISTS mostrar_participantes BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE sorteios
        ADD COLUMN IF NOT EXISTS encerrado_em BIGINT
    `);

    await pool.query(`
        UPDATE sorteios
        SET mostrar_participantes = FALSE
        WHERE mostrar_participantes IS NULL
    `);

    // ================================
    // 🎟️ PARTICIPANTES DOS SORTEIOS
    // ================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sorteio_participantes (
            sorteio_id BIGINT NOT NULL,
            user_id VARCHAR(30) NOT NULL,

            PRIMARY KEY (
                sorteio_id,
                user_id
            ),

            FOREIGN KEY (
                sorteio_id
            )
            REFERENCES sorteios(id)
            ON DELETE CASCADE
        )
    `);

    // ================================
    // 📋 CONFIGURAÇÃO DE LOGS
    // ================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS logs_config (
            guild_id VARCHAR(30) NOT NULL,
            tipo VARCHAR(30) NOT NULL,
            canal_id VARCHAR(30) NOT NULL,

            PRIMARY KEY (
                guild_id,
                tipo
            )
        )
    `);

    // ================================
    // 🎫 MODELOS DE TICKETS
    // ================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ticket_modelos (
            id BIGSERIAL PRIMARY KEY,
            guild_id VARCHAR(30) NOT NULL,
            nome VARCHAR(100) NOT NULL,

            autor_nome VARCHAR(256),
            autor_icone TEXT,

            titulo VARCHAR(256),
            descricao TEXT,

            cor VARCHAR(20),

            imagem TEXT,
            thumbnail TEXT,

            rodape VARCHAR(2048),
            rodape_icone TEXT,

            botao_texto VARCHAR(80) NOT NULL DEFAULT 'Fazer Ticket',
            botao_emoji VARCHAR(100),
            botao_estilo VARCHAR(20) NOT NULL DEFAULT 'Primary',

            criado_em BIGINT NOT NULL DEFAULT (
                EXTRACT(EPOCH FROM NOW()) * 1000
            )
        )
    `);

    // ================================
    // 🎫 CONFIGURAÇÃO DOS TICKETS
    // ================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ticket_config (
            guild_id VARCHAR(30) PRIMARY KEY,

            modelo_id BIGINT,

            canal_painel_id VARCHAR(30),

            configurado BOOLEAN NOT NULL DEFAULT FALSE,

            FOREIGN KEY (
                modelo_id
            )
            REFERENCES ticket_modelos(id)
            ON DELETE SET NULL
        )
    `);

    // ================================
    // 🎨 EMBEDS PERSONALIZADOS
    // ================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS embeds_personalizados (
            id BIGSERIAL PRIMARY KEY,

            guild_id VARCHAR(30) NOT NULL,

            nome VARCHAR(100) NOT NULL DEFAULT 'Embed',

            autor_nome VARCHAR(256),
            autor_icone TEXT,

            titulo VARCHAR(256),
            descricao TEXT,

            cor VARCHAR(20),

            imagem TEXT,
            thumbnail TEXT,

            rodape VARCHAR(2048),
            rodape_icone TEXT,

            timestamp BOOLEAN NOT NULL DEFAULT FALSE,

            canal_id VARCHAR(30),
            mensagem_id VARCHAR(30),

            criado_por VARCHAR(30),

            criado_em BIGINT NOT NULL DEFAULT (
                EXTRACT(EPOCH FROM NOW()) * 1000
            ),

            atualizado_em BIGINT NOT NULL DEFAULT (
                EXTRACT(EPOCH FROM NOW()) * 1000
            )
        )
    `);

    // Corrige bancos antigos caso alguma coluna ainda não exista.

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS nome VARCHAR(100)
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS autor_nome VARCHAR(256)
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS autor_icone TEXT
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS titulo VARCHAR(256)
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS descricao TEXT
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS cor VARCHAR(20)
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS imagem TEXT
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS thumbnail TEXT
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS rodape VARCHAR(2048)
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS rodape_icone TEXT
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS timestamp BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS canal_id VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS mensagem_id VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS criado_por VARCHAR(30)
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS criado_em BIGINT NOT NULL DEFAULT (
            EXTRACT(EPOCH FROM NOW()) * 1000
        )
    `);

    await pool.query(`
        ALTER TABLE embeds_personalizados
        ADD COLUMN IF NOT EXISTS atualizado_em BIGINT NOT NULL DEFAULT (
            EXTRACT(EPOCH FROM NOW()) * 1000
        )
    `);

    await pool.query(`
        UPDATE embeds_personalizados
        SET nome = 'Embed'
        WHERE nome IS NULL OR nome = ''
    `);

    console.log(
        "💾 Banco de dados conectado e tabelas prontas!"
    );
}

// ================================
// 👤 USUÁRIO
// ================================

async function criarUsuario(userId) {
    await pool.query(
        `
        INSERT INTO usuarios (
            id,
            saldo,
            xp,
            ultimo_daily,
            notificacao_daily,
            notificacao_daily_em
        )
        VALUES ($1, 0, 0, NULL, FALSE, NULL)
        ON CONFLICT (id) DO NOTHING
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET saldo = 0
        WHERE id = $1 AND saldo IS NULL
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET xp = 0
        WHERE id = $1 AND xp IS NULL
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET notificacao_daily = FALSE
        WHERE id = $1 AND notificacao_daily IS NULL
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET notificacao_daily_em = NULL
        WHERE id = $1
        AND notificacao_daily = FALSE
        `,
        [userId]
    );
}

// ================================
// 💰 SISTEMA DE MOEDAS
// ================================

async function getSaldo(userId) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        `
        SELECT COALESCE(saldo, 0) AS saldo
        FROM usuarios
        WHERE id = $1
        `,
        [userId]
    );

    return Number(resultado.rows[0].saldo);
}

async function alterarSaldo(userId, quantidade) {
    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET saldo = COALESCE(saldo, 0) + $1
        WHERE id = $2
        `,
        [quantidade, userId]
    );
}

// ================================
// ⭐ SISTEMA DE XP
// ================================

async function getXP(userId) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        `
        SELECT COALESCE(xp, 0) AS xp
        FROM usuarios
        WHERE id = $1
        `,
        [userId]
    );

    return Number(resultado.rows[0].xp);
}

async function adicionarXP(userId, quantidade) {
    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET xp = COALESCE(xp, 0) + $1
        WHERE id = $2
        `,
        [quantidade, userId]
    );
}

async function removerXP(userId, quantidade) {
    await criarUsuario(userId);

    quantidade = Number(quantidade);

    if (
        !Number.isInteger(quantidade) ||
        quantidade <= 0
    ) {
        throw new Error(
            "A quantidade de XP deve ser maior que zero."
        );
    }

    await pool.query(
        `
        UPDATE usuarios
        SET xp = GREATEST(
            COALESCE(xp, 0) - $1,
            0
        )
        WHERE id = $2
        `,
        [quantidade, userId]
    );
}

async function setarXP(userId, quantidade) {
    await criarUsuario(userId);

    quantidade = Number(quantidade);

    if (
        !Number.isInteger(quantidade) ||
        quantidade < 0
    ) {
        throw new Error(
            "A quantidade de XP não pode ser negativa."
        );
    }

    await pool.query(
        `
        UPDATE usuarios
        SET xp = $1
        WHERE id = $2
        `,
        [quantidade, userId]
    );
}

async function getRankingXP(limite = 10) {
    const resultado = await pool.query(
        `
        SELECT id, xp
        FROM usuarios
        ORDER BY xp DESC, id ASC
        LIMIT $1
        `,
        [limite]
    );

    return resultado.rows.map((usuario, index) => ({
        id: usuario.id,
        xp: Number(usuario.xp),
        posicao: index + 1
    }));
}

// ================================
// 🎁 SISTEMA DE DAILY
// ================================

async function getUltimoDaily(userId) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        `
        SELECT ultimo_daily
        FROM usuarios
        WHERE id = $1
        `,
        [userId]
    );

    return resultado.rows[0]?.ultimo_daily
        ? Number(resultado.rows[0].ultimo_daily)
        : null;
}

async function salvarUltimoDaily(userId, timestamp) {
    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET ultimo_daily = $1
        WHERE id = $2
        `,
        [timestamp, userId]
    );
}

async function getNotificacaoDaily(userId) {
    await criarUsuario(userId);

    const resultado = await pool.query(
        `
        SELECT notificacao_daily
        FROM usuarios
        WHERE id = $1
        `,
        [userId]
    );

    return resultado.rows[0]?.notificacao_daily === true;
}

async function salvarNotificacaoDaily(
    userId,
    ativada,
    horario = null
) {
    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET
            notificacao_daily = $1,
            notificacao_daily_em = $2
        WHERE id = $3
        `,
        [
            ativada,
            ativada && horario
                ? Number(horario)
                : null,
            userId
        ]
    );
}

async function getUsuariosComNotificacaoDaily() {
    const resultado = await pool.query(
        `
        SELECT
            id,
            ultimo_daily,
            notificacao_daily_em
        FROM usuarios
        WHERE
            notificacao_daily = TRUE
            AND ultimo_daily IS NOT NULL
        `
    );

    return resultado.rows.map(usuario => ({
        id: usuario.id,
        ultimo_daily:
            Number(usuario.ultimo_daily),
        notificacao_daily_em:
            usuario.notificacao_daily_em
                ? Number(usuario.notificacao_daily_em)
                : null
    }));
}

// ================================
// 🏆 RANKING DE MOEDAS
// ================================

async function getRankingMoedasPaginado(
    userId,
    tipo = "global",
    usuariosServidor = [],
    pagina = 1,
    limite = 10
) {
    await criarUsuario(userId);

    pagina = Math.max(1, Number(pagina) || 1);
    limite = Math.max(1, Number(limite) || 10);

    const offset = (pagina - 1) * limite;

    let rankingResult;
    let totalResult;

    if (tipo === "global") {

        rankingResult = await pool.query(
            `
            SELECT
                id,
                COALESCE(saldo, 0) AS saldo
            FROM usuarios
            ORDER BY saldo DESC, id ASC
            LIMIT $1
            OFFSET $2
            `,
            [limite, offset]
        );

        totalResult = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM usuarios
            `
        );

    } else {

        if (
            !Array.isArray(usuariosServidor) ||
            usuariosServidor.length === 0
        ) {
            return {
                ranking: [],
                usuario: {
                    id: userId,
                    saldo: 0,
                    posicao: null
                },
                pagina: 1,
                totalPaginas: 1,
                totalUsuarios: 0
            };
        }

        rankingResult = await pool.query(
            `
            SELECT
                membros.id,
                COALESCE(u.saldo, 0) AS saldo
            FROM unnest($1::varchar[]) AS membros(id)
            LEFT JOIN usuarios u
                ON u.id = membros.id
            ORDER BY
                COALESCE(u.saldo, 0) DESC,
                membros.id ASC
            LIMIT $2
            OFFSET $3
            `,
            [
                usuariosServidor,
                limite,
                offset
            ]
        );

        totalResult = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM unnest($1::varchar[]) AS membros(id)
            `,
            [usuariosServidor]
        );
    }

    const ranking = rankingResult.rows.map(
        (usuario, index) => ({
            id: usuario.id,
            saldo: Number(usuario.saldo),
            posicao: offset + index + 1
        })
    );

    const totalUsuarios =
        Number(totalResult.rows[0].total);

    const totalPaginas =
        Math.max(
            1,
            Math.ceil(totalUsuarios / limite)
        );

    let saldoUsuario = 0;
    let posicaoUsuario = null;

    if (tipo === "global") {

        const usuarioAtual =
            await pool.query(
                `
                SELECT
                    id,
                    COALESCE(saldo, 0) AS saldo
                FROM usuarios
                WHERE id = $1
                `,
                [userId]
            );

        if (usuarioAtual.rows.length > 0) {

            saldoUsuario =
                Number(
                    usuarioAtual.rows[0].saldo
                );

            const posicao =
                await pool.query(
                    `
                    SELECT COUNT(*) + 1 AS posicao
                    FROM usuarios
                    WHERE saldo > $1
                    OR (
                        saldo = $1
                        AND id < $2
                    )
                    `,
                    [
                        saldoUsuario,
                        userId
                    ]
                );

            posicaoUsuario =
                Number(
                    posicao.rows[0].posicao
                );
        }

    } else {

        if (
            Array.isArray(usuariosServidor) &&
            usuariosServidor.includes(userId)
        ) {

            const usuarioAtual =
                await pool.query(
                    `
                    SELECT
                        COALESCE(saldo, 0) AS saldo
                    FROM usuarios
                    WHERE id = $1
                    `,
                    [userId]
                );

            saldoUsuario =
                usuarioAtual.rows.length > 0
                    ? Number(usuarioAtual.rows[0].saldo)
                    : 0;

            const posicao =
                await pool.query(
                    `
                    SELECT COUNT(*) + 1 AS posicao
                    FROM unnest($1::varchar[]) AS membros(id)
                    LEFT JOIN usuarios u
                        ON u.id = membros.id
                    WHERE
                        COALESCE(u.saldo, 0) > $2
                        OR (
                            COALESCE(u.saldo, 0) = $2
                            AND membros.id < $3
                        )
                    `,
                    [
                        usuariosServidor,
                        saldoUsuario,
                        userId
                    ]
                );

            posicaoUsuario =
                Number(
                    posicao.rows[0].posicao
                );
        }
    }

    return {
        ranking,

        usuario: {
            id: userId,
            saldo: saldoUsuario,
            posicao: posicaoUsuario
        },

        pagina,
        totalPaginas,
        totalUsuarios
    };
}

// ================================
// 🔄 RANKING ANTIGO
// ================================

async function getRankingMoedas(
    userId,
    limite = 10
) {
    const resultado =
        await getRankingMoedasPaginado(
            userId,
            "global",
            [],
            1,
            limite
        );

    return {
        ranking: resultado.ranking,
        usuario: resultado.usuario
    };
}

// ================================
// 👑 SISTEMA DE ADM DO BOT
// ================================

async function adicionarAdm(userId) {
    await pool.query(
        `
        INSERT INTO adms (id)
        VALUES ($1)
        ON CONFLICT (id) DO NOTHING
        `,
        [userId]
    );
}

async function removerAdm(userId) {
    await pool.query(
        `
        DELETE FROM adms
        WHERE id = $1
        `,
        [userId]
    );
}

async function isAdm(userId) {
    const resultado = await pool.query(
        `
        SELECT id
        FROM adms
        WHERE id = $1
        `,
        [userId]
    );

    return resultado.rows.length > 0;
}

// ================================
// 🎨 SISTEMA DE EMBEDS
// ================================

function normalizarConfigEmbed(config = {}) {
    return {
        nome:
            config.nome ||
            "Embed",

        autorNome:
            config.autorNome ??
            config.autor ??
            config.autor_nome ??
            null,

        autorIcone:
            config.autorIcone ??
            config.autor_icone ??
            null,

        titulo:
            config.titulo ??
            null,

        descricao:
            config.descricao ??
            null,

        cor:
            config.cor ||
            "#5865F2",

        imagem:
            config.imagem ||
            null,

        thumbnail:
            config.thumbnail ||
            null,

        rodape:
            config.rodape ??
            config.footer ??
            config.rodape_texto ??
            null,

        rodapeIcone:
            config.rodapeIcone ??
            config.footerIcone ??
            config.footer_icone ??
            null,

        timestamp:
            Boolean(
                config.timestamp
            ),

        canalId:
            config.canalId ??
            config.canal_id ??
            null,

        mensagemId:
            config.mensagemId ??
            config.mensagem_id ??
            null
    };
}

// Criar um novo embed.
//
// Compatível com:
// criarEmbedBanco(guildId, userId, config)
// e também:
// criarEmbedBanco(guildId, nome, config, userId)

async function criarEmbedBanco(
    guildId,
    segundoParametro,
    terceiroParametro,
    quartoParametro = null
) {
    let nome;
    let config;
    let criadorId;

    if (
        quartoParametro !== null
    ) {
        // Formato antigo:
        // guildId, nome, config, criadorId

        nome =
            segundoParametro ||
            "Embed";

        config =
            terceiroParametro ||
            {};

        criadorId =
            quartoParametro;
    } else {
        // Formato novo:
        // guildId, criadorId, config

        criadorId =
            segundoParametro;

        config =
            terceiroParametro ||
            {};

        nome =
            config.nome ||
            "Embed";
    }

    const dados =
        normalizarConfigEmbed(
            config
        );

    const resultado =
        await pool.query(
            `
            INSERT INTO embeds_personalizados (
                guild_id,
                nome,
                autor_nome,
                autor_icone,
                titulo,
                descricao,
                cor,
                imagem,
                thumbnail,
                rodape,
                rodape_icone,
                timestamp,
                canal_id,
                mensagem_id,
                criado_por
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12,
                $13, $14, $15
            )
            RETURNING *
            `,
            [
                guildId,
                nome,
                dados.autorNome,
                dados.autorIcone,
                dados.titulo,
                dados.descricao,
                dados.cor,
                dados.imagem,
                dados.thumbnail,
                dados.rodape,
                dados.rodapeIcone,
                dados.timestamp,
                dados.canalId,
                dados.mensagemId,
                criadorId
            ]
        );

    return resultado.rows[0];
}

// Atualiza o conteúdo/configuração de um embed.
//
// Novo formato:
// atualizarEmbedBanco(id, guildId, {
//     config,
//     canalId,
//     mensagemId
// })
//
// Também aceita o formato antigo:
// atualizarEmbedBanco(id, guildId, config)

async function atualizarEmbedBanco(
    id,
    guildId,
    dados
) {
    let config;
    let canalId;
    let mensagemId;

    if (
        dados &&
        dados.config
    ) {
        config =
            dados.config;

        canalId =
            dados.canalId ??
            dados.config.canalId ??
            null;

        mensagemId =
            dados.mensagemId ??
            dados.config.mensagemId ??
            null;
    } else {
        config =
            dados ||
            {};

        canalId =
            config.canalId ??
            null;

        mensagemId =
            config.mensagemId ??
            null;
    }

    const normalizado =
        normalizarConfigEmbed(
            config
        );

    const resultado =
        await pool.query(
            `
            UPDATE embeds_personalizados
            SET
                nome = $1,
                autor_nome = $2,
                autor_icone = $3,
                titulo = $4,
                descricao = $5,
                cor = $6,
                imagem = $7,
                thumbnail = $8,
                rodape = $9,
                rodape_icone = $10,
                timestamp = $11,
                canal_id = $12,
                mensagem_id = $13,
                atualizado_em = (
                    EXTRACT(EPOCH FROM NOW()) * 1000
                )
            WHERE
                id = $14
                AND guild_id = $15
            RETURNING *
            `,
            [
                normalizado.nome,
                normalizado.autorNome,
                normalizado.autorIcone,
                normalizado.titulo,
                normalizado.descricao,
                normalizado.cor,
                normalizado.imagem,
                normalizado.thumbnail,
                normalizado.rodape,
                normalizado.rodapeIcone,
                normalizado.timestamp,
                canalId,
                mensagemId,
                id,
                guildId
            ]
        );

    return resultado.rows[0] || null;
}

async function getEmbedsDoServidor(
    guildId
) {
    const resultado =
        await pool.query(
            `
            SELECT *
            FROM embeds_personalizados
            WHERE guild_id = $1
            ORDER BY id ASC
            `,
            [guildId]
        );

    return resultado.rows;
}

// Compatível com:
// getEmbedPorId(id)
// e:
// getEmbedPorId(id, guildId)

async function getEmbedPorId(
    id,
    guildId = null
) {
    let resultado;

    if (guildId) {

        resultado =
            await pool.query(
                `
                SELECT *
                FROM embeds_personalizados
                WHERE
                    id = $1
                    AND guild_id = $2
                `,
                [
                    id,
                    guildId
                ]
            );

    } else {

        resultado =
            await pool.query(
                `
                SELECT *
                FROM embeds_personalizados
                WHERE id = $1
                `,
                [id]
            );
    }

    return (
        resultado.rows[0] ||
        null
    );
}

// Salva a mensagem publicada.
//
// Novo formato:
// salvarMensagemEmbed(id, canalId, mensagemId)
//
// Formato antigo:
// salvarMensagemEmbed(id, guildId, canalId, mensagemId)

async function salvarMensagemEmbed(
    id,
    segundoParametro,
    terceiroParametro,
    quartoParametro = null
) {
    let guildId = null;
    let canalId;
    let mensagemId;

    if (
        quartoParametro !== null
    ) {
        guildId =
            segundoParametro;

        canalId =
            terceiroParametro;

        mensagemId =
            quartoParametro;
    } else {
        canalId =
            segundoParametro;

        mensagemId =
            terceiroParametro;
    }

    let resultado;

    if (guildId) {

        resultado =
            await pool.query(
                `
                UPDATE embeds_personalizados
                SET
                    canal_id = $1,
                    mensagem_id = $2,
                    atualizado_em = (
                        EXTRACT(EPOCH FROM NOW()) * 1000
                    )
                WHERE
                    id = $3
                    AND guild_id = $4
                RETURNING *
                `,
                [
                    canalId,
                    mensagemId,
                    id,
                    guildId
                ]
            );

    } else {

        resultado =
            await pool.query(
                `
                UPDATE embeds_personalizados
                SET
                    canal_id = $1,
                    mensagem_id = $2,
                    atualizado_em = (
                        EXTRACT(EPOCH FROM NOW()) * 1000
                    )
                WHERE id = $3
                RETURNING *
                `,
                [
                    canalId,
                    mensagemId,
                    id
                ]
            );
    }

    return resultado.rows[0] || null;
}

async function atualizarCanalEmbed(
    id,
    guildId,
    canalId
) {
    const resultado =
        await pool.query(
            `
            UPDATE embeds_personalizados
            SET
                canal_id = $1,
                atualizado_em = (
                    EXTRACT(EPOCH FROM NOW()) * 1000
                )
            WHERE
                id = $2
                AND guild_id = $3
            RETURNING *
            `,
            [
                canalId,
                id,
                guildId
            ]
        );

    return resultado.rows[0] || null;
}

async function excluirEmbedBanco(
    id,
    guildId
) {
    const resultado =
        await pool.query(
            `
            DELETE FROM embeds_personalizados
            WHERE
                id = $1
                AND guild_id = $2
            RETURNING *
            `,
            [
                id,
                guildId
            ]
        );

    return resultado.rows[0] || null;
}

// ================================
// 📦 EXPORTAÇÕES
// ================================

module.exports = {
    pool,
    inicializarBanco,
    criarUsuario,

    // 💰 Moedas
    getSaldo,
    alterarSaldo,

    // ⭐ XP
    getXP,
    adicionarXP,
    removerXP,
    setarXP,
    getRankingXP,

    // 🎁 Daily
    getUltimoDaily,
    salvarUltimoDaily,
    getNotificacaoDaily,
    salvarNotificacaoDaily,
    getUsuariosComNotificacaoDaily,

    // 🏆 Ranking
    getRankingMoedas,
    getRankingMoedasPaginado,

    // 👑 ADM
    adicionarAdm,
    removerAdm,
    isAdm,

    // 🎨 Embeds
    criarEmbedBanco,
    atualizarEmbedBanco,
    getEmbedsDoServidor,
    getEmbedPorId,
    salvarMensagemEmbed,
    atualizarCanalEmbed,
    excluirEmbedBanco
};
