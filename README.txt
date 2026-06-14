PACOTE CORRIGIDO - Render + StreamElements

CORREÇÕES:
- Agora já começa em: EP 1 - T1
- !l1 EP 9 - T3 atualiza o contador interno.
- Depois de !l1 EP 9 - T3, o comando !c1 vira EP 10 - T3.
- !c2 aumenta temporada e volta EP para 1.
- !j1 colorido e !j2 colorido mudam as cores das letras toda vez que usar.
- !j1 reset e !j2 reset voltam para as cores normais.
- A linha colorida também ganha cores novas quando o texto muda.

ARQUIVOS:
- server.js e package.json: colocar no GitHub do Render.
- streamelements-html.html: colar no HTML do StreamElements.
- streamelements-css.css: colar no CSS do StreamElements.
- streamelements-js.js: colar no JS do StreamElements.

COMANDOS:
!l1 EP 9 - T3
!l2 Nome do patrocinador

!c1
Sobe o episódio usando o valor atual.

!c2
Sobe a temporada e volta EP para 1.

!ep 9
Ajusta só o episódio.

!t 3
Ajusta só a temporada.

!j1 #ff0000
!j2 #00ff00

!j1 colorido
!j2 colorido

!j1 reset
!j2 reset

IMPORTANTE:
No arquivo streamelements-js.js e streamelements-html.html, se sua URL do Render for diferente de:
https://tela-carol.onrender.com
troque pela sua URL real.

VARIÁVEIS DO RENDER:
TWITCH_CHANNEL = carolinaporto
KICK_CHANNEL = carolinaporto
KICK_CHATROOM_ID = ID_DA_SALA_DA_KICK
KICK_ALLOWED_USERS = xyzgx,carolinaporto
