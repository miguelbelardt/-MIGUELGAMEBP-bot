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

function converterPlaceholders(
    sql,
    parametros = []
) {
    const novosParametros = [];

    const sqlMySQL = sql.replace(
        /\$(\d+)/g,
        (_, numero) => {
            const indice = Number(numero) - 1;

            if (
                indice < 0 ||
                indice >= parametros.length
            ) {
                throw new Error(
                    `❌ Parâmetro $${numero} não foi fornecido para a consulta SQL.`
                );
            }

            novosParametros.push(
                parametros[indice]
            );

            return "?";
        }
    );

    return {
        sqlMySQL,
        novosParametros
    };
}

const pool = {
    async query(
        sql,
        parametros = []
    ) {
        const convertido =
            converterPlaceholders(
                sql,
                parametros
            );

        const [resultado] =
            await mysqlPool.query(
                convertido.sqlMySQL,
                convertido.novosParametros
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

    // =================================================
    // 👋 SISTEMA DE BOAS-VINDAS / JOIN
    // =================================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS join_config (
            guild_id VARCHAR(30) PRIMARY KEY,

            habilitado BOOLEAN
                NOT NULL DEFAULT TRUE,

            canal_id VARCHAR(30),

            content TEXT,

            embed_habilitado BOOLEAN
                NOT NULL DEFAULT TRUE,

            embed_titulo VARCHAR(256),

            embed_descricao TEXT,

            embed_cor VARCHAR(20),

            autor_habilitado BOOLEAN
                NOT NULL DEFAULT TRUE,

            autor_nome VARCHAR(256),

            autor_icone TEXT,

            thumbnail TEXT,

            imagem TEXT,

            footer_habilitado BOOLEAN
                NOT NULL DEFAULT TRUE,

            footer_texto VARCHAR(2048),

            footer_icone TEXT,

            timestamp BOOLEAN
                NOT NULL DEFAULT TRUE,

            criado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            atualizado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            )
        )
    `);

    // =================================================
    // 🔧 MIGRAÇÕES DO JOIN
    // =================================================

    await adicionarColunaSeNaoExiste(
        "join_config",
        "habilitado",
        "BOOLEAN NOT NULL DEFAULT TRUE"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "canal_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "content",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "embed_habilitado",
        "BOOLEAN NOT NULL DEFAULT TRUE"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "embed_titulo",
        "VARCHAR(256)"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "embed_descricao",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "embed_cor",
        "VARCHAR(20)"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "autor_habilitado",
        "BOOLEAN NOT NULL DEFAULT TRUE"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "autor_nome",
        "VARCHAR(256)"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "autor_icone",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "thumbnail",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "imagem",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "footer_habilitado",
        "BOOLEAN NOT NULL DEFAULT TRUE"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "footer_texto",
        "VARCHAR(2048)"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "footer_icone",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "timestamp",
        "BOOLEAN NOT NULL DEFAULT TRUE"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "criado_em",
        "BIGINT NOT NULL DEFAULT 0"
    );

    await adicionarColunaSeNaoExiste(
        "join_config",
        "atualizado_em",
        "BIGINT NOT NULL DEFAULT 0"
    );

    // =================================================
    // 🔧 VALORES PADRÃO DO JOIN
    // =================================================

    await mysqlPool.query(`
        UPDATE join_config
        SET habilitado = TRUE
        WHERE habilitado IS NULL
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET embed_habilitado = TRUE
        WHERE embed_habilitado IS NULL
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET autor_habilitado = TRUE
        WHERE autor_habilitado IS NULL
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET footer_habilitado = TRUE
        WHERE footer_habilitado IS NULL
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET timestamp = TRUE
        WHERE timestamp IS NULL
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            content =
                '👋 Seja muito bem-vindo(a), {user}! Aproveite o servidor! 🎉'
        WHERE content IS NULL
        OR content = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            embed_titulo =
                '🎉 Bem-vindo ao {server}!'
        WHERE embed_titulo IS NULL
        OR embed_titulo = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            embed_descricao =
                'Olá, {user}!\\n\\n' ||
                'Esperamos que você se divirta por aqui! 💙\\n\\n' ||
                '👤 Você é o membro **#{members}** do servidor.'
        WHERE embed_descricao IS NULL
        OR embed_descricao = ''
    `);

    /*
     * MySQL não utiliza || como concatenação de texto
     * quando PIPES_AS_CONCAT não está habilitado.
     *
     * Esta atualização garante a descrição padrão.
     */
    await mysqlPool.query(`
        UPDATE join_config
        SET
            embed_descricao =
                'Olá, {user}!\\n\\nEsperamos que você se divirta por aqui! 💙\\n\\n👤 Você é o membro **#{members}** do servidor.'
        WHERE embed_descricao IS NULL
        OR embed_descricao = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            embed_cor = '0x5865F2'
        WHERE embed_cor IS NULL
        OR embed_cor = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            autor_nome = '{username}'
        WHERE autor_nome IS NULL
        OR autor_nome = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            autor_icone = '{avatar}'
        WHERE autor_icone IS NULL
        OR autor_icone = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            thumbnail = '{avatar}'
        WHERE thumbnail IS NULL
        OR thumbnail = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            imagem = '{banner}'
        WHERE imagem IS NULL
        OR imagem = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            footer_texto =
                'Massa Com Chika • Bem-vindo!'
        WHERE footer_texto IS NULL
        OR footer_texto = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET
            footer_icone = '{avatar}'
        WHERE footer_icone IS NULL
        OR footer_icone = ''
    `);

    await mysqlPool.query(`
        UPDATE join_config
        SET criado_em = ?
        WHERE criado_em = 0
    `, [agoraMs()]);

    await mysqlPool.query(`
        UPDATE join_config
        SET atualizado_em = ?
        WHERE atualizado_em = 0
    `, [agoraMs()]);

    // =================================================
    // 📝 SISTEMA DE REGISTRO
    // =================================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS registro_config (
            guild_id VARCHAR(30) PRIMARY KEY,

            canal_id VARCHAR(30),

            mensagem_id VARCHAR(30),

            paginas INT NOT NULL DEFAULT 1,

            configurado BOOLEAN
                NOT NULL DEFAULT FALSE,

            painel_titulo VARCHAR(256)
                DEFAULT '📝 Registro',

            painel_descricao TEXT,

            painel_imagem TEXT,

            painel_thumbnail TEXT,

            painel_rodape VARCHAR(2048),

            painel_rodape_icone TEXT,

            painel_botao_texto VARCHAR(80)
                NOT NULL DEFAULT 'Registrar',

            criado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            atualizado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            )
        )
    `);

    // =================================================
    // 🔧 MIGRAÇÕES DO REGISTRO
    // =================================================

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "canal_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "mensagem_id",
        "VARCHAR(30)"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "paginas",
        "INT NOT NULL DEFAULT 1"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "configurado",
        "BOOLEAN NOT NULL DEFAULT FALSE"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "painel_titulo",
        "VARCHAR(256) DEFAULT '📝 Registro'"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "painel_descricao",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "painel_imagem",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "painel_thumbnail",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "painel_rodape",
        "VARCHAR(2048)"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "painel_rodape_icone",
        "TEXT"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "painel_botao_texto",
        "VARCHAR(80) NOT NULL DEFAULT 'Registrar'"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "criado_em",
        "BIGINT NOT NULL DEFAULT 0"
    );

    await adicionarColunaSeNaoExiste(
        "registro_config",
        "atualizado_em",
        "BIGINT NOT NULL DEFAULT 0"
    );

    await mysqlPool.query(`
        UPDATE registro_config
        SET painel_titulo = '📝 Registro'
        WHERE painel_titulo IS NULL
        OR painel_titulo = ''
    `);

    await mysqlPool.query(`
        UPDATE registro_config
        SET painel_descricao =
            'Clique no botão abaixo para começar seu registro.'
        WHERE painel_descricao IS NULL
        OR painel_descricao = ''
    `);

    await mysqlPool.query(`
        UPDATE registro_config
        SET painel_botao_texto = 'Registrar'
        WHERE painel_botao_texto IS NULL
        OR painel_botao_texto = ''
    `);

    await mysqlPool.query(`
        UPDATE registro_config
        SET paginas = 1
        WHERE paginas IS NULL
        OR paginas < 1
    `);

    await mysqlPool.query(`
        UPDATE registro_config
        SET criado_em = ?
        WHERE criado_em = 0
    `, [agoraMs()]);

    await mysqlPool.query(`
        UPDATE registro_config
        SET atualizado_em = ?
        WHERE atualizado_em = 0
    `, [agoraMs()]);

    // ================================
    // 📄 PÁGINAS DO REGISTRO
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS registro_paginas (
            id BIGINT NOT NULL AUTO_INCREMENT,

            guild_id VARCHAR(30) NOT NULL,

            pagina INT NOT NULL,

            titulo VARCHAR(256),

            descricao TEXT,

            rodape VARCHAR(2048),

            rodape_icone TEXT,

            criado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            atualizado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            PRIMARY KEY (id),

            UNIQUE KEY uq_registro_pagina (
                guild_id,
                pagina
            ),

            INDEX idx_registro_paginas_guild (
                guild_id
            )
        )
    `);

    // ================================
    // 🔘 BOTÕES DO REGISTRO
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS registro_botoes (
            id BIGINT NOT NULL AUTO_INCREMENT,

            pagina_id BIGINT NOT NULL,

            texto VARCHAR(80) NOT NULL,

            emoji VARCHAR(100),

            estilo VARCHAR(20)
                NOT NULL DEFAULT 'Primary',

            cargo_id VARCHAR(30),

            custom_id VARCHAR(100),

            ordem INT NOT NULL DEFAULT 1,

            criado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            atualizado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            PRIMARY KEY (id),

            INDEX idx_registro_botoes_pagina (
                pagina_id
            ),

            CONSTRAINT fk_registro_botoes_pagina
            FOREIGN KEY (
                pagina_id
            )
            REFERENCES registro_paginas(id)
            ON DELETE CASCADE
        )
    `);

    // ================================
    // 👤 USUÁRIOS REGISTRADOS
    // ================================

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS registro_usuarios (
            guild_id VARCHAR(30) NOT NULL,

            user_id VARCHAR(30) NOT NULL,

            pagina_id BIGINT,

            botao_id BIGINT,

            cargo_id VARCHAR(30),

            registrado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            atualizado_em BIGINT NOT NULL DEFAULT (
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
            ),

            PRIMARY KEY (
                guild_id,
                user_id
            ),

            INDEX idx_registro_usuarios_guild (
                guild_id
            ),

            INDEX idx_registro_usuarios_user (
                user_id
            ),

            CONSTRAINT fk_registro_usuario_pagina
            FOREIGN KEY (
                pagina_id
            )
            REFERENCES registro_paginas(id)
            ON DELETE SET NULL,

            CONSTRAINT fk_registro_usuario_botao
            FOREIGN KEY (
                botao_id
            )
            REFERENCES registro_botoes(id)
            ON DELETE SET NULL
        )
    `);

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
// 👋 SISTEMA DE BOAS-VINDAS / JOIN
// =====================================================

function normalizarConfigJoin(
    config = {}
) {

    const embed =
        config.embed ||
        {};

    const autor =
        embed.autor ||
        config.autor ||
        {};

    const footer =
        embed.footer ||
        config.footer ||
        {};

    return {

        habilitado:
            config.habilitado ??
            true,

        canalId:
            config.canalId ??
            config.canal_id ??
            null,

        content:
            config.content ??
            "👋 Seja muito bem-vindo(a), {user}! Aproveite o servidor! 🎉",

        embedHabilitado:
            embed.habilitado ??
            config.embed_habilitado ??
            true,

        embedTitulo:
            embed.titulo ??
            config.embed_titulo ??
            "🎉 Bem-vindo ao {server}!",

        embedDescricao:
            embed.descricao ??
            config.embed_descricao ??
            "Olá, {user}!\n\n" +
            "Esperamos que você se divirta por aqui! 💙\n\n" +
            "👤 Você é o membro **#{members}** do servidor.",

        embedCor:
            embed.cor ??
            config.embed_cor ??
            "0x5865F2",

        autorHabilitado:
            autor.habilitado ??
            config.autor_habilitado ??
            true,

        autorNome:
            autor.nome ??
            config.autor_nome ??
            "{username}",

        autorIcone:
            autor.icone ??
            config.autor_icone ??
            "{avatar}",

        thumbnail:
            embed.thumbnail ??
            config.thumbnail ??
            "{avatar}",

        imagem:
            embed.imagem ??
            config.imagem ??
            "{banner}",

        footerHabilitado:
            footer.habilitado ??
            config.footer_habilitado ??
            true,

        footerTexto:
            footer.texto ??
            config.footer_texto ??
            "Massa Com Chika • Bem-vindo!",

        footerIcone:
            footer.icone ??
            config.footer_icone ??
            "{avatar}",

        timestamp:
            embed.timestamp ??
            config.timestamp ??
            true
    };
}

// =====================================================
// 👋 BUSCAR CONFIGURAÇÃO DO JOIN
// =====================================================

async function getJoinConfig(
    guildId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM join_config
            WHERE guild_id = $1
            `,
            [guildId]
        );

    return (
        resultado.rows[0] ||
        null
    );
}

