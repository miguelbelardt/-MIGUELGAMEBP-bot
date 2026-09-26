const mysql = require("mysql2/promise");

// =====================================================
// 🔐 CONEXÃO COM MYSQL 8
// =====================================================

if (!process.env.DATABASE_URL) {
    throw new Error(
        "❌ DATABASE_URL não foi encontrada nas variáveis de ambiente."
    );
}

const mysqlPool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// =====================================================
// 🔄 COMPATIBILIDADE COM O CÓDIGO ANTIGO
// =====================================================
//
// O projeto antigo usava PostgreSQL com:
// $1, $2, $3...
//
// Aqui convertemos automaticamente para:
// ?, ?, ?
//
// Também devolvemos:
// resultado.rows
//
// para manter o restante do bot compatível.
// =====================================================

function converterPlaceholders(sql) {
    return sql.replace(/\$(\d+)/g, "?");
}

const pool = {
    async query(sql, parametros = []) {

        const sqlMySQL =
            converterPlaceholders(sql);

        const [resultado] =
            await mysqlPool.query(
                sqlMySQL,
                parametros
            );

        if (Array.isArray(resultado)) {

            return {
                rows: resultado,
                rowCount: resultado.length
            };

        }

        return {
            rows: [],
            rowCount:
                resultado.affectedRows || 0,

            insertId:
                resultado.insertId || 0,

            affectedRows:
                resultado.affectedRows || 0
        };
    }
};

// =====================================================
// 🧰 FUNÇÕES AUXILIARES
// =====================================================

async function colunaExiste(
    tabela,
    coluna
) {

    const [resultado] =
        await mysqlPool.query(
            `
            SELECT COUNT(*) AS total
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE
                TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                AND COLUMN_NAME = ?
            `,
            [
                tabela,
                coluna
            ]
        );

    return Number(
        resultado[0].total
    ) > 0;
}

async function adicionarColunaSeNaoExiste(
    tabela,
    coluna,
    definicao
) {

    const existe =
        await colunaExiste(
            tabela,
            coluna
        );

    if (!existe) {

        await mysqlPool.query(
            `
            ALTER TABLE \`${tabela}\`
            ADD COLUMN \`${coluna}\`
            ${definicao}
            `
        );
    }
}

function agoraMs() {
    return Date.now();
}

// =====================================================
// 🏗️ INICIALIZAR BANCO
// =====================================================

