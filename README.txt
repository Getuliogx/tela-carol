CORREÇÃO: modo com T e sem T

Agora o sistema respeita o que você escreveu no !l1.

EXEMPLOS:

!l1 EP 9 - T3
mostra: EP 9 - T3
!c1 mostra: EP 10 - T3
!c2 mostra: EP 1 - T4

!l1 EP 9
mostra: EP 9
!c1 mostra: EP 10
!c2 mostra: EP 1

Mesmo quando não mostra "- T", a temporada continua salva por dentro.
Exemplo:
Se estava em T3 e você usa !l1 EP 9, ele mostra EP 9, mas continua sabendo que está na T3.
Se depois usar !l1 EP 9 - T3, volta a mostrar com temporada.

Também aceita:
!l1 EP9
!l1 9

Comandos:
!l1 texto
!l2 texto
!c1
!c2
!ep 9
!t 3
!j1 #ff0000
!j2 #00ff00
!j1 colorido
!j2 colorido
!j1 reset
!j2 reset

Substitua no GitHub/Render:
server.js
package.json

Substitua no StreamElements:
streamelements-html.html
streamelements-css.css
streamelements-js.js

Se sua URL do Render não for https://tela-carol.onrender.com, troque nos arquivos do StreamElements.