// =====================================================
// 👋 SALVAR CONFIGURAÇÃO DO JOIN
// =====================================================

async function salvarJoinConfig(
    guildId,
    config = {}
) {

    const dados =
        normalizarConfigJoin(
            config
        );

    const agora =
        agoraMs();

    await pool.query(
        `
        INSERT INTO join_config (
            guild_id,
            habilitado,
            canal_id,
            content,

            embed_habilitado,
            embed_titulo,
            embed_descricao,
            embed_cor,

            autor_habilitado,
            autor_nome,
            autor_icone,

            thumbnail,
            imagem,

            footer_habilitado,
            footer_texto,
            footer_icone,

            timestamp,

            criado_em,
            atualizado_em
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,

            $5,
            $6,
            $7,
            $8,

            $9,
            $10,
            $11,

            $12,
            $13,

            $14,
            $15,
            $16,

            $17,

            $18,
            $18
        )
        ON DUPLICATE KEY UPDATE

            habilitado =
                VALUES(habilitado),

            canal_id =
                VALUES(canal_id),

            content =
                VALUES(content),

            embed_habilitado =
                VALUES(embed_habilitado),

            embed_titulo =
                VALUES(embed_titulo),

            embed_descricao =
                VALUES(embed_descricao),

            embed_cor =
                VALUES(embed_cor),

            autor_habilitado =
                VALUES(autor_habilitado),

            autor_nome =
                VALUES(autor_nome),

            autor_icone =
                VALUES(autor_icone),

            thumbnail =
                VALUES(thumbnail),

            imagem =
                VALUES(imagem),

            footer_habilitado =
                VALUES(footer_habilitado),

            footer_texto =
                VALUES(footer_texto),

            footer_icone =
                VALUES(footer_icone),

            timestamp =
                VALUES(timestamp),

            atualizado_em =
                VALUES(atualizado_em)
        `,
        [
            guildId,

            dados.habilitado
                ? 1
                : 0,

            dados.canalId,

            dados.content,

            dados.embedHabilitado
                ? 1
                : 0,

            dados.embedTitulo,

            dados.embedDescricao,

            dados.embedCor,

            dados.autorHabilitado
                ? 1
                : 0,

            dados.autorNome,

            dados.autorIcone,

            dados.thumbnail,

            dados.imagem,

            dados.footerHabilitado
                ? 1
                : 0,

            dados.footerTexto,

            dados.footerIcone,

            dados.timestamp
                ? 1
                : 0,

            agora
        ]
    );

    return getJoinConfig(
        guildId
    );
}

