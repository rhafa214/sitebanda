# Missão Sedentos | Pro

Sistema de gestão interna da equipe Missão Sedentos.
Este sistema é de uso exclusivo para a equipe interna (4 a 6 pessoas).

## Tecnologias Utilizadas
- **Frontend:** HTML, CSS, e JavaScript (Vanilla)
- **Estilização:** Tailwind CSS (via CDN)
- **Banco de Dados & Autenticação:** Firebase (Firestore e Authentication)
- **Ícones:** Font Awesome (via CDN)

*(Nota: O package.json contém dependências como React, Vite e Gemini, mas o projeto roda inteiramente como HTML/JS/CSS estático.)*

## Como Rodar Localmente
Basta abrir o arquivo `index.html` em um navegador moderno ou iniciar um servidor estático simples na pasta raiz, por exemplo:
```bash
npx serve .
```

Como há arquivos de configuração do Vite no projeto (`vite.config.ts`, `package.json`), você também pode utilizar:
```bash
npm install
npm run dev
```

## Integrações Externas
- **Firebase:** Gerencia a autenticação e guarda os dados em tempo real.
- **Google Drive (Iframe):** Exibição de documentos e pastas.
- **Google Identity / Gmail:** Sincronização com o Gmail na aba de dashboard.
- **Liturgia Diária:** Consumo da API `https://liturgia.up.railway.app/`.

## Configurações e Segurança
- O sistema usa um **login compartilhado** (e-mail fixo e chave única) configurado no Firebase Authentication.
- Nenhuma chave secreta (`API_KEY`, senhas de serviço) deve ser colocada neste repositório. O acesso de banco do Firebase frontend é protegido pelas regras do Firestore.
- **AS REGRAS ATIVAS DO FIRESTORE PRECISAM SER CONFERIDAS NO CONSOLE DO FIREBASE.**
- O "Cofre" de senhas foi removido do frontend e do código fonte por segurança.