async function inicializarBanco() {

    // ================================
    // 👤 USUÁRIOS
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id VARCHAR(30) PRIMARY KEY,
            saldo BIGINT NOT NULL DEFAULT 0,
            xp BIGINT NOT NULL DEFAULT 0,
            ultimo_daily BIGINT,
            daily_sequencia BIGINT NOT NULL DEFAULT 0,
            notificacao_daily BOOLEAN NOT NULL DEFAULT FALSE,
            notificacao_daily_em BIGINT
        )
    `);

    await adicionarColunaSeNaoExiste(
        "usuarios",
        "ultimo_daily",
        "BIGINT"
    );

    await adicionarColunaSeNaoExiste(
        "usuarios",
        "daily_sequencia",
        "BIGINT NOT NULL DEFAULT 0"
    );

    await adicionarColunaSeNaoExiste(
        "usuarios",
        "notificacao_daily",
        "BOOLEAN NOT NULL DEFAULT FALSE"
    );

    await adicionarColunaSeNaoExiste(
        "usuarios",
        "notificacao_daily_em",
        "BIGINT"
    );

    await adicionarColunaSeNaoExiste(
        "usuarios",
        "xp",
        "BIGINT NOT NULL DEFAULT 0"
    );

    await mysqlPool.query(`
        UPDATE usuarios
        SET saldo = 0
        WHERE saldo IS NULL
    `);

    await mysqlPool.query(`
        UPDATE usuarios
        SET xp = 0
        WHERE xp IS NULL
    `);

    await mysqlPool.query(`
        UPDATE usuarios
        SET daily_sequencia = 0
        WHERE daily_sequencia IS NULL
    `);

    await mysqlPool.query(`
        UPDATE usuarios
        SET notificacao_daily = FALSE
        WHERE notificacao_daily IS NULL
    `);

    await mysqlPool.query(`
        UPDATE usuarios
        SET notificacao_daily_em = NULL
        WHERE notificacao_daily = FALSE
    `);

    // ================================
    // 👑 ADMS
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS adms (
            id VARCHAR(30) PRIMARY KEY
        )
    `);

    // ================================
    // 🎉 SORTEIOS
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS sorteios (
            id BIGINT NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(30) NOT NULL,
            canal_id VARCHAR(30) NOT NULL,
            titulo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            cor VARCHAR(20),
            imagem TEXT,
            thumbnail TEXT,
            encerra_em BIGINT NOT NULL,
            vencedores INT NOT NULL DEFAULT 1,
            vencedores_ids JSON,
            encerrado BOOLEAN NOT NULL DEFAULT FALSE,
            criado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            PRIMARY KEY (id)
        )
    `);

    await adicionarColunaSeNaoExiste(
        "sorteios",
        "criador_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "sorteios",
        "mensagem_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "sorteios",
        "mostrar_participantes",
        "BOOLEAN NOT NULL DEFAULT FALSE"
    );

    await adicionarColunaSeNaoExiste(
        "sorteios",
        "encerrado_em",
        "BIGINT"
    );

    await adicionarColunaSeNaoExiste(
        "sorteios",
        "vencedores_ids",
        "JSON"
    );

    await mysqlPool.query(`
        UPDATE sorteios
        SET mostrar_participantes = FALSE
        WHERE mostrar_participantes IS NULL
    `);

    // ================================
    // 🎟️ PARTICIPANTES DOS SORTEIOS
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS sorteio_participantes (
            sorteio_id BIGINT NOT NULL,
            user_id VARCHAR(30) NOT NULL,

            PRIMARY KEY (
                sorteio_id,
                user_id
            ),

            CONSTRAINT fk_sorteio_participantes
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

    await mysqlPool.query(`
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

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS ticket_modelos (
            id BIGINT NOT NULL AUTO_INCREMENT,
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

            botao_texto VARCHAR(80)
                NOT NULL DEFAULT 'Fazer Ticket',

            botao_emoji VARCHAR(100),

            botao_estilo VARCHAR(20)
                NOT NULL DEFAULT 'Primary',

            criado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            PRIMARY KEY (id)
        )
    `);

    // ================================
    // 🎫 CONFIGURAÇÃO DOS TICKETS
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS ticket_config (
            guild_id VARCHAR(30) PRIMARY KEY,

            modelo_id BIGINT,

            canal_painel_id VARCHAR(30),

            categoria_id VARCHAR(30),

            mensagem_painel_id VARCHAR(30),

            cargo_mencao_id VARCHAR(30),

            ticket_contador BIGINT NOT NULL DEFAULT 0,

            mostrar_numero_nome BOOLEAN
                NOT NULL DEFAULT FALSE,

            configurado BOOLEAN
                NOT NULL DEFAULT FALSE,

            CONSTRAINT fk_ticket_modelo
            FOREIGN KEY (
                modelo_id
            )
            REFERENCES ticket_modelos(id)
            ON DELETE SET NULL
        )
    `);

    // ================================
    // 🔧 MIGRAÇÕES DOS TICKETS
    // ================================

    await adicionarColunaSeNaoExiste(
        "ticket_config",
        "categoria_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "ticket_config",
        "mensagem_painel_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "ticket_config",
        "cargo_mencao_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "ticket_config",
        "ticket_contador",
        "BIGINT NOT NULL DEFAULT 0"
    );

    await adicionarColunaSeNaoExiste(
        "ticket_config",
        "mostrar_numero_nome",
        "BOOLEAN NOT NULL DEFAULT FALSE"
    );

    await adicionarColunaSeNaoExiste(
        "ticket_config",
        "configurado",
        "BOOLEAN NOT NULL DEFAULT FALSE"
    );

    await mysqlPool.query(`
        UPDATE ticket_config
        SET ticket_contador = 0
        WHERE ticket_contador IS NULL
    `);

    await mysqlPool.query(`
        UPDATE ticket_config
        SET mostrar_numero_nome = FALSE
        WHERE mostrar_numero_nome IS NULL
    `);

    await mysqlPool.query(`
        UPDATE ticket_config
        SET configurado = FALSE
        WHERE configurado IS NULL
    `);

    // ================================
    // 🎨 EMBEDS PERSONALIZADOS
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS embeds_personalizados (
            id BIGINT NOT NULL AUTO_INCREMENT,

            guild_id VARCHAR(30) NOT NULL,

            nome VARCHAR(100)
                NOT NULL DEFAULT 'Embed',

            autor_nome VARCHAR(256),
            autor_icone TEXT,

            titulo VARCHAR(256),
            descricao TEXT,

            cor VARCHAR(20),

            imagem TEXT,
            thumbnail TEXT,

            rodape VARCHAR(2048),
            rodape_icone TEXT,

            timestamp BOOLEAN
                NOT NULL DEFAULT FALSE,

            canal_id VARCHAR(30),
            mensagem_id VARCHAR(30),

            criado_por VARCHAR(30),

            criado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            atualizado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            PRIMARY KEY (id)
        )
    `);

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "nome",
        "VARCHAR(100) NOT NULL DEFAULT 'Embed'"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "autor_nome",
        "VARCHAR(256)"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "autor_icone",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "titulo",
        "VARCHAR(256)"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "descricao",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "cor",
        "VARCHAR(20)"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "imagem",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "thumbnail",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "rodape",
        "VARCHAR(2048)"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "rodape_icone",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "timestamp",
        "BOOLEAN NOT NULL DEFAULT FALSE"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "canal_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "mensagem_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "criado_por",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "criado_em",
        "BIGINT NOT NULL DEFAULT 0"
    );

    await adicionarColunaSeNaoExiste(
        "embeds_personalizados",
        "atualizado_em",
        "BIGINT NOT NULL DEFAULT 0"
    );

    await mysqlPool.query(`
        UPDATE embeds_personalizados
        SET nome = 'Embed'
        WHERE nome IS NULL
        OR nome = ''
    `);

    await mysqlPool.query(`
        UPDATE embeds_personalizados
        SET criado_em = ?
        WHERE criado_em = 0
    `, [agoraMs()]);

    await mysqlPool.query(`
        UPDATE embeds_personalizados
        SET atualizado_em = ?
        WHERE atualizado_em = 0
    `, [agoraMs()]);

    console.log(
        "💾 Banco de dados MySQL 8 conectado e tabelas prontas!"
    );
}

// =====================================================
// 👤 USUÁRIO
// =====================================================

async function criarUsuario(userId) {

    await pool.query(
        `
        INSERT IGNORE INTO usuarios (
            id,
            saldo,
            xp,
            ultimo_daily,
            daily_sequencia,
            notificacao_daily,
            notificacao_daily_em
        )
        VALUES (
            $1,
            0,
            0,
            NULL,
            0,
            FALSE,
            NULL
        )
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET saldo = 0
        WHERE id = $1
        AND saldo IS NULL
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET xp = 0
        WHERE id = $1
        AND xp IS NULL
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET daily_sequencia = 0
        WHERE id = $1
        AND daily_sequencia IS NULL
        `,
        [userId]
    );

    await pool.query(
        `
        UPDATE usuarios
        SET notificacao_daily = FALSE
        WHERE id = $1
        AND notificacao_daily IS NULL
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