// =====================================================
// 👋 ATUALIZAR CANAL DO JOIN
// =====================================================

async function atualizarCanalJoin(
    guildId,
    canalId
) {

    const config =
        await getJoinConfig(
            guildId
        );

    if (!config) {

        return salvarJoinConfig(
            guildId,
            {
                canalId
            }
        );
    }

    await pool.query(
        `
        UPDATE join_config
        SET
            canal_id = $1,
            atualizado_em = $2
        WHERE guild_id = $3
        `,
        [
            canalId,
            agoraMs(),
            guildId
        ]
    );

    return getJoinConfig(
        guildId
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
// 📝 SISTEMA DE REGISTRO
// =====================================================

async function getRegistroConfig(
    guildId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_config
            WHERE guild_id = $1
            `,
            [guildId]
        );

    return (
        resultado.rows[0] ||
        null
    );
}

// =====================================================
// 💾 SALVAR CONFIGURAÇÃO DO REGISTRO
// =====================================================

async function salvarRegistroConfig(
    guildId,
    canalId = null,
    mensagemId = null,
    paginas = 1,
    configurado = true
) {

    paginas = Math.max(
        1,
        Math.min(
            6,
            Number(paginas) || 1
        )
    );

    const agora =
        agoraMs();

    await pool.query(
        `
        INSERT INTO registro_config (
            guild_id,
            canal_id,
            mensagem_id,
            paginas,
            configurado,
            criado_em,
            atualizado_em
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $6
        )
        ON DUPLICATE KEY UPDATE
            canal_id = VALUES(canal_id),
            mensagem_id = VALUES(mensagem_id),
            paginas = VALUES(paginas),
            configurado = VALUES(configurado),
            atualizado_em = VALUES(atualizado_em)
        `,
        [
            guildId,
            canalId,
            mensagemId,
            paginas,
            configurado ? 1 : 0,
            agora
        ]
    );

    return getRegistroConfig(
        guildId
    );
}

// =====================================================
// 📺 ATUALIZAR CANAL DO REGISTRO
// =====================================================

async function atualizarCanalRegistro(
    guildId,
    canalId
) {

    const config =
        await getRegistroConfig(
            guildId
        );

    if (!config) {

        return salvarRegistroConfig(
            guildId,
            canalId,
            null,
            1,
            false
        );
    }

    await pool.query(
        `
        UPDATE registro_config
        SET
            canal_id = $1,
            atualizado_em = $2
        WHERE guild_id = $3
        `,
        [
            canalId,
            agoraMs(),
            guildId
        ]
    );

    return getRegistroConfig(
        guildId
    );
}

// =====================================================
// 💬 SALVAR MENSAGEM DO REGISTRO
// =====================================================

async function salvarMensagemRegistro(
    guildId,
    mensagemId
) {

    const config =
        await getRegistroConfig(
            guildId
        );

    if (!config) {

        return salvarRegistroConfig(
            guildId,
            null,
            mensagemId,
            1,
            false
        );
    }

    await pool.query(
        `
        UPDATE registro_config
        SET
            mensagem_id = $1,
            atualizado_em = $2
        WHERE guild_id = $3
        `,
        [
            mensagemId,
            agoraMs(),
            guildId
        ]
    );

    return getRegistroConfig(
        guildId
    );
}

// =====================================================
// 🎨 SALVAR PAINEL INICIAL
// =====================================================

async function salvarPainelInicial(
    guildId,
    dados = {}
) {

    const config =
        await getRegistroConfig(
            guildId
        );

    if (!config) {

        await salvarRegistroConfig(
            guildId,
            null,
            null,
            1,
            false
        );
    }

    await pool.query(
        `
        UPDATE registro_config
        SET
            painel_titulo = $1,
            painel_descricao = $2,
            painel_imagem = $3,
            painel_thumbnail = $4,
            painel_rodape = $5,
            painel_rodape_icone = $6,
            atualizado_em = $7
        WHERE guild_id = $8
        `,
        [
            dados.painel_titulo ??
                dados.titulo ??
                "📝 Registro",

            dados.painel_descricao ??
                dados.descricao ??
                "Clique no botão abaixo para começar seu registro.",

            dados.painel_imagem ??
                dados.imagem ??
                null,

            dados.painel_thumbnail ??
                dados.thumbnail ??
                null,

            dados.painel_rodape ??
                dados.rodape ??
                null,

            dados.painel_rodape_icone ??
                dados.rodape_icone ??
                null,

            agoraMs(),

            guildId
        ]
    );

    return getRegistroConfig(
        guildId
    );
}

// =====================================================
// 🔘 SALVAR BOTÃO DO PAINEL INICIAL
// =====================================================

async function salvarBotaoPainelInicial(
    guildId,
    texto
) {

    const config =
        await getRegistroConfig(
            guildId
        );

    if (!config) {

        await salvarRegistroConfig(
            guildId,
            null,
            null,
            1,
            false
        );
    }

    texto =
        String(
            texto ||
            "Registrar"
        ).trim();

    if (!texto) {
        texto = "Registrar";
    }

    if (texto.length > 80) {
        texto =
            texto.substring(
                0,
                80
            );
    }

    await pool.query(
        `
        UPDATE registro_config
        SET
            painel_botao_texto = $1,
            atualizado_em = $2
        WHERE guild_id = $3
        `,
        [
            texto,
            agoraMs(),
            guildId
        ]
    );

    return getRegistroConfig(
        guildId
    );
}

// =====================================================
// 📄 PÁGINAS DO REGISTRO
// =====================================================

async function criarRegistroPagina(
    guildId,
    pagina,
    dados = {}
) {

    pagina = Number(
        pagina
    );

    if (
        !Number.isInteger(pagina) ||
        pagina < 1 ||
        pagina > 6
    ) {
        throw new Error(
            "A página do registro deve estar entre 1 e 6."
        );
    }

    const titulo =
        dados.titulo ??
        null;

    const descricao =
        dados.descricao ??
        null;

    const rodape =
        dados.rodape ??
        null;

    const rodapeIcone =
        dados.rodapeIcone ??
        dados.rodape_icone ??
        null;

    const agora =
        agoraMs();

    await pool.query(
        `
        INSERT INTO registro_paginas (
            guild_id,
            pagina,
            titulo,
            descricao,
            rodape,
            rodape_icone,
            criado_em,
            atualizado_em
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $7
        )
        ON DUPLICATE KEY UPDATE
            titulo = VALUES(titulo),
            descricao = VALUES(descricao),
            rodape = VALUES(rodape),
            rodape_icone = VALUES(rodape_icone),
            atualizado_em = VALUES(atualizado_em)
        `,
        [
            guildId,
            pagina,
            titulo,
            descricao,
            rodape,
            rodapeIcone,
            agora
        ]
    );

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_paginas
            WHERE
                guild_id = $1
                AND pagina = $2
            `,
            [
                guildId,
                pagina
            ]
        );

    return (
        resultado.rows[0] ||
        null
    );
}

async function getRegistroPagina(
    guildId,
    pagina
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_paginas
            WHERE
                guild_id = $1
                AND pagina = $2
            `,
            [
                guildId,
                pagina
            ]
        );

    return (
        resultado.rows[0] ||
        null
    );
}

async function getRegistroPaginaPorId(
    paginaId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_paginas
            WHERE id = $1
            `,
            [paginaId]
        );

    return (
        resultado.rows[0] ||
        null
    );
}

