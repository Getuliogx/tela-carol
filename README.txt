COMANDOS

!l1 texto
Troca a linha 1. Exemplo: !l1 EP 9 - T3

!l2 texto
Troca a linha 2. Exemplo: !l2 Patrocinador

!c1
Soma +1 no episódio e atualiza a linha 1.
Exemplo: EP 9 - T3 vira EP 10 - T3

!c2
Soma +1 na temporada, volta o episódio para 1 e atualiza a linha 1.
Exemplo: EP 10 - T3 vira EP 1 - T4

!ep 9
Define o episódio manualmente e atualiza a linha 1.

!t 3
Define a temporada manualmente, volta EP para 1 e atualiza a linha 1.

!j1 #ff0000
Troca a cor da linha 1.
Também aceita sem #: !j1 ff0000
Também aceita com parênteses: !j1(#ff0000)

!j2 #00ff00
Troca a cor da linha 2.

!j1 colorido
Cada letra da linha 1 fica de uma cor.
Também aceita: !j1(colorido)

!j2 colorido
Cada letra da linha 2 fica de uma cor.

RENDER ENVIRONMENT

TWITCH_CHANNEL = carolinaporto
KICK_CHANNEL = carolinaporto
KICK_CHATROOM_ID = ID_DA_SALA_DA_KICK
KICK_ALLOWED_USERS = xyzgx,carolinaporto

No GitHub/Render envie/substitua:
server.js
package.json

No StreamElements cole:
streamelements-html.html na aba HTML
streamelements-css.css na aba CSS
streamelements-js.js na aba JS

IMPORTANTE
Troque tela-carol.onrender.com pela URL real do seu Render se for diferente.
