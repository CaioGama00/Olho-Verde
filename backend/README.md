# Backend Olho Verde

Este diretório contém o código-fonte para o backend do projeto Olho Verde, construído com Node.js e Express.js.

## Funcionalidades

O backend fornece as seguintes APIs:

*   **Autenticação de Usuários:**
    *   `POST /api/auth/register`: Registro de novos usuários.
    *   `POST /api/auth/login`: Login de usuários existentes.

*   **Gerenciamento de Reports:**
    *   `GET /api/reports`: Obtém todos os reports.
    *   `POST /api/reports`: Cria um novo report (requer autenticação).
    *   `POST /api/reports/:id/vote`: Vota em um report (requer autenticação).

## Armazenamento de Dados

Os dados são armazenados em um arquivo `db.json`, simulando um banco de dados para fins de desenvolvimento.

## Como Executar Localmente

1.  **Navegue até o diretório do backend:**
    ```bash
    cd backend
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Inicie o servidor:**
    ```bash
    npm start
    ```

O servidor estará em execução em `http://localhost:3001`.

## Deploy

O backend está atualmente deployado em: [https://olho-verde.onrender.com](https://olho-verde.onrender.com)
