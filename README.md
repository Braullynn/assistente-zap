# 🤖 Laura AI - Assistente Virtual Inteligente

Este projeto é uma assistente virtual focada em agendamentos que opera via **WhatsApp**, integrada com a inteligência artificial do Google Gemini. Ela permite criar lembretes em linguagem natural e gerenciar tudo através de um painel web moderno.

## 🚀 Como Inicializar

### 1. Pré-requisitos
- **Node.js** instalado.
- Uma **API Key do Google Gemini** (obtenha gratuitamente no [Google AI Studio](https://aistudio.google.com/)).
- Um celular com **WhatsApp** para escanear o QR Code de conexão.

### 2. Configuração do Ambiente
Clone o repositório e renomeie o arquivo `.env.example` para `.env`. Preencha as chaves:
```env
PORT=3000
JWT_SECRET=sua_chave_secreta_aqui
GEMINI_API_KEY=sua_chave_gemini_aqui
DB_MODE=local
```

### 3. Instalação e Execução
Diferente de versões anteriores, agora você só precisa de **um único terminal** para rodar todo o projeto (Backend + Frontend):

```bash
# 1. Instale as dependências na raiz
npm install

# 2. Instale as dependências do cliente
cd client && npm install && cd ..

# 3. Inicie o projeto completo
npm run dev
```

Após rodar `npm run dev`, um **QR Code** aparecerá no terminal. Escaneie-o usando a opção "Aparelhos Conectados" do seu WhatsApp para ativar a Laura.

- **Painel Web**: http://localhost:5173
- **API Backend**: http://localhost:3000

---

## 📌 Funcionalidades Principais

- **IA Conversacional**: A Laura interpreta pedidos em linguagem natural (ex: "me lembra de beber água daqui a 20 min" ou "me lembra de estudar amanhã às 14h").
- **Chat de Teste**: Interface no painel web para conversar com a Laura e testar comandos.
- **Cópia no WhatsApp**: Quando você usa o chat de teste e cria um lemnbrete, a Laura envia uma cópia para o seu WhatsApp.
- **Sistema de Lembretes**: O motor de agendamento verifica o banco de dados a cada minuto e dispara as mensagens automaticamente.
- **Gestão de Usuários**: CRUD completo para gerenciar quem tem permissão para usar a assistente.

---

## 🛠️ Tecnologias Utilizadas

- **Core**: Node.js & Express.
- **IA**: [por enquanto google gemini](https://ai.google.dev/).
- **WhatsApp**: [whatsapp-web.js](https://wwebjs.dev/) (Integração local via Puppeteer).
- **Banco de Dados**: SQLite (better-sqlite3) para persistência local rápida.
- **Frontend**: React (Vite) + Lucide React + Vanilla CSS.
- **Segurança**: Autenticação via JWT (JSON Web Token).
