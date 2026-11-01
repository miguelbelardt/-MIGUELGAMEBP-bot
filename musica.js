// =====================================================
// 🎵 MOTOR DE MÚSICA
// =====================================================
// Usado pelos comandos /play, /pause, /resume, /skip, /stop e
// /fila. Toca músicas do SoundCloud (busca por nome ou link) e
// links diretos de arquivos de áudio. YouTube e Spotify NÃO são
// suportados.
//
// Precisa do ffmpeg no servidor. O bot procura, nesta ordem:
//   1) a variável FFMPEG_PATH
//   2) o pacote ffmpeg-static (se estiver no package.json)
//   3) o comando "ffmpeg" do sistema

const { spawn, spawnSync } = require("child_process");
const dns = require("dns").promises;
const net = require("net");

const { EmbedBuilder, MessageFlags } = require("discord.js");

const {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    entersState,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    StreamType
} = require("@discordjs/voice");

const emojis = require("./emojis.js");

// =====================================================
// ⚙️ CONFIGURAÇÕES
// =====================================================

const COR = 0x5865F2;

const MAX_FILA = 50;
const MAX_TEXTO_BUSCA = 200;

// Tempo parado (sem música) antes do bot sair da call.
const TEMPO_PARA_SAIR = 2 * 60 * 1000;

const TEMPO_LIMITE_REDE = 15 * 1000;

const EMOJIS = {
    musica: "🎵",
    erro: emojis.erro,
    sucesso: emojis.sucesso,
    relogio: emojis.relogio
};

// Só para testes automáticos (permite 127.0.0.1).
const PERMITIR_REDE_LOCAL =
    process.env.MUSICA_TESTE_REDE_LOCAL === "1";

// guildId -> { ...estado da fila }
const filas = new Map();

// =====================================================
// 🎬 FFMPEG
// =====================================================

let ffmpegCache = null;

function localizarFFmpeg() {
    if (ffmpegCache) {
        return ffmpegCache;
    }

    const candidatos = [];

    if (process.env.FFMPEG_PATH) {
        candidatos.push(process.env.FFMPEG_PATH);
    }

    try {
        const estatico = require("ffmpeg-static");

        if (estatico) {
            candidatos.push(estatico);
        }
    } catch {
        // pacote não instalado: segue para o ffmpeg do sistema
    }

    candidatos.push("ffmpeg");

    for (const caminho of candidatos) {
        const versao =
            spawnSync(caminho, ["-version"], {
                encoding: "utf8"
            });

        if (versao.status !== 0) {
            continue;
        }

        const codificadores =
            spawnSync(
                caminho,
                ["-hide_banner", "-encoders"],
                { encoding: "utf8" }
            );

        if (!/libopus/.test(codificadores.stdout || "")) {
            ffmpegCache = {
                ok: false,
                motivo: "O ffmpeg do servidor não tem suporte a libopus."
            };

            continue;
        }

        ffmpegCache = {
            ok: true,
            caminho
        };

        return ffmpegCache;
    }

    return ffmpegCache || {
        ok: false,
        motivo:
            "O ffmpeg não foi encontrado no servidor. " +
            "Adicione `\"ffmpeg-static\": \"^5.2.0\"` nas dependências do package.json."
    };
}

// =====================================================
// 🔒 LINKS PERMITIDOS (links diretos)
// =====================================================

function ipPrivado(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split(".").map(Number);

        return (
            a === 10 ||
            a === 127 ||
            a === 0 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127)
        );
    }

    if (net.isIPv6(ip)) {
        const baixo = ip.toLowerCase();

        return (
            baixo === "::1" ||
            baixo === "::" ||
            baixo.startsWith("fc") ||
            baixo.startsWith("fd") ||
            baixo.startsWith("fe80") ||
            baixo.startsWith("::ffff:")
        );
    }

    return true;
}