async function getRegistroPaginas(
    guildId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_paginas
            WHERE guild_id = $1
            ORDER BY pagina ASC
            `,
            [guildId]
        );

    return resultado.rows;
}

async function atualizarRegistroPagina(
    paginaId,
    guildId,
    dados = {}
) {

    await pool.query(
        `
        UPDATE registro_paginas
        SET
            titulo = $1,
            descricao = $2,
            rodape = $3,
            rodape_icone = $4,
            atualizado_em = $5
        WHERE
            id = $6
            AND guild_id = $7
        `,
        [
            dados.titulo ??
                null,

            dados.descricao ??
                null,

            dados.rodape ??
                null,

            dados.rodapeIcone ??
                dados.rodape_icone ??
                null,

            agoraMs(),

            paginaId,
            guildId
        ]
    );

    return getRegistroPaginaPorId(
        paginaId
    );
}

async function excluirRegistroPagina(
    paginaId,
    guildId
) {

    await pool.query(
        `
        DELETE FROM registro_paginas
        WHERE
            id = $1
            AND guild_id = $2
        `,
        [
            paginaId,
            guildId
        ]
    );
}

// =====================================================
// 🔘 BOTÕES DO REGISTRO
// =====================================================

async function criarRegistroBotao(
    paginaId,
    dados = {}
) {

    const texto =
        dados.texto ||
        "Registrar";

    const emoji =
        dados.emoji ??
        null;

    const estilo =
        dados.estilo ||
        "Primary";

    const cargoId =
        dados.cargoId ??
        dados.cargo_id ??
        null;

    const customId =
        dados.customId ??
        dados.custom_id ??
        `registrar_${paginaId}_${Date.now()}`;

    const ordem =
        Math.max(
            1,
            Number(
                dados.ordem
            ) || 1
        );

    const agora =
        agoraMs();

    const [resultado] =
        await mysqlPool.query(
            `
            INSERT INTO registro_botoes (
                pagina_id,
                texto,
                emoji,
                estilo,
                cargo_id,
                custom_id,
                ordem,
                criado_em,
                atualizado_em
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            `,
            [
                paginaId,
                texto,
                emoji,
                estilo,
                cargoId,
                customId,
                ordem,
                agora,
                agora
            ]
        );

    return getRegistroBotaoPorId(
        resultado.insertId
    );
}

async function getRegistroBotaoPorId(
    botaoId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_botoes
            WHERE id = $1
            `,
            [botaoId]
        );

    return (
        resultado.rows[0] ||
        null
    );
}

