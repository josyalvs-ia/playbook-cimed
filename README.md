# Alento — Studio de Beleza

Sistema de gestão do studio: atendimentos, clientes, estoque, caixa,
precificação e comissão. Feito na identidade visual da marca, funciona no
celular como aplicativo e continua funcionando quando a internet cai.

A cliente **marca o próprio horário** pela página pública, e o horário já fica
fechado na agenda. Não depende do Trinks.

---

## O que tem dentro

| Tela | Para quê |
|---|---|
| **Painel** | Quanto entrou hoje e no mês, o que falta comprar, quem sumiu, aniversariantes |
| **Agenda** | O dia de cada profissional em colunas; folga e férias; o horário vira comanda quando a cliente chega |
| **Atendimentos** | Comanda: cliente, serviços, pagamento. Ao fechar, cai no caixa e baixa o estoque |
| **Clientes** | Ficha, telefone, aniversário, alergias, histórico e ritmo de retorno |
| **Estoque** | Os 176 insumos da planilha, saldo, mínimo, lista de compras e ficha técnica |
| **Caixa** | Entradas e saídas, para onde foi o dinheiro, quanto ficou com a maquininha |
| **Tabela de preços** | O catálogo oficial, editável — muda aqui, muda na comanda e na vitrine |
| **Precificação** | A planilha 2026 viva: mexeu numa premissa, a tabela toda recalcula |
| **Comissões** | Quanto cada uma produziu e quanto tem a receber |
| **Relatórios** | O mês inteiro: faturamento, taxa de retorno, ranking, resultado |
| **Vitrine** (`vitrine.html`) | Página pública com a tabela de valores e o agendamento da cliente |

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

> **Se o seu banco já existia antes de agosto de 2026**, rode também
> [`db/atualizar.sql`](db/atualizar.sql) do mesmo jeito: é o que acrescenta a
> foto e a apresentação de cada profissional, e a conferência que tira do
> celular da cliente o horário que já foi cancelado. Quem está criando o banco
> agora não precisa — já vem no `schema.sql`. Rodar duas vezes não faz mal.

### 3. Pegar a URL e a chave pública

O Supabase mudou o menu em 2025, então os dois dados ficam em páginas
diferentes. Comece clicando na engrenagem **Settings**, no fim da barra
lateral esquerda.

**A chave** — em **Settings → API Keys**:

- Nos projetos novos, aparece **Publishable key**, começando com
  `sb_publishable_...`. É essa.
- Nos projetos mais antigos, aparece **anon** **public**, uma chave longa
  começando com `eyJ...`. Também serve. Se ela não estiver na primeira aba,
  procure a aba **Legacy API keys**.
- **Não use** a `service_role` nem a `sb_secret_...`. Essas são secretas e
  não podem sair do servidor. O app recusa se você colar uma delas.

**A URL** — o jeito mais rápido é **olhar a barra de endereço do navegador**.
Estando dentro do projeto, o endereço tem esta forma:

```
supabase.com/dashboard/project/SEU-CODIGO/settings/general
                               └────┬────┘
```

Esse pedaço do meio é o código do seu projeto. A URL é ele seguido de
`.supabase.co`:

```
https://SEU-CODIGO.supabase.co
```

Se preferir achar pelo menu, está em **Settings → Data API**, campo
**Project URL** (no painel em português: **Configurações → API de dados**).

> Nota: o painel do Supabase pode estar traduzido. **Chaves de API** é a
> página das chaves e **API de dados** é onde fica a Project URL.

> A chave pública é pública por natureza — ela não dá acesso a nada sozinha.
> Quem protege os dados é o login e as regras de acesso criadas pelo
> `schema.sql`. Sem estar logada, ninguém lê nada — exceto a tabela de
> preços, que é pública de propósito, para a vitrine funcionar.

### 4. Ligar o app

Duas opções:

**a) Deixar pronto para todo mundo** — edite [`config.js`](config.js), cole a
URL e a chave, e faça o commit. Aí qualquer aparelho já abre conectado.
É o caminho mais prático quando as duas vão usar em vários aparelhos.

**b) Não comitar nada** — deixe o `config.js` como está. Na primeira abertura,
o app pergunta a URL e a chave e guarda no próprio aparelho. Precisa repetir
em cada celular.

### 5. Fechar o auto-cadastro

**Faça isso antes de convidar alguém.** Em **Authentication → Sign In /
Providers → Email**, desligue **Allow new users to sign up**.

Sem isso, qualquer pessoa que descubra o endereço do projeto pode criar uma
conta sozinha. O banco já barra essas contas (veja *Como o acesso é
protegido*, abaixo), mas fechar o cadastro é a primeira porta e não custa
nada.

### 6. Criar os acessos da Laura e da Julia

No Supabase: **Authentication → Users → Add user → Send invitation**.

Convide os dois e-mails. Cada uma recebe o convite, define a senha e entra.
O cadastro da profissional aparece sozinho no sistema no primeiro login —
depois é só ajustar função e percentual de comissão em **Ajustes → Equipe**.