// O bot não deve ser usado para "olhar" a rede interna do servidor.
async function linkSeguro(texto) {
    let endereco;

    try {
        endereco = new URL(texto);
    } catch {
        return false;
    }

    if (!/^https?:$/.test(endereco.protocol)) {
        return false;
    }

    const host =
        endereco.hostname
            .replace(/^\[|\]$/g, "")
            .toLowerCase();

    if (PERMITIR_REDE_LOCAL) {
        return true;
    }

    if (
        host === "localhost" ||
        host.endsWith(".local") ||
        host.endsWith(".internal")
    ) {
        return false;
    }

    if (net.isIP(host)) {
        return !ipPrivado(host);
    }

    try {
        const enderecos =
            await dns.lookup(host, { all: true });

        return (
            enderecos.length > 0 &&
            enderecos.every(item => !ipPrivado(item.address))
        );

    } catch {
        return false;
    }
}

// =====================================================
// ☁️ SOUNDCLOUD
// =====================================================
// Usa a API pública do site (a mesma do player do SoundCloud).
// O "client_id" é pego sozinho da página e guardado por 6 horas.

let clientId = null;
let clientIdAte = 0;

async function pedir(url, opcoes = {}) {
    const controle = new AbortController();

    const relogio =
        setTimeout(
            () => controle.abort(),
            TEMPO_LIMITE_REDE
        );

    try {
        return await fetch(url, {
            ...opcoes,
            signal: controle.signal,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; DiscordBot)",
                ...(opcoes.headers || {})
            }
        });

    } finally {
        clearTimeout(relogio);
    }
}

async function pegarClientId(forcar = false) {
    if (
        !forcar &&
        clientId &&
        Date.now() < clientIdAte
    ) {
        return clientId;
    }

    const pagina =
        await (await pedir("https://soundcloud.com")).text();

    const scripts =
        [
            ...pagina.matchAll(
                /<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g
            )
        ].map(achado => achado[1]);

    // O client_id costuma estar nos últimos scripts.
    for (const script of scripts.reverse()) {
        const codigo =
            await (await pedir(script)).text();

        const achado =
            codigo.match(
                /client_id\s*[:=]\s*"([a-zA-Z0-9]{32})"/
            );

        if (achado) {
            clientId = achado[1];
            clientIdAte = Date.now() + 6 * 60 * 60 * 1000;

            return clientId;
        }
    }

    throw new Error(
        "Não consegui obter o client_id do SoundCloud."
    );
}

// Faz o pedido na API; se o client_id expirou (401/403), renova.
async function apiSoundCloud(caminho, parametros = {}) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
        const id =
            await pegarClientId(tentativa > 0);

        const url = new URL(
            `https://api-v2.soundcloud.com${caminho}`
        );

        for (const [chave, valor] of Object.entries(parametros)) {
            url.searchParams.set(chave, valor);
        }

        url.searchParams.set("client_id", id);

        const resposta = await pedir(url.toString());

        if (resposta.status === 401 || resposta.status === 403) {
            continue;
        }

        if (!resposta.ok) {
            throw new Error(
                `SoundCloud respondeu ${resposta.status}.`
            );
        }

        return resposta.json();
    }

    throw new Error("O SoundCloud recusou o acesso.");
}

function faixaDoSoundCloud(dados) {
    return {
        origem: "soundcloud",
        titulo: dados.title || "Sem título",
        autor: dados.user?.username || "Desconhecido",
        duracaoMs: Number(dados.duration) || 0,
        pagina: dados.permalink_url || null,
        imagem:
            (dados.artwork_url || dados.user?.avatar_url || null),
        transcodings: dados.media?.transcodings || [],
        autorizacao: dados.track_authorization || ""
    };
}

async function buscarNoSoundCloud(texto) {
    const resultado =
        await apiSoundCloud(
            "/search/tracks",
            { q: texto, limit: "5" }
        );

    const achado =
        (resultado.collection || []).find(
            item =>
                item.kind === "track" &&
                item.media?.transcodings?.length > 0
        );

    return achado ? faixaDoSoundCloud(achado) : null;
}

