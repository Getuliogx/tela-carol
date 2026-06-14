OVERLAY TWITCH + KICK PARA RENDER

Arquivos do Render:
- server.js
- package.json

Arquivos do StreamElements:
- streamelements-html.html -> aba HTML
- streamelements-css.css  -> aba CSS
- streamelements-js.js    -> aba JS

IMPORTANTE:
Se sua URL do Render não for https://tela-carol.onrender.com, troque isso nos arquivos do StreamElements:
- streamelements-html.html
- streamelements-js.js

Variáveis no Render > Environment:
TWITCH_CHANNEL=carolinaporto
KICK_CHANNEL=carolinaporto
KICK_CHATROOM_ID=ID_DA_SALA_DA_KICK
KICK_ALLOWED_USERS=xyzgx,carolinaporto

Comandos:
!l1 EP 9 - T3
!l2 Patrocinador

!c1
Aumenta o episódio. Exemplo: EP 9 - T3 -> EP 10 - T3

!c2
Aumenta a temporada e volta o EP para 1. Exemplo: EP 10 - T3 -> EP 1 - T4

!ep 9
Define episódio manualmente.

!t 3
Define temporada manualmente.

Cores:
!j1 #ff0000
!j2 #00ff00
!j1 ff0000
!j2 00ff00
!j1(#ff0000)
!j2(#00ff00)

Colorido:
!j1 colorido
!j2 colorido
!j1(colorido)
!j2(colorido)

Cada vez que usar colorido, as letras ficam com cores diferentes.
Se a linha estiver em modo colorido e você atualizar o texto, as cores também mudam.

Reset das cores:
!j1 reset
!j2 reset
!j1(reset)
!j2(reset)

Cores normais do reset:
Linha 1: #ffffff
Linha 2: #f49dee

Permissão:
Twitch: broadcaster/mod.
Kick: broadcaster/mod detectado OU usuário listado em KICK_ALLOWED_USERS, porque a Kick nem sempre envia badge de mod pelo websocket público.
