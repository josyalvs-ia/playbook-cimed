# Testes

Precisam de um servidor local na porta 8899, servindo a raiz do projeto:

```
npx http-server . -p 8899 -s
```

| Arquivo | O que faz |
|---|---|
| `navegador.mjs` | Mais de 350 checagens: as telas do app, o fluxo de comanda, a precificação, o agendamento de ponta a ponta, a agenda em quatro visões, a fila de envio, o sino e o contraste dos campos |
| `auditoria-celular.mjs` | Percorre as duas experiências — equipe e cliente — em iPhone 13, Galaxy S9+ e uma tela de 320px, medindo rolagem lateral, alvos de toque e tamanho de texto |

```
node testes/navegador.mjs
node testes/auditoria-celular.mjs
```

O banco é simulado nos dois: nada toca o Supabase de verdade.

Para o banco, há um teste em SQL que roda contra um Postgres local
(15 cenários: choque de horário, almoço, folga, limite por telefone,
cancelamento). Está descrito no README, seção **Agendamento**.
