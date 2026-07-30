# Plataforma de Gestão de Jovens Aprendizes — CIMED

App web (SPA) para gerir o programa Jovem Aprendiz. Acessível em `/plataforma/` após o deploy no Netlify.

## O que tem

- **Dashboard** — KPIs (ativos, contratos a vencer, assinaturas pendentes, convites), distribuição por área, situação dos aprendizes e contratos próximos do vencimento.
- **Base de Aprendizes** — cadastro completo (dados pessoais, área, líder, instituição, curso, vigência), busca, filtros, ficha detalhada e exportação CSV.
- **Contratos** — upload de contratos (PDF/imagem/doc) vinculados ao aprendiz, com controle de vigência e alerta de vencimento. Arquivos ficam no navegador (IndexedDB).
- **Documentos & Assinaturas** — registro de documentos que precisam da assinatura do líder, com prazo, status e **aviso por e-mail ao líder**.
- **Convites** — envio de convites por e-mail a candidatos, com link de cadastro e acompanhamento (pendente / enviado / aceito).
- **Alertas** — central de pendências (contratos vencendo, assinaturas atrasadas, convites, aniversários).
- **Relatórios** — indicadores e exportação CSV.
- **Configurações** — dados da organização e backup/restauração.

## Persistência

Os dados estruturados ficam em `localStorage` e os arquivos em `IndexedDB` (no navegador do usuário). Não há banco de dados no servidor nesta versão. Use **Configurações → Backup (JSON)** para salvar/restaurar.

## Envio de e-mail (Resend)

O envio real usa a Netlify Function `netlify/functions/enviar-email.js` (provedor **Resend**).

1. Crie conta em [resend.com](https://resend.com) e gere uma **API Key**.
2. No Netlify: **Site settings → Environment variables**, adicione:
   - `RESEND_API_KEY` — sua chave (obrigatório)
   - `EMAIL_REMETENTE` — opcional, ex.: `Aprendizes CIMED <aprendizes@seudominio.com.br>` (o domínio precisa estar verificado no Resend)
3. Refaça o deploy.

Sem a chave configurada, a plataforma abre automaticamente o programa de e-mail do usuário (mailto) como alternativa.