async function getRegistroBotoes(
    paginaId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_botoes
            WHERE pagina_id = $1
            ORDER BY ordem ASC, id ASC
            `,
            [paginaId]
        );

    return resultado.rows;
}

async function atualizarRegistroBotao(
    botaoId,
    dados = {}
) {

    await pool.query(
        `
        UPDATE registro_botoes
        SET
            texto = $1,
            emoji = $2,
            estilo = $3,
            cargo_id = $4,
            custom_id = $5,
            ordem = $6,
            atualizado_em = $7
        WHERE id = $8
        `,
        [
            dados.texto ??
                "Registrar",

            dados.emoji ??
                null,

            dados.estilo ??
                "Primary",

            dados.cargoId ??
                dados.cargo_id ??
                null,

            dados.customId ??
                dados.custom_id ??
                null,

            Math.max(
                1,
                Number(
                    dados.ordem
                ) || 1
            ),

            agoraMs(),

            botaoId
        ]
    );

    return getRegistroBotaoPorId(
        botaoId
    );
}

async function excluirRegistroBotao(
    botaoId
) {

    await pool.query(
        `
        DELETE FROM registro_botoes
        WHERE id = $1
        `,
        [botaoId]
    );
}

// =====================================================
// 📦 REGISTRO COMPLETO DO SERVIDOR
// =====================================================

async function getRegistroCompleto(
    guildId
) {

    const config =
        await getRegistroConfig(
            guildId
        );

    const paginas =
        await getRegistroPaginas(
            guildId
        );

    for (
        const pagina of paginas
    ) {

        pagina.botoes =
            await getRegistroBotoes(
                pagina.id
            );
    }

    return {
        config,
        paginas
    };
}

// =====================================================
// 👤 USUÁRIOS REGISTRADOS
// =====================================================

async function usuarioJaRegistrado(
    guildId,
    userId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_usuarios
            WHERE
                guild_id = $1
                AND user_id = $2
            `,
            [
                guildId,
                userId
            ]
        );

    return (
        resultado.rows.length > 0
    );
}