// =====================================================
// 💰 SISTEMA DE MOEDAS
// =====================================================

async function getSaldo(userId) {

    await criarUsuario(userId);

    const resultado =
        await pool.query(
            `
            SELECT COALESCE(
                saldo,
                0
            ) AS saldo
            FROM usuarios
            WHERE id = $1
            `,
            [userId]
        );

    return Number(
        resultado.rows[0].saldo
    );
}

async function alterarSaldo(
    userId,
    quantidade
) {

    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET saldo =
            COALESCE(saldo, 0) + $1
        WHERE id = $2
        `,
        [
            quantidade,
            userId
        ]
    );
}

// =====================================================
// ⭐ SISTEMA DE XP
// =====================================================

async function getXP(userId) {

    await criarUsuario(userId);

    const resultado =
        await pool.query(
            `
            SELECT COALESCE(
                xp,
                0
            ) AS xp
            FROM usuarios
            WHERE id = $1
            `,
            [userId]
        );

    return Number(
        resultado.rows[0].xp
    );
}

async function adicionarXP(
    userId,
    quantidade
) {

    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET xp =
            COALESCE(xp, 0) + $1
        WHERE id = $2
        `,
        [
            quantidade,
            userId
        ]
    );
}

async function removerXP(
    userId,
    quantidade
) {

    await criarUsuario(userId);

    quantidade = Number(
        quantidade
    );

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
        [
            quantidade,
            userId
        ]
    );
}

