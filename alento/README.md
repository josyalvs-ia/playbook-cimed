# Alento — Studio de Beleza

Sistema de gestão do studio: atendimentos, clientes, estoque, caixa,
precificação e comissão. Feito na identidade visual da marca, funciona no
celular como aplicativo e continua funcionando quando a internet cai.

Os **agendamentos continuam no Trinks**. Este sistema cuida do resto — e a
página pública tem um botão que leva as clientes direto para o Trinks.

---

## O que tem dentro

| Tela | Para quê |
|---|---|
| **Painel** | Quanto entrou hoje e no mês, o que falta comprar, quem sumiu, aniversariantes |
| **Atendimentos** | Comanda: cliente, serviços, pagamento. Ao fechar, cai no caixa e baixa o estoque |
| **Clientes** | Ficha, telefone, aniversário, alergias, histórico e ritmo de retorno |
| **Estoque** | Os 176 insumos da planilha, saldo, mínimo, lista de compras e ficha técnica |
| **Caixa** | Entradas e saídas, para onde foi o dinheiro, quanto ficou com a maquininha |
| **Tabela de preços** | O catálogo oficial, editável — muda aqui, muda na comanda e na vitrine |
| **Precificação** | A planilha 2026 viva: mexeu numa premissa, a tabela toda recalcula |
| **Comissões** | Quanto cada uma produziu e quanto tem a receber |
| **Relatórios** | O mês inteiro: faturamento, taxa de retorno, ranking, resultado |
| **Vitrine** (`vitrine.html`) | Página pública com a tabela de valores e o botão de agendar |

---

## Instalação — 15 minutos, uma vez só

### 1. Criar o banco no Supabase

1. Entre em <https://supabase.com> e crie uma conta (o plano gratuito atende
   um studio com folga).
2. **New project**. Dê o nome `alento`, escolha uma senha para o banco
   (guarde) e a região **South America (São Paulo)**.
3. Espere uns 2 minutos até o projeto ficar pronto.

### 2. Criar as tabelas

1. No menu lateral, **SQL Editor** → **New query**.
2. Abra o arquivo [`db/schema.sql`](db/schema.sql) deste repositório, copie
   **tudo** e cole no editor.
3. Clique em **Run**. Deve aparecer *Success*.

### 3. Pegar as duas chaves

Vá em **Project Settings → API** e copie:

- **Project URL** — algo como `https://abcdefgh.supabase.co`
- **anon public** — a chave longa que começa com `eyJ...`

> A chave `anon` é pública por natureza; ela não dá acesso a nada sozinha.
> Quem protege os dados é o login e as regras de acesso criadas pelo
> `schema.sql`. Sem estar logada, ninguém lê nada — exceto a tabela de
> preços, que é pública de propósito, para a vitrine funcionar.

### 4. Ligar o app

Duas opções:

**a) Deixar pronto para todo mundo** — edite [`config.js`](config.js), cole a
URL e a chave, e faça o commit. Aí qualquer aparelho já abre conectado.

**b) Não comitar nada** — deixe o `config.js` como está. Na primeira abertura,
o app pergunta a URL e a chave e guarda no próprio aparelho. Precisa repetir
em cada celular.

### 5. Criar os acessos da Laura e da Julia

No Supabase: **Authentication → Users → Add user → Send invitation**.

Convide os dois e-mails. Cada uma recebe o convite, define a senha e entra.
O cadastro da profissional aparece sozinho no sistema no primeiro login —
depois é só ajustar função e percentual de comissão em **Ajustes → Equipe**.

### 6. Primeira abertura

Ao entrar pela primeira vez, o app oferece instalar os dados iniciais:

- **30 serviços + 3 adicionais** da tabela oficial de valores
- **176 insumos** da planilha, com preço de referência
- as **premissas de precificação** (aluguel, água/luz, contador, taxas,
  margem)

Aceite. Depois é só ir ajustando.

---

## Publicar na internet

O app é estático — não precisa de servidor. No Netlify, com o repositório
conectado, ele já vai ao ar em `SEU-SITE.netlify.app/alento/`.

- **App da equipe:** `.../alento/index.html`
- **Página pública:** `.../alento/vitrine.html`

