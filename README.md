<div align="center">

# 🌙 Yogiri Takatou

**Bot de Discord completo, em português: economia, XP, música, tickets, sorteios, convites e moderação.**

[🌐 Site do bot](https://miguelbelardt.github.io/-miguelgamebp-bot) • [➕ Adicionar ao Discord](https://miguelbelardt.github.io/-miguelgamebp-bot) • [📚 Comandos](https://miguelbelardt.github.io/-miguelgamebp-bot/#comandos)

</div>

---

## ✨ Recursos

| | |
|---|---|
| 💰 **Economia** | Daily, trabalho, loja, inventário, premium e ranking de moedas |
| 📈 **XP e níveis** | Ganhe XP conversando, suba de nível e dispute o ranking (XP global entre servidores) |
| 🎵 **Música** | Fila, loop, volume, embaralhar e controle completo na call |
| 🎫 **Tickets** | Painel de atendimento com assumir, transcrição e avaliação |
| 🎁 **Sorteios** | Vários vencedores, novo sorteio em um clique e opção de marcar `@everyone` |
| 🎟️ **Convites** | Descobre quem convidou quem, `/convites` e `/convites-ranking` |
| 👋 **Boas-vindas e saída** | Embeds personalizáveis com variáveis como `{user}`, `{server}`, `{inviter}` e `{invites}` |
| 🛡️ **Moderação** | Ban, kick, timeout, avisos, logs e limpeza de mensagens |
| ⚙️ **Configurações** | `/config` (pessoal) e `/server-config` (do servidor) para ligar e desligar recursos |
| 🧩 **Embeds** | Editor de embeds com botões de link |

## 🚀 Como usar

1. **Adicione o bot** ao seu servidor pelo [site](https://miguelbelardt.github.io/-miguelgamebp-bot).
2. Use `/help` para abrir a Central de Ajuda.
3. Configure com `/server-config` e `/config`.

O prefixo para comandos de texto é `'`.

## 🛠️ Tecnologias

- JavaScript (Node.js) com [discord.js](https://discord.js.org) 14
- MySQL (`mysql2`)

## 📦 Rodando o seu próprio bot

```bash
git clone https://github.com/miguelbelardt/-miguelgamebp-bot.git
cd -miguelgamebp-bot
npm install
```

Crie um arquivo `.env` na raiz (ele já está no `.gitignore`, então não vai para o GitHub):

```env
TOKEN=token_do_seu_bot
CLIENT_ID=id_do_seu_bot
DATABASE_URL=mysql://usuario:senha@host:3306/banco
```

Depois inicie:

```bash
node index.js
```

Os comandos de barra são registrados automaticamente quando o bot liga. As tabelas do banco também são criadas sozinhas.

> ⚠️ O bot precisa da permissão **Gerenciar Servidor** (ou Administrador) para acompanhar os convites.

## 📄 Licença

Projeto pessoal de [@miguelbelardt](https://github.com/miguelbelardt). Sem licença definida: todos os direitos reservados.
