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
            notificacao_daily BOOLEAN NOT NULL DEFAULT FALSE
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

    // Dados usados para editar o sorteio depois de enviado
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

    // Corrigir possíveis valores antigos nulos
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

    console.log(
        "💾 Banco de dados conectado e tabelas prontas!"
    );
}

// Criar usuário se não existir
async function criarUsuario(userId) {
    await pool.query(
        `
        INSERT INTO usuarios (
            id,
            saldo,
            xp,
            ultimo_daily,
            notificacao_daily
        )
        VALUES ($1, 0, 0, NULL, FALSE)
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
}

// ================================
// 💰 SISTEMA DE MOEDAS
// ================================

// Pegar saldo
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

// Alterar saldo
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

// Pegar XP
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

// Adicionar XP
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

// Remover XP
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

// Definir XP
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

// Pegar ranking de XP
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

// Pegar horário do último Daily
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

// Salvar horário do último Daily
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

// Pegar estado da notificação do Daily
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

// Salvar estado da notificação do Daily
async function salvarNotificacaoDaily(userId, ativada) {
    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET notificacao_daily = $1
        WHERE id = $2
        `,
        [ativada, userId]
    );
}

// Pegar usuários com notificação do Daily ativada
async function getUsuariosComNotificacaoDaily() {
    const resultado = await pool.query(
        `
        SELECT id, ultimo_daily
        FROM usuarios
        WHERE notificacao_daily = TRUE
        AND ultimo_daily IS NOT NULL
        `
    );

    return resultado.rows.map(usuario => ({
        id: usuario.id,
        ultimo_daily: Number(usuario.ultimo_daily)
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

// Adicionar ADM
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

// Remover ADM
async function removerAdm(userId) {
    await pool.query(
        `
        DELETE FROM adms
        WHERE id = $1
        `,
        [userId]
    );
}

// Verificar se é ADM
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
    isAdm
};