> Se alguém aparecer com a tela **"Acesso não liberado"**, é porque a conta
> existe mas não está marcada como profissional ativa. Quem já está dentro
> resolve em **Ajustes → Equipe**, marcando *Pode usar o sistema*.

### 7. Primeira abertura

Ao entrar pela primeira vez, o app oferece instalar os dados iniciais:

- **30 serviços + 3 adicionais** da tabela oficial de valores
- **176 insumos** da planilha, com preço de referência
- as **premissas de precificação** (aluguel, água/luz, contador, taxas,
  margem)

Aceite. Depois é só ir ajustando.

---

## Publicar na internet

O app é estático — não precisa de servidor nem de build. No Netlify, com o
repositório conectado, ele já vai ao ar na raiz do site.

- **App da equipe:** `SEU-SITE.netlify.app/`
- **Página pública:** `SEU-SITE.netlify.app/vitrine.html`

O link que você manda para as clientes é o da **vitrine**. O `index.html` pede
login e é só para vocês duas.

### Instalar como aplicativo no celular

- **Android/Chrome:** abrir o link → menu **⋮** → *Instalar aplicativo*
- **iPhone/Safari:** abrir o link → botão de compartilhar → *Adicionar à
  Tela de Início*

Vira um ícone igual a qualquer app, abre em tela cheia e funciona offline.

---

## Como o acesso é protegido

O endereço do projeto e a chave publicável ficam no `config.js`, que vai para
o repositório. Isso é normal: em qualquer aplicativo web que usa Supabase,
esses dois valores precisam estar no navegador de quem abre a página. Eles não
dão acesso a nada sozinhos.

A proteção real está no banco:

1. **Sem login, ninguém lê nada** — a única exceção é a tabela de preços e os
   dados de contato do studio, que são públicos de propósito para a vitrine
   funcionar.
2. **Estar logada não basta.** Só enxerga o studio quem estiver cadastrada em
   `profissionais` com acesso ativo. Uma conta criada por um estranho entra
   **inativa** e não lê absolutamente nada — nem clientes, nem caixa, nem
   agenda. Ela vê apenas a tela "Acesso não liberado".
3. **Entra como ativa** quem foi convidada pelo painel do Supabase, e quem
   instalou o sistema. Mais ninguém.
4. **Você pode revogar** o acesso de alguém a qualquer momento em
   **Ajustes → Equipe**, sem apagar o histórico de atendimentos dela.

O que nunca pode sair do painel do Supabase é a chave **secreta**
(`sb_secret_...` / `service_role`). Essa ignora todas as regras acima. O app
inclusive se recusa a aceitá-la, caso alguém cole por engano.

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

## Agendamento

A cliente escolhe o serviço, o dia e a hora. O sistema mostra **só o que está
realmente livre**: cruza o horário de funcionamento de cada profissional, o
tempo que aquele serviço leva, os atendimentos já marcados e as folgas.

Quem faz o serviço é deduzido do próprio serviço — "Escova longo" é da Laura,
"Manicure" é da Julia. A cliente não precisa saber disso.

Três coisas que o banco resolve e o navegador não conseguiria:

1. **Duas clientes no mesmo horário.** Uma restrição de exclusão no Postgres
   recusa a segunda, mesmo que os cliques sejam simultâneos.
2. **A agenda não é pública.** A página da cliente nunca lê a tabela de
   agendamentos — seria expor nome e telefone de todo mundo. Ela conversa com
   três funções que devolvem só o necessário.
3. **Horário que sumiu enquanto ela decidia.** A validação é refeita no
   servidor no momento de marcar, não na hora de listar.

Configure o horário de funcionamento em **Ajustes → Horário de funcionamento**.
Dia sem horário cadastrado é dia fechado. Folga e férias entram em
**Agenda → Folga**.

### Lembrete de horário

Mandar mensagem sozinho exige a API oficial do WhatsApp, que é paga. O que o
sistema faz é o caminho mais curto sem isso: cada horário na agenda tem um
botão que **abre o WhatsApp com a mensagem já escrita**, com nome, serviço,
dia e hora. Um toque em vez de automático.

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
├── index.html            app da equipe (login)
├── vitrine.html          página pública com a tabela de valores
├── guia-dominio.html     passo a passo para comprar o domínio (abre e imprime)
├── apresentacao-marca.html  o manual da marca, em 14 telas
├── config.js             URL e chave do Supabase
├── manifest.webmanifest  faz virar aplicativo no celular
├── sw.js                 service worker (funciona offline)
├── db/schema.sql         estrutura do banco — cole no Supabase
├── db/atualizar.sql      o que mudou desde a primeira versão (bancos antigos)
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

cimed/index.html          página antiga que já existia neste repositório,
                          guardada aqui para não se perder. Não faz parte do
                          Alento e pode ser apagada quando você quiser.
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
