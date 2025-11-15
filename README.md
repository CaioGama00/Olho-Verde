# Olho Verde

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)

## 1. Visão Geral

**Olho Verde** é um projeto de engenharia de software que visa criar uma plataforma web colaborativa para o mapeamento de problemas urbanos na cidade de São Paulo. Inspirado em modelos de *crowdsourcing* como o Waze, o sistema permitirá que os cidadãos reportem, de forma geolocalizada, questões que afetam a sustentabilidade e a qualidade de vida na cidade.

Este projeto está sendo desenvolvido como parte da disciplina de MAC0332 - Engenharia de Software, utilizando a metodologia ágil **Scrum**.

## 2. O Problema

A cidade de São Paulo enfrenta desafios constantes como:

*   Pontos de alagamento
*   Acúmulo de lixo em locais inadequados
*   Árvores com risco de queda
*   Bueiros entupidos
*   Focos de água parada (potenciais criadouros do Aedes aegypti)

A comunicação desses problemas aos órgãos competentes é, muitas vezes, difusa e pouco eficiente. O "Olho Verde" busca ser o canal direto e centralizado para essas notificações.

## 3. A Solução

Nossa plataforma permitirá que um usuário cadastrado possa:
*   Navegar em um mapa interativo de São Paulo.
*   Adicionar um "report" em uma localização específica.
*   Categorizar o problema com um ícone correspondente.
*   Visualizar os reports de outros usuários.
*   Votar em um report para indicar se o problema ainda persiste ou se foi solucionado.

A principal API utilizada para esta funcionalidade será a **API do OpenStreetMap**.

## 4. Documentação do Projeto

Toda a documentação referente ao planejamento, requisitos, arquitetura e testes está localizada na pasta `/docs`.

*   [Definição do Problema e Escolha da API](./docs/01_PROBLEMA_E_API.md)
*   [Público-Alvo e Mapa de Empatia](./docs/02_PUBLICO_ALVO.md)
*   [Backlog Inicial de Funcionalidades](./docs/03_BACKLOG_INICIAL.md)
*   [Apoio Ferramental](./docs/04_FERRAMENTAS.md)

## 5. Tecnologias

*   **Frontend:** React (com Vite)
*   **Backend:** Node.js com Express.js
*   **Banco de Dados:** JSON Server (para simulação de API RESTful com `db.json`)

## 6. Como Contribuir

Este é um projeto acadêmico. Para detalhes sobre o cronograma e as entregas, consulte a documentação na pasta `/docs`.

## 7. Getting Started

Para configurar e executar o projeto localmente, siga os passos abaixo:

### Pré-requisitos

*   Node.js (versão 14 ou superior)
*   npm (gerenciador de pacotes do Node.js)
*   Git

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/CaioGama00/Olho-Verde.git
    cd Olho-Verde
    ```

2.  **Configure as variáveis de ambiente do Backend (uma vez):**
    - Copie `.env.example` (quando disponível) ou crie um arquivo `backend/.env` com suas chaves Supabase e HuggingFace (opcional para testes locais).

3.  **Instale as dependências do Backend:**
    ```bash
    cd backend
    npm install
    cd ..
    ```

4.  **Instale as dependências do Frontend:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

5. **Configuração do Frontend (opcional, mas recomendado):**
   - Crie um arquivo `frontend/.env.local` baseado em `frontend/.env.example` definindo `VITE_API_BASE_URL` para apontar para o backend que deseja usar (ex.: `http://localhost:3001/api`).

### Execução

1.  **Inicie o Backend:**
    Abra um novo terminal, navegue até o diretório `backend` e execute:
    ```bash
    cd backend
    npm start
    ```
    O servidor estará em execução em `http://localhost:3001`.

2.  **Inicie o Frontend:**
    Abra outro novo terminal, navegue até o diretório `frontend` e execute:
    ```bash
    cd frontend
    npm run dev
    ```
    A aplicação estará disponível em `http://localhost:5173` (ou outra porta, se a 5173 estiver em uso).

### URLs de Deploy

*   **Frontend:** [olhoverde.netlify.app](https://olhoverde.netlify.app)
*   **Backend:** [https://olho-verde.onrender.com](https://olho-verde.onrender.com)