async function getRegistroUsuario(
    guildId,
    userId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_usuarios
            WHERE
                guild_id = $1
                AND user_id = $2
            `,
            [
                guildId,
                userId
            ]
        );

    return (
        resultado.rows[0] ||
        null
    );
}

async function registrarUsuario(
    guildId,
    userId,
    paginaId = null,
    botaoId = null,
    cargoId = null
) {

    const agora =
        agoraMs();

    await pool.query(
        `
        INSERT INTO registro_usuarios (
            guild_id,
            user_id,
            pagina_id,
            botao_id,
            cargo_id,
            registrado_em,
            atualizado_em
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $6
        )
        ON DUPLICATE KEY UPDATE
            pagina_id = VALUES(pagina_id),
            botao_id = VALUES(botao_id),
            cargo_id = VALUES(cargo_id),
            atualizado_em = VALUES(atualizado_em)
        `,
        [
            guildId,
            userId,
            paginaId,
            botaoId,
            cargoId,
            agora
        ]
    );

    return getRegistroUsuario(
        guildId,
        userId
    );
}

async function removerRegistroUsuario(
    guildId,
    userId
) {

    await pool.query(
        `
        DELETE FROM registro_usuarios
        WHERE
            guild_id = $1
            AND user_id = $2
        `,
        [
            guildId,
            userId
        ]
    );
}

async function getUsuariosRegistrados(
    guildId
) {

    const resultado =
        await pool.query(
            `
            SELECT *
            FROM registro_usuarios
            WHERE guild_id = $1
            ORDER BY registrado_em ASC
            `,
            [guildId]
        );

    return resultado.rows;
}

async function getTotalUsuariosRegistrados(
    guildId
) {

    const resultado =
        await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM registro_usuarios
            WHERE guild_id = $1
            `,
            [guildId]
        );

    return Number(
        resultado.rows[0]?.total || 0
    );
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

    // 👋 Boas-vindas / Join
    getJoinConfig,
    salvarJoinConfig,
    atualizarCanalJoin,

    // 🎨 Embeds
    criarEmbedBanco,
    atualizarEmbedBanco,
    getEmbedsDoServidor,
    getEmbedPorId,
    salvarMensagemEmbed,
    atualizarCanalEmbed,
    excluirEmbedBanco,

    // 📝 Registro
    getRegistroConfig,
    salvarRegistroConfig,
    atualizarCanalRegistro,
    salvarMensagemRegistro,
    salvarPainelInicial,
    salvarBotaoPainelInicial,

    // 📄 Páginas
    criarRegistroPagina,
    getRegistroPagina,
    getRegistroPaginaPorId,
    getRegistroPaginas,
    atualizarRegistroPagina,
    excluirRegistroPagina,

    // 🔘 Botões
    criarRegistroBotao,
    getRegistroBotaoPorId,
    getRegistroBotoes,
    atualizarRegistroBotao,
    excluirRegistroBotao,

    // 📦 Registro completo
    getRegistroCompleto,

    // 👤 Usuários registrados
    usuarioJaRegistrado,
    getRegistroUsuario,
    registrarUsuario,
    removerRegistroUsuario,
    getUsuariosRegistrados,
    getTotalUsuariosRegistrados
};