async function setarXP(
    userId,
    quantidade
) {

    await criarUsuario(userId);

    quantidade = Number(
        quantidade
    );

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
        [
            quantidade,
            userId
        ]
    );
}

async function getRankingXP(
    limite = 10
) {

    const resultado =
        await pool.query(
            `
            SELECT
                id,
                xp
            FROM usuarios
            ORDER BY
                xp DESC,
                id ASC
            LIMIT $1
            `,
            [limite]
        );

    return resultado.rows.map(
        (usuario, index) => ({
            id: usuario.id,

            xp:
                Number(
                    usuario.xp
                ),

            posicao:
                index + 1
        })
    );
}

// =====================================================
// 🎁 SISTEMA DE DAILY
// =====================================================

async function getUltimoDaily(
    userId
) {

    await criarUsuario(userId);

    const resultado =
        await pool.query(
            `
            SELECT
                ultimo_daily
            FROM usuarios
            WHERE id = $1
            `,
            [userId]
        );

    return resultado.rows[0]?.ultimo_daily
        ? Number(
            resultado.rows[0].ultimo_daily
        )
        : null;
}

async function salvarUltimoDaily(
    userId,
    timestamp
) {

    await criarUsuario(userId);

    await pool.query(
        `
        UPDATE usuarios
        SET ultimo_daily = $1
        WHERE id = $2
        `,
        [
            timestamp,
            userId
        ]
    );
}

// =====================================================
// 🔥 SEQUÊNCIA DO DAILY
// =====================================================

async function getSequenciaDaily(
    userId
) {

    await criarUsuario(userId);

    const resultado =
        await pool.query(
            `
            SELECT
                daily_sequencia
            FROM usuarios
            WHERE id = $1
            `,
            [userId]
        );

    return resultado.rows[0]?.daily_sequencia
        ? Number(
            resultado.rows[0].daily_sequencia
        )
        : 0;
}

async function salvarSequenciaDaily(
    userId,
    sequencia
) {

    await criarUsuario(userId);

    sequencia = Math.max(
        0,
        Number(sequencia) || 0
    );

    await pool.query(
        `
        UPDATE usuarios
        SET daily_sequencia = $1
        WHERE id = $2
        `,
        [
            sequencia,
            userId
        ]
    );
}

async function getNotificacaoDaily(
    userId
) {

    await criarUsuario(userId);

    const resultado =
        await pool.query(
            `
            SELECT
                notificacao_daily
            FROM usuarios
            WHERE id = $1
            `,
            [userId]
        );

    return (
        resultado.rows[0]?.notificacao_daily === true ||
        Number(
            resultado.rows[0]?.notificacao_daily
        ) === 1
    );
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
            ativada ? 1 : 0,

            ativada && horario
                ? Number(horario)
                : null,

            userId
        ]
    );
}

async function getUsuariosComNotificacaoDaily() {

    const resultado =
        await pool.query(
            `
            SELECT
                id,
                ultimo_daily,
                daily_sequencia,
                notificacao_daily_em
            FROM usuarios
            WHERE
                notificacao_daily = TRUE
                AND ultimo_daily IS NOT NULL
            `
        );

    return resultado.rows.map(
        usuario => ({
            id: usuario.id,

            ultimo_daily:
                Number(
                    usuario.ultimo_daily
                ),

            daily_sequencia:
                Number(
                    usuario.daily_sequencia
                ) || 0,

            notificacao_daily_em:
                usuario.notificacao_daily_em
                    ? Number(
                        usuario.notificacao_daily_em
                    )
                    : null
        })
    );
}

// =====================================================
// 🏆 RANKING DE MOEDAS
// =====================================================