async function resolverLinkSoundCloud(link) {
    let final = link;

    // Links curtos (on.soundcloud.com) redirecionam.
    if (/^https?:\/\/on\.soundcloud\.com\//i.test(link)) {
        const resposta =
            await pedir(link, { redirect: "follow" });

        final = resposta.url || link;
    }

    const dados =
        await apiSoundCloud("/resolve", { url: final });

    if (dados.kind === "track") {
        return faixaDoSoundCloud(dados);
    }

    return { erro: "Por enquanto só toco músicas (não playlists ou perfis) do SoundCloud." };
}

// Pega o endereço de áudio na hora de tocar (ele expira).
async function enderecoDeAudio(faixa) {
    if (faixa.origem !== "soundcloud") {
        return faixa.urlAudio;
    }

    // Prefere o formato "progressive" (arquivo mp3 inteiro).
    const ordenadas =
        [...faixa.transcodings].sort(
            (a, b) =>
                Number(b.format?.protocol === "progressive") -
                Number(a.format?.protocol === "progressive")
        );

    for (const transcoding of ordenadas) {
        if (transcoding.snipped) {
            continue;
        }

        try {
            const resposta =
                await apiSoundCloud(
                    new URL(transcoding.url).pathname,
                    faixa.autorizacao
                        ? { track_authorization: faixa.autorizacao }
                        : {}
                );

            if (resposta.url) {
                return resposta.url;
            }

        } catch {
            // tenta o próximo formato
        }
    }

    throw new Error(
        "Não consegui o áudio dessa música (pode ser só prévia ou ter bloqueio)."
    );
}

// =====================================================
// 🔎 DESCOBRIR A FAIXA PELO TEXTO DIGITADO
// =====================================================

async function descobrirFaixa(consulta) {
    const texto =
        String(consulta || "").trim().slice(0, MAX_TEXTO_BUSCA);

    if (!texto) {
        return { erro: "Diga o nome da música ou cole um link." };
    }

    if (/^https?:\/\//i.test(texto)) {
        let endereco;

        try {
            endereco = new URL(texto);
        } catch {
            return { erro: "Esse link não é válido." };
        }

        const host = endereco.hostname.toLowerCase();

        if (
            /(^|\.)(youtube\.com|youtu\.be|spotify\.com)$/.test(host)
        ) {
            return {
                erro:
                    "Links do YouTube e do Spotify não são suportados. " +
                    "Escreva o nome da música (eu busco no SoundCloud) ou use um link do SoundCloud."
            };
        }

        if (/(^|\.)(soundcloud\.com|snd\.sc)$/.test(host)) {
            const faixa =
                await resolverLinkSoundCloud(texto);

            return faixa.erro ? faixa : { faixa };
        }

        if (!(await linkSeguro(texto))) {
            return { erro: "Não posso abrir esse link." };
        }

        const nome =
            decodeURIComponent(
                endereco.pathname.split("/").pop() || ""
            ) || endereco.hostname;

        return {
            faixa: {
                origem: "direto",
                titulo: nome.slice(0, 200),
                autor: endereco.hostname,
                duracaoMs: 0,
                pagina: texto,
                imagem: null,
                urlAudio: texto
            }
        };
    }

    const faixa = await buscarNoSoundCloud(texto);

    if (!faixa) {
        return {
            erro: `Não achei nada no SoundCloud para **${texto.slice(0, 80)}**.`
        };
    }

    return { faixa };
}

// =====================================================
// 🧰 FORMATAR
// =====================================================

