// Lista de comandos do site. Para mudar algo, edite aqui.
// [nome, descrição, precisa de permissão (1 = ADM)]
window.CATEGORIAS = [
 {
  "icone": "💰",
  "nome": "Economia",
  "comandos": [
   [
    "atm",
    "Veja seu saldo de moedas.",
    0
   ],
   [
    "trabalhar",
    "Trabalhe para ganhar moedas (1 vez por hora).",
    0
   ],
   [
    "pay",
    "Envie moedas para outro usuário.",
    0
   ],
   [
    "loja",
    "Veja a loja de itens.",
    0
   ],
   [
    "comprar",
    "Compra um item da loja.",
    0
   ],
   [
    "inventario",
    "Veja os itens de um inventário.",
    0
   ],
   [
    "usar",
    "Usa um item do seu inventário.",
    0
   ],
   [
    "premium",
    "Compre dias de premium com moedas.",
    0
   ],
   [
    "moedas-ranking",
    "Ranking de quem tem mais moedas.",
    0
   ],
   [
    "dar-premium",
    "Dá dias de premium a um usuário.",
    1
   ]
  ]
 },
 {
  "icone": "📈",
  "nome": "XP e níveis",
  "comandos": [
   [
    "rank",
    "Veja seu nível, XP e posição no ranking.",
    0
   ],
   [
    "xp",
    "Veja a quantidade de XP de um usuário.",
    0
   ],
   [
    "ver-xp",
    "Veja a quantidade de XP de um usuário.",
    0
   ],
   [
    "xp-ranking",
    "Mostra o ranking de XP.",
    0
   ],
   [
    "add-xp",
    "Adiciona XP a um usuário.",
    1
   ],
   [
    "adicionar-xp",
    "Adiciona XP a um usuário.",
    1
   ],
   [
    "remove-xp",
    "Remove XP de um usuário.",
    1
   ],
   [
    "set-xp",
    "Define o XP de um usuário.",
    1
   ]
  ]
 },
 {
  "icone": "🎵",
  "nome": "Música",
  "comandos": [
   [
    "play",
    "Toca uma música do SoundCloud (nome ou link) ou um link de áudio.",
    0
   ],
   [
    "pause",
    "Pausa a música que está tocando.",
    0
   ],
   [
    "resume",
    "Continua a música pausada.",
    0
   ],
   [
    "skip",
    "Pula para a próxima música da fila.",
    0
   ],
   [
    "stop",
    "Para a música, limpa a fila e sai da call.",
    0
   ],
   [
    "fila",
    "Mostra a fila de músicas.",
    0
   ],
   [
    "tocando",
    "Mostra a música que está tocando agora.",
    0
   ],
   [
    "loop",
    "Repete a música atual ou a fila toda.",
    0
   ],
   [
    "shuffle",
    "Embaralha a ordem das músicas da fila.",
    0
   ],
   [
    "volume",
    "Muda o volume da música (1 a 200).",
    0
   ],
   [
    "entrar-call",
    "Faz o bot entrar em um canal de voz.",
    0
   ],
   [
    "sair-call",
    "Faz o bot sair do canal de voz.",
    0
   ]
  ]
 },
 {
  "icone": "🎲",
  "nome": "Diversão",
  "comandos": [
   [
    "8ball",
    "Faça uma pergunta para a bola 8 mágica.",
    0
   ],
   [
    "dado",
    "Rola um ou mais dados.",
    0
   ],
   [
    "ppt",
    "Jogue Pedra, Papel e Tesoura contra o bot.",
    0
   ],
   [
    "pptduo",
    "Desafie outro jogador no Pedra, Papel e Tesoura.",
    0
   ],
   [
    "ship",
    "Veja a chance de duas pessoas darem match.",
    0
   ],
   [
    "casar",
    "Peça alguém em casamento (gasta 1 Anel da loja).",
    0
   ],
   [
    "casamento",
    "Veja com quem alguém está casado.",
    0
   ],
   [
    "divorciar",
    "Termina o seu casamento.",
    0
   ]
  ]
 },
 {
  "icone": "🧰",
  "nome": "Utilidades",
  "comandos": [
   [
    "help",
    "Abre a Central de Ajuda.",
    0
   ],
   [
    "ajuda",
    "Abre a Central de Ajuda.",
    0
   ],
   [
    "perfil",
    "Veja o seu perfil com nível, moedas e premium.",
    0
   ],
   [
    "config",
    "Ligue ou desligue as suas configurações pessoais.",
    0
   ],
   [
    "convites",
    "Mostra quantas pessoas você (ou outra pessoa) convidou.",
    0
   ],
   [
    "convites-ranking",
    "Mostra quem mais convidou pessoas para o servidor.",
    0
   ],
   [
    "avatar",
    "Mostra o avatar de alguém em tamanho grande.",
    0
   ],
   [
    "banner",
    "Mostra o banner de perfil de alguém.",
    0
   ],
   [
    "membroinfo",
    "Informações de um membro e do perfil dele.",
    0
   ],
   [
    "serverinfo",
    "Informações do servidor.",
    0
   ],
   [
    "emojiinfo",
    "Veja as informações de um emoji.",
    0
   ],
   [
    "botinfo",
    "Informações sobre o bot.",
    0
   ],
   [
    "lembrete",
    "Cria lembretes: o bot te avisa depois.",
    0
   ],
   [
    "afk",
    "Fica AFK: avisa quem te marcar.",
    0
   ],
   [
    "enquete",
    "Cria uma votação com botões.",
    0
   ],
   [
    "sugestao",
    "Envie uma sugestão para o dono do bot.",
    0
   ],
   [
    "idcomando",
    "Mostra o ID de um Slash Command.",
    0
   ]
  ]
 },
 {
  "icone": "🔨",
  "nome": "Moderação",
  "comandos": [
   [
    "ban",
    "Bane um membro do servidor.",
    1
   ],
   [
    "unban",
    "Desbane um usuário pelo ID.",
    1
   ],
   [
    "kick",
    "Expulsa um membro do servidor.",
    1
   ],
   [
    "timeout",
    "Silencia um membro por um tempo.",
    1
   ],
   [
    "warn",
    "Dá uma advertência a um membro.",
    1
   ],
   [
    "warns",
    "Veja as advertências de um membro.",
    0
   ],
   [
    "delwarn",
    "Remove uma advertência pelo número.",
    1
   ],
   [
    "clear",
    "Apaga mensagens do canal.",
    1
   ],
   [
    "ban-bot",
    "Proíbe alguém de usar o bot.",
    1
   ]
  ]
 },
 {
  "icone": "⚙️",
  "nome": "Administração",
  "comandos": [
   [
    "embed",
    "Painel para criar e gerenciar embeds (com botões de link).",
    1
   ],
   [
    "registrar",
    "Cria e configura o sistema de registro.",
    1
   ],
   [
    "contador",
    "Canal que mostra membros, bots ou canais do servidor.",
    1
   ],
   [
    "youtube",
    "Avisa quando um canal do YouTube posta vídeo novo.",
    1
   ],
   [
    "say",
    "Faz o bot enviar uma mensagem.",
    1
   ],
   [
    "say-adm",
    "Envia uma mensagem privada para um usuário.",
    1
   ],
   [
    "dar-adm",
    "Dá ou remove a permissão de ADM do bot.",
    1
   ]
  ]
 }
];