### Instalar como aplicativo no celular

- **Android/Chrome:** abrir o link → menu **⋮** → *Instalar aplicativo*
- **iPhone/Safari:** abrir o link → botão de compartilhar → *Adicionar à
  Tela de Início*

Vira um ícone igual a qualquer app, abre em tela cheia e funciona offline.

---

## Como o dinheiro é calculado

**Piso técnico de um serviço:**

```
custo direto = material + custo fixo por atendimento + (horas × valor da sua hora)
piso         = custo direto ÷ (1 − taxa de cartão − imposto − margem)
```

A divisão é o ponto: imposto, taxa e margem incidem sobre o **preço final**,
não sobre o custo. Multiplicar o custo por 1,2 é o erro clássico que come a
margem inteira.

Com as premissas da planilha (custo fixo R$ 1.530/mês ÷ 120 atendimentos =
R$ 12,75 por atendimento; R$ 25/hora; imposto 6%; taxa média 1,082%;
margem 20%), **13 dos 30 serviços da tabela oficial estão abaixo do piso** —
a manicure a R$ 45 tem piso de R$ 64,80, por exemplo.

Isso não quer dizer "aumente tudo amanhã". Quer dizer que esses serviços
estão sendo sustentados pelos outros. Em **Precificação** dá para mexer em
cada premissa e ver o efeito na hora.

> As premissas vieram da planilha e são **hipóteses**. Confirme a alíquota
> real com o contador e ajuste as taxas com o extrato da maquininha.

---

## Baixa automática de estoque

A planilha trazia os preços dos insumos, mas não quanto de cada um sai por
atendimento. Por isso a **ficha técnica** começa vazia.

Em **Estoque → Ficha técnica**, escolha um serviço e diga quanto de cada
insumo ele consome. A partir daí, fechar a comanda desconta sozinho — e o
custo do serviço passa a ser o custo real da ficha, não uma estimativa.

Comece pelos 5 serviços que vocês mais fazem. O resto vem com o tempo.

---

## Quando a internet cai

O app continua funcionando: as telas leem de uma cópia local e o que você
salvar entra numa fila. Assim que o sinal volta, tudo sobe sozinho. O rodapé
da lateral mostra o estado (`Sincronizado`, `3 para sincronizar`, `Offline`).

Nada se perde por causa do wi-fi do salão.

---

## Backup

**Ajustes → Baixar backup** gera um `.json` com tudo. Guarde uma cópia por
mês em algum lugar fora do computador. O Supabase também tem backup próprio,
mas uma cópia sua não custa nada.

---

## Estrutura dos arquivos

```
alento/
├── index.html            app da equipe (login)
├── vitrine.html          página pública com a tabela de valores
├── config.js             URL e chave do Supabase
├── manifest.webmanifest  faz virar aplicativo no celular
├── sw.js                 service worker (funciona offline)
├── db/schema.sql         estrutura do banco — cole no Supabase
├── css/app.css           identidade visual da marca
├── assets/               logo, selo e ícones
└── js/
    ├── app.js            navegação e login
    ├── db.js             dados: cache local, fila offline, sincronização
    ├── pricing.js        motor de precificação
    ├── metricas.js       indicadores do negócio
    ├── seed.js           carga inicial
    ├── data/             tabela oficial, 176 insumos, premissas
    └── views/            uma tela por arquivo
```

---

## Identidade visual

Direto do manual da marca:

| | |
|---|---|
| `#E8DFC4` | creme — texto e destaques |
| `#1D1D1B` | preto — relevo do logo |
| `#4A5236` | verde claro — superfícies |
| `#2E3322` | verde — fundo |

Tipografia: **Playfair Display** para os títulos (o serifado do wordmark) e
**Jost** para a interface (o sem serifa das legendas em caixa alta). A
estrela de 4 pontas é o elemento gráfico recorrente, e o pattern de estrelas
aparece de fundo em todas as telas.

O `assets/marca.svg` é uma reconstrução em SVG do logo. Se você tiver o
arquivo vetorial original do designer, substitua o arquivo mantendo o nome —
o app inteiro passa a usar o original.
