# 💰 Dashboard de Gastos

Dashboard pessoal para acompanhar as finanças do mês: saldo (receitas − despesas), gastos por categoria, assinaturas e contas fixas recorrentes, impostos e contas a pagar.

Feito com **React + Vite + TypeScript**, **Recharts** e **Firebase** (Auth com Google, Firestore e Hosting).

## Funcionalidades

- **Visão geral**: saldo do mês, receitas, despesas (comparadas ao mês anterior), total a pagar, ranking de gastos por categoria, gráfico de gastos por dia e contas pendentes/atrasadas.
- **Lançamentos**: lista do mês com busca e filtros; marcar como pago, editar e excluir.
- **Recorrentes**: assinaturas, contas fixas e salário aparecem automaticamente todo mês, com status de pago por mês, valor diferente em um mês específico, pausa e data de término.
- **Configurações**: categorias personalizáveis (nome, emoji, cor) e backup/importação em JSON.
- Sincroniza entre dispositivos e funciona offline (cache local do Firestore).

## Segurança

O repositório é público, então **nenhuma credencial ou dado pessoal fica no código**:

- A config do Firebase fica em `.env.local` (ignorado pelo Git). A config web do Firebase não é um segredo — ela vai no JavaScript publicado — quem protege os dados são as regras do Firestore.
- As regras (`firestore.rules`) só permitem acesso a contas presentes na coleção `allowed/{uid}`, e cada conta só acessa `users/{uid}/…`. Essa allowlist é criada manualmente no console e **não pode ser gravada pelo app**, então ninguém consegue se autorizar sozinho, mesmo logando com Google.
- `.firebaserc` (ID do projeto) também fica fora do Git.

## Configuração

Pré-requisitos: Node 20+ e uma conta Google.

1. **Instale as dependências**
   ```bash
   npm install
   ```
2. **Crie o projeto no [console do Firebase](https://console.firebase.google.com/)**
   - *Authentication → Sign-in method*: ative **Google**.
   - *Firestore Database*: crie o banco em **modo de produção**.
   - *Configurações do projeto → Seus apps*: registre um app **Web** e copie a config.
3. **Configure o ambiente**
   ```bash
   cp .env.example .env.local        # preencha com a config do app Web
   npx firebase login
   npx firebase use --add            # escolha o projeto (gera .firebaserc, ignorado pelo Git)
   ```
4. **Publique as regras de segurança**
   ```bash
   npx firebase deploy --only firestore:rules
   ```
5. **Libere sua conta**
   - Rode `npm run dev`, abra o endereço mostrado e entre com Google.
   - A tela "Conta não autorizada" mostra seu **UID**. No console, em *Firestore*, crie a coleção `allowed` com um documento cujo **ID é esse UID** (pode ficar sem campos).
   - Recarregue a página.

## Deploy (Firebase Hosting)

```bash
npm run deploy
```

O site fica em `https://<seu-projeto>.web.app`.

## Desenvolvimento com emuladores

Para testar sem tocar nos dados reais (requer Java):

```bash
npm run emulators        # Auth + Firestore locais, projeto demo-gastos
npm run dev:emulators    # em outro terminal
```

Crie o documento `allowed/<UID>` pela interface dos emuladores em http://127.0.0.1:4000.

## Estrutura

```
src/
  lib/firebase.ts          # inicialização do Firebase (lê .env.local)
  lib/selectors.ts         # cálculos: itens do mês, totais, categorias, recorrentes
  store/FinanceStore.tsx   # sincroniza o Firestore e traduz ações em gravações
  components/              # telas e componentes
firestore.rules            # regras de acesso
```