async function getRankingMoedasPaginado(
    userId,
    tipo = "global",
    usuariosServidor = [],
    pagina = 1,
    limite = 10
) {

    await criarUsuario(userId);

    pagina = Math.max(
        1,
        Number(pagina) || 1
    );

    limite = Math.max(
        1,
        Number(limite) || 10
    );

    const offset =
        (pagina - 1) * limite;

    let rankingResult;
    let totalResult;

    if (
        tipo === "global"
    ) {

        rankingResult =
            await pool.query(
                `
                SELECT
                    id,
                    COALESCE(
                        saldo,
                        0
                    ) AS saldo
                FROM usuarios
                ORDER BY
                    saldo DESC,
                    id ASC
                LIMIT $1
                OFFSET $2
                `,
                [
                    limite,
                    offset
                ]
            );

        totalResult =
            await pool.query(
                `
                SELECT COUNT(*) AS total
                FROM usuarios
                `
            );

    } else {

        if (
            !Array.isArray(
                usuariosServidor
            ) ||
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

        const usuariosJSON =
            JSON.stringify(
                usuariosServidor
            );

        rankingResult =
            await pool.query(
                `
                SELECT
                    membros.id,

                    COALESCE(
                        u.saldo,
                        0
                    ) AS saldo

                FROM JSON_TABLE(
                    $1,
                    '$[*]'
                    COLUMNS (
                        id VARCHAR(30)
                        PATH '$'
                    )
                ) AS membros

                LEFT JOIN usuarios u
                    ON u.id = membros.id

                ORDER BY
                    COALESCE(
                        u.saldo,
                        0
                    ) DESC,

                    membros.id ASC

                LIMIT $2
                OFFSET $3
                `,
                [
                    usuariosJSON,
                    limite,
                    offset
                ]
            );

        totalResult =
            await pool.query(
                `
                SELECT COUNT(*) AS total

                FROM JSON_TABLE(
                    $1,
                    '$[*]'
                    COLUMNS (
                        id VARCHAR(30)
                        PATH '$'
                    )
                ) AS membros
                `,
                [
                    usuariosJSON
                ]
            );
    }

    const ranking =
        rankingResult.rows.map(
            (usuario, index) => ({
                id: usuario.id,

                saldo:
                    Number(
                        usuario.saldo
                    ),

                posicao:
                    offset +
                    index +
                    1
            })
        );

    const totalUsuarios =
        Number(
            totalResult.rows[0].total
        );

    const totalPaginas =
        Math.max(
            1,
            Math.ceil(
                totalUsuarios /
                limite
            )
        );

    let saldoUsuario = 0;
    let posicaoUsuario = null;

    if (
        tipo === "global"
    ) {

        const usuarioAtual =
            await pool.query(
                `
                SELECT
                    id,

                    COALESCE(
                        saldo,
                        0
                    ) AS saldo

                FROM usuarios
                WHERE id = $1
                `,
                [userId]
            );

        if (
            usuarioAtual.rows.length > 0
        ) {

            saldoUsuario =
                Number(
                    usuarioAtual.rows[0].saldo
                );

            const posicao =
                await pool.query(
                    `
                    SELECT
                        COUNT(*) + 1 AS posicao

                    FROM usuarios

                    WHERE
                        saldo > $1

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
            Array.isArray(
                usuariosServidor
            ) &&
            usuariosServidor.includes(
                userId
            )
        ) {

            const usuarioAtual =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            saldo,
                            0
                        ) AS saldo
                    FROM usuarios
                    WHERE id = $1
                    `,
                    [userId]
                );

            saldoUsuario =
                usuarioAtual.rows.length > 0
                    ? Number(
                        usuarioAtual.rows[0].saldo
                    )
                    : 0;

            const usuariosJSON =
                JSON.stringify(
                    usuariosServidor
                );

            const posicao =
                await pool.query(
                    `
                    SELECT
                        COUNT(*) + 1 AS posicao

                    FROM JSON_TABLE(
                        $1,
                        '$[*]'
                        COLUMNS (
                            id VARCHAR(30)
                            PATH '$'
                        )
                    ) AS membros

                    LEFT JOIN usuarios u
                        ON u.id = membros.id

                    WHERE
                        COALESCE(
                            u.saldo,
                            0
                        ) > $2

                        OR (
                            COALESCE(
                                u.saldo,
                                0
                            ) = $2

                            AND membros.id < $3
                        )
                    `,
                    [
                        usuariosJSON,
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

// =====================================================
// 🔄 RANKING ANTIGO
// =====================================================

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
        ranking:
            resultado.ranking,

        usuario:
            resultado.usuario
    };
}

// =====================================================
// 👑 SISTEMA DE ADM
// =====================================================

async function adicionarAdm(
    userId
) {

    await pool.query(
        `
        INSERT IGNORE INTO adms (id)
        VALUES ($1)
        `,
        [userId]
    );
}

async function removerAdm(
    userId
) {

    await pool.query(
        `
        DELETE FROM adms
        WHERE id = $1
        `,
        [userId]
    );
}

async function isAdm(
    userId
) {

    const resultado =
        await pool.query(
            `
            SELECT
                id
            FROM adms
            WHERE id = $1
            `,
            [userId]
        );

    return (
        resultado.rows.length > 0
    );
}

// =====================================================
// 🎨 SISTEMA DE EMBEDS
// =====================================================

function normalizarConfigEmbed(
    config = {}
) {

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

// =====================================================
// 🎨 CRIAR EMBED
// =====================================================

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

        nome =
            segundoParametro ||
            "Embed";

        config =
            terceiroParametro ||
            {};

        criadorId =
            quartoParametro;

    } else {

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

    const criadoEm =
        agoraMs();

    const [resultado] =
        await mysqlPool.query(
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
                criado_por,
                criado_em,
                atualizado_em
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?
            )
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
                dados.timestamp ? 1 : 0,
                dados.canalId,
                dados.mensagemId,
                criadorId,
                criadoEm,
                criadoEm
            ]
        );

    return getEmbedPorId(
        resultado.insertId,
        guildId
    );
}

// =====================================================
// 🎨 ATUALIZAR EMBED
// =====================================================

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

    await mysqlPool.query(
        `
        UPDATE embeds_personalizados
        SET
            nome = ?,
            autor_nome = ?,
            autor_icone = ?,
            titulo = ?,
            descricao = ?,
            cor = ?,
            imagem = ?,
            thumbnail = ?,
            rodape = ?,
            rodape_icone = ?,
            timestamp = ?,
            canal_id = ?,
            mensagem_id = ?,
            atualizado_em = ?
        WHERE
            id = ?
            AND guild_id = ?
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
            normalizado.timestamp ? 1 : 0,
            canalId,
            mensagemId,
            agoraMs(),
            id,
            guildId
        ]
    );

    return getEmbedPorId(
        id,
        guildId
    );
}

// =====================================================
// 📋 EMBEDS DO SERVIDOR
// =====================================================

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

// =====================================================
// 🔎 EMBED POR ID
// =====================================================

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

// =====================================================
// 💾 SALVAR MENSAGEM DO EMBED
// =====================================================

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

    if (guildId) {

        await mysqlPool.query(
            `
            UPDATE embeds_personalizados
            SET
                canal_id = ?,
                mensagem_id = ?,
                atualizado_em = ?
            WHERE
                id = ?
                AND guild_id = ?
            `,
            [
                canalId,
                mensagemId,
                agoraMs(),
                id,
                guildId
            ]
        );

    } else {

        await mysqlPool.query(
            `
            UPDATE embeds_personalizados
            SET
                canal_id = ?,
                mensagem_id = ?,
                atualizado_em = ?
            WHERE id = ?
            `,
            [
                canalId,
                mensagemId,
                agoraMs(),
                id
            ]
        );
    }

    return getEmbedPorId(
        id,
        guildId
    );
}

// =====================================================
// 📺 ATUALIZAR CANAL DO EMBED
// =====================================================

async function atualizarCanalEmbed(
    id,
    guildId,
    canalId
) {

    await mysqlPool.query(
        `
        UPDATE embeds_personalizados
        SET
            canal_id = ?,
            atualizado_em = ?
        WHERE
            id = ?
            AND guild_id = ?
        `,
        [
            canalId,
            agoraMs(),
            id,
            guildId
        ]
    );

    return getEmbedPorId(
        id,
        guildId
    );
}

// =====================================================
// 🗑️ EXCLUIR EMBED
// =====================================================

async function excluirEmbedBanco(
    id,
    guildId
) {

    const embed =
        await getEmbedPorId(
            id,
            guildId
        );

    if (!embed) {
        return null;
    }

    await mysqlPool.query(
        `
        DELETE FROM embeds_personalizados
        WHERE
            id = ?
            AND guild_id = ?
        `,
        [
            id,
            guildId
        ]
    );

    return embed;
}

// =====================================================
// 📦 EXPORTAÇÕES
// =====================================================

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
    getSequenciaDaily,
    salvarSequenciaDaily,
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