function duracao(ms) {
    if (!ms) {
        return "ao vivo / desconhecida";
    }

    const total = Math.round(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    const dois = n => String(n).padStart(2, "0");

    return h > 0
        ? `${h}:${dois(m)}:${dois(s)}`
        : `${m}:${dois(s)}`;
}

function limpar(texto) {
    // Títulos vêm de fora: nunca podem marcar ninguém.
    return String(texto).replace(/@/g, "@​");
}

function embedFaixa(titulo, faixa, extra = "") {
    const embed =
        new EmbedBuilder()
            .setColor(COR)
            .setTitle(titulo)
            .setDescription(
                `${faixa.pagina
                    ? `[${limpar(faixa.titulo)}](${faixa.pagina})`
                    : `**${limpar(faixa.titulo)}**`}\n` +
                `por ${limpar(faixa.autor)}\n\n` +
                `${EMOJIS.relogio} Duração: **${duracao(faixa.duracaoMs)}**` +
                (extra ? `\n${extra}` : "")
            );

    if (faixa.imagem) {
        embed.setThumbnail(faixa.imagem);
    }

    return embed;
}

// =====================================================
// 🔊 FILA E REPRODUÇÃO
// =====================================================

function encerrar(guildId, motivo = "") {
    const fila = filas.get(guildId);

    if (!fila) {
        return;
    }

    clearTimeout(fila.relogioInativo);

    fila.faixas = [];
    fila.atual = null;

    matarProcesso(fila);

    try {
        fila.player.stop(true);
    } catch { }

    try {
        if (
            fila.connection.state.status !==
            VoiceConnectionStatus.Destroyed
        ) {
            fila.connection.destroy();
        }
    } catch { }

    filas.delete(guildId);

    if (motivo) {
        console.log(
            `🎵 Música encerrada (${guildId}): ${motivo}`
        );
    }
}

function matarProcesso(fila) {
    if (fila.processo) {
        // Encerrado por nós (kill): o "close" vem com código nulo
        // e por isso não é tratado como erro.
        try {
            fila.processo.kill("SIGKILL");
        } catch { }

        fila.processo = null;
    }
}

function avisar(fila, conteudo) {
    if (!fila.canalTexto) {
        return;
    }

    Promise.resolve(
        fila.canalTexto.send(conteudo)
    ).catch(() => { });
}

function agendarSaida(fila) {
    clearTimeout(fila.relogioInativo);

    fila.relogioInativo =
        setTimeout(
            () => encerrar(fila.guildId, "inatividade"),
            TEMPO_PARA_SAIR
        );
}

async function tocarProxima(fila, anunciar = true) {
    matarProcesso(fila);

    const proxima = fila.faixas.shift();

    if (!proxima) {
        fila.atual = null;
        agendarSaida(fila);
        return;
    }

    clearTimeout(fila.relogioInativo);

    fila.atual = proxima;

    try {
        const ffmpeg = localizarFFmpeg();

        if (!ffmpeg.ok) {
            throw new Error(ffmpeg.motivo);
        }

        const endereco =
            await enderecoDeAudio(proxima);

        // Os links diretos são conferidos de novo na hora de tocar.
        if (
            proxima.origem === "direto" &&
            !(await linkSeguro(endereco))
        ) {
            throw new Error("Não posso abrir esse link.");
        }

        const processo =
            spawn(
                ffmpeg.caminho,
                [
                    "-hide_banner",
                    "-loglevel", "error",
                    "-protocol_whitelist",
                    "http,https,tcp,tls,crypto,hls,applehttp",
                    "-reconnect", "1",
                    "-reconnect_streamed", "1",
                    "-reconnect_delay_max", "5",
                    "-i", endereco,
                    "-vn",
                    "-c:a", "libopus",
                    "-b:a", "96k",
                    "-ar", "48000",
                    "-ac", "2",
                    "-f", "ogg",
                    "pipe:1"
                ],
                { stdio: ["ignore", "pipe", "pipe"] }
            );

        let erroFFmpeg = "";

        processo.stderr.on("data", dados => {
            erroFFmpeg =
                (erroFFmpeg + dados.toString()).slice(-400);
        });

        processo.on("error", erro => {
            erroFFmpeg = erro.message;
        });

        // Se o ffmpeg morrer com erro, só avisa. Quem passa para a
        // próxima música é o evento "Idle" do player (quando o áudio
        // acaba), assim a fila nunca avança duas vezes.
        processo.on("close", codigo => {
            if (
                codigo !== 0 &&
                codigo !== null
            ) {
                console.warn(
                    `⚠️ Música: ffmpeg terminou com erro (${codigo}): ${erroFFmpeg.trim()}`
                );

                avisar(
                    fila,
                    `${EMOJIS.erro} Não consegui tocar **${limpar(proxima.titulo)}**. Pulando...`
                );
            }
        });

        fila.processo = processo;

        const recurso =
            createAudioResource(
                processo.stdout,
                { inputType: StreamType.OggOpus }
            );

        fila.recurso = recurso;

        fila.player.play(recurso);

        if (anunciar) {
            avisar(
                fila,
                {
                    embeds: [
                        embedFaixa(
                            `${EMOJIS.musica} Tocando agora`,
                            proxima
                        )
                    ]
                }
            );
        }

    } catch (erro) {
        console.error(
            "❌ Música: erro ao iniciar a faixa:",
            erro?.message || erro
        );

        avisar(
            fila,
            `${EMOJIS.erro} Não consegui tocar **${limpar(proxima.titulo)}**: ${erro?.message || "erro desconhecido"}`
        );

        return tocarProxima(fila);
    }
}

function criarFila(guild, membro, canalTexto) {
    const canalDeVoz = membro.voice.channel;

    const conexaoAtual =
        getVoiceConnection(guild.id);

    const connection =
        conexaoAtual &&
        conexaoAtual.joinConfig?.channelId === canalDeVoz.id
            ? conexaoAtual
            : joinVoiceChannel({
                channelId: canalDeVoz.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: true
            });

    const player = createAudioPlayer();

    connection.subscribe(player);

    const fila = {
        guildId: guild.id,
        canalVozId: canalDeVoz.id,
        canalTexto,
        connection,
        player,
        faixas: [],
        atual: null,
        processo: null,
        recurso: null,
        relogioInativo: null
    };

    // Terminou uma faixa: toca a próxima.
    player.on(AudioPlayerStatus.Idle, antigo => {
        // Ignora o fim de um áudio que já foi trocado por outro.
        if (
            antigo?.resource &&
            antigo.resource !== fila.recurso
        ) {
            return;
        }

        if (filas.get(guild.id) === fila && fila.atual) {
            tocarProxima(fila);
        }
    });

    player.on("error", erro => {
        console.error(
            "❌ Música: erro no player:",
            erro?.message || erro
        );
    });

    // Foi desconectado (ex.: /sair-call ou alguém tirou o bot).
    connection.on(
        VoiceConnectionStatus.Disconnected,
        async () => {
            try {
                await Promise.race([
                    entersState(
                        connection,
                        VoiceConnectionStatus.Signalling,
                        5000
                    ),
                    entersState(
                        connection,
                        VoiceConnectionStatus.Connecting,
                        5000
                    )
                ]);
                // está se reconectando sozinho
            } catch {
                encerrar(guild.id, "desconectado");
            }
        }
    );

    connection.on(
        VoiceConnectionStatus.Destroyed,
        () => {
            if (filas.get(guild.id) === fila) {
                encerrar(guild.id, "conexão destruída");
            }
        }
    );

    filas.set(guild.id, fila);

    return fila;
}

// =====================================================
// ✅ VERIFICAÇÕES
// =====================================================

function exigirMesmaCall(membro, fila) {
    const canalDele = membro?.voice?.channelId;

    if (!canalDele) {
        return `${EMOJIS.erro} Entre na call do bot para usar este comando.`;
    }

    if (canalDele !== fila.canalVozId) {
        return `${EMOJIS.erro} Você precisa estar na mesma call que eu: <#${fila.canalVozId}>.`;
    }

    return null;
}

// =====================================================
// 🎮 AÇÕES (usadas pelos comandos)
// =====================================================
// Todas devolvem { erro } (texto) ou { resposta } (payload).

async function tocar({ guild, membro, canalTexto, consulta }) {
    const canalDeVoz = membro?.voice?.channel;

    if (!canalDeVoz) {
        return {
            erro: `${EMOJIS.erro} Entre em uma call antes de pedir música.`
        };
    }

    let existente = filas.get(guild.id);

    // Parado (sem música) em outra call: vai para a call de quem pediu.
    if (
        existente &&
        !existente.atual &&
        existente.canalVozId !== canalDeVoz.id
    ) {
        encerrar(guild.id, "mudou de call");
        existente = null;
    }

    if (existente) {
        const problema =
            exigirMesmaCall(membro, existente);

        if (problema) {
            return { erro: problema };
        }

        if (existente.faixas.length >= MAX_FILA) {
            return {
                erro: `${EMOJIS.erro} A fila está cheia (${MAX_FILA} músicas).`
            };
        }
    } else {
        const permissoes =
            canalDeVoz.permissionsFor(guild.members.me);

        if (
            !permissoes ||
            !permissoes.has("Connect") ||
            !permissoes.has("Speak")
        ) {
            return {
                erro: `${EMOJIS.erro} Eu preciso das permissões **Conectar** e **Falar** em ${canalDeVoz}.`
            };
        }
    }

    const ffmpeg = localizarFFmpeg();

    if (!ffmpeg.ok) {
        return {
            erro: `${EMOJIS.erro} ${ffmpeg.motivo}`
        };
    }

    let descoberta;

    try {
        descoberta = await descobrirFaixa(consulta);

    } catch (erro) {
        console.error(
            "❌ Música: erro ao buscar a faixa:",
            erro?.message || erro
        );

        return {
            erro: `${EMOJIS.erro} Não consegui buscar essa música agora. Tente de novo em instantes.`
        };
    }

    if (descoberta.erro) {
        return {
            erro: `${EMOJIS.erro} ${descoberta.erro}`
        };
    }

    // Outra pessoa pode ter criado a fila enquanto buscávamos.
    let fila = filas.get(guild.id);

    if (!fila) {
        try {
            fila = criarFila(guild, membro, canalTexto);

        } catch (erro) {
            console.error(
                "❌ Música: não consegui entrar na call:",
                erro
            );

            return {
                erro: `${EMOJIS.erro} Não consegui entrar na call.`
            };
        }
    }

    fila.canalTexto = canalTexto;

    const tocandoAgora = !fila.atual;

    fila.faixas.push(descoberta.faixa);

    if (tocandoAgora) {
        // A mensagem "Tocando agora" é a própria resposta do comando.
        await tocarProxima(fila, false);

        return {
            resposta: {
                embeds: [
                    embedFaixa(
                        `${EMOJIS.musica} Tocando agora`,
                        descoberta.faixa
                    )
                ]
            }
        };
    }

    return {
        resposta: {
            embeds: [
                embedFaixa(
                    `${EMOJIS.sucesso} Adicionada à fila`,
                    descoberta.faixa,
                    `Posição: **${fila.faixas.length}**`
                )
            ]
        }
    };
}

function pausar({ guild, membro }) {
    const fila = filas.get(guild.id);

    if (!fila || !fila.atual) {
        return { erro: `${EMOJIS.erro} Não tem nada tocando agora.` };
    }

    const problema = exigirMesmaCall(membro, fila);

    if (problema) {
        return { erro: problema };
    }

    if (!fila.player.pause()) {
        return { erro: `${EMOJIS.erro} A música já está pausada.` };
    }

    return { resposta: `⏸️ Pausado. Use \`/resume\` para continuar.` };
}

function retomar({ guild, membro }) {
    const fila = filas.get(guild.id);

    if (!fila || !fila.atual) {
        return { erro: `${EMOJIS.erro} Não tem nada tocando agora.` };
    }

    const problema = exigirMesmaCall(membro, fila);

    if (problema) {
        return { erro: problema };
    }

    if (!fila.player.unpause()) {
        return { erro: `${EMOJIS.erro} A música não está pausada.` };
    }

    return { resposta: `▶️ Continuando a música.` };
}

function pular({ guild, membro }) {
    const fila = filas.get(guild.id);

    if (!fila || !fila.atual) {
        return { erro: `${EMOJIS.erro} Não tem nada tocando agora.` };
    }

    const problema = exigirMesmaCall(membro, fila);

    if (problema) {
        return { erro: problema };
    }

    const pulada = fila.atual;

    // Para o áudio atual; o evento "Idle" toca a próxima.
    matarProcesso(fila);
    fila.player.stop(true);

    return {
        resposta:
            `⏭️ Pulei **${limpar(pulada.titulo)}**.`
    };
}

function parar({ guild, membro }) {
    const fila = filas.get(guild.id);

    if (!fila) {
        return { erro: `${EMOJIS.erro} Não estou tocando nada.` };
    }

    const problema = exigirMesmaCall(membro, fila);

    if (problema) {
        return { erro: problema };
    }

    encerrar(guild.id, "comando /stop");

    return {
        resposta: `⏹️ Parei a música, limpei a fila e saí da call.`
    };
}

function verFila({ guild }) {
    const fila = filas.get(guild.id);

    if (!fila || (!fila.atual && fila.faixas.length === 0)) {
        return {
            erro: `${EMOJIS.musica} A fila está vazia. Use \`/play\` para tocar algo.`
        };
    }

    const linhas = [];

    if (fila.atual) {
        linhas.push(
            `${EMOJIS.musica} **Tocando agora:** ${limpar(fila.atual.titulo)} (${duracao(fila.atual.duracaoMs)})`
        );
    }

    fila.faixas.slice(0, 15).forEach((faixa, i) => {
        linhas.push(
            `**${i + 1}.** ${limpar(faixa.titulo)} (${duracao(faixa.duracaoMs)})`
        );
    });

    if (fila.faixas.length > 15) {
        linhas.push(
            `… e mais ${fila.faixas.length - 15} música(s).`
        );
    }

    return {
        resposta: {
            embeds: [
                new EmbedBuilder()
                    .setColor(COR)
                    .setTitle(`${EMOJIS.musica} Fila de músicas`)
                    .setDescription(linhas.join("\n").slice(0, 4000))
                    .setFooter({
                        text: `${fila.faixas.length} na fila`
                    })
            ]
        }
    };
}

// =====================================================
// 💬 RESPONDER (slash e prefixo usam o mesmo caminho)
// =====================================================

function contextoDe(origem) {
    return {
        guild: origem.guild,
        membro: origem.member,
        canalTexto: origem.channel
    };
}

async function rodarSlash(interaction, acao, extra = {}, demorado = false) {
    try {
        if (!interaction.guild) {
            return interaction.reply({
                content: `${EMOJIS.erro} Este comando só funciona dentro de um servidor.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Buscar a música pode levar mais de 3 segundos.
        if (demorado) {
            await interaction.deferReply();
        }

        const resultado =
            await acao({
                ...contextoDe(interaction),
                ...extra
            });

        if (resultado.erro) {
            if (demorado) {
                await interaction.deleteReply().catch(() => { });

                return interaction.followUp({
                    content: resultado.erro,
                    flags: MessageFlags.Ephemeral
                });
            }

            return interaction.reply({
                content: resultado.erro,
                flags: MessageFlags.Ephemeral
            });
        }

        const payload =
            typeof resultado.resposta === "string"
                ? { content: resultado.resposta }
                : resultado.resposta;

        return demorado
            ? interaction.editReply(payload)
            : interaction.reply(payload);

    } catch (erro) {
        console.error(
            "❌ Erro em um comando de música:",
            erro
        );

        const aviso =
            `${EMOJIS.erro} Não foi possível concluir o comando de música.`;

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({
                content: aviso,
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
        } else {
            await interaction.reply({
                content: aviso,
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
        }
    }
}

async function rodarPrefixo(message, acao, extra = {}) {
    try {
        if (!message.guild) {
            return;
        }

        const resultado =
            await acao({
                ...contextoDe(message),
                ...extra
            });

        if (resultado.erro) {
            return message.reply(resultado.erro);
        }

        return message.reply(
            typeof resultado.resposta === "string"
                ? { content: resultado.resposta }
                : resultado.resposta
        );

    } catch (erro) {
        console.error(
            "❌ Erro em um comando de música (prefixo):",
            erro
        );

        await message.reply(
            `${EMOJIS.erro} Não foi possível concluir o comando de música.`
        ).catch(() => { });
    }
}

module.exports = {
    rodarSlash,
    rodarPrefixo,

    tocar,
    pausar,
    retomar,
    pular,
    parar,
    verFila,

    // para testes
    _teste: {
        filas,
        descobrirFaixa,
        linkSeguro,
        localizarFFmpeg,
        duracao
    }
};
