# Backend Olho Verde

Este diretório contém o código-fonte para o backend do projeto Olho Verde, construído com Node.js e Express.js.

## Funcionalidades

O backend fornece as seguintes APIs:

*   **Autenticação de Usuários:**
    *   `POST /api/auth/register`: Registro de novos usuários.
    *   `POST /api/auth/login`: Login de usuários existentes.
    *   `POST /api/auth/password-reset/request`: Solicita o envio de um email de redefinição de senha.
    *   `POST /api/auth/password-reset/confirm`: Valida o token recebido por email e define uma nova senha.

*   **Gerenciamento de Reports:**
    *   `GET /api/reports`: Obtém todos os reports aprovados.
    *   `GET /api/reports/:id`: Detalhes de um report, comentários e voto do usuário autenticado.
    *   `GET /api/reports/:id/comments`: Lista comentários do report.
    *   `POST /api/reports/:id/comments`: Cria um comentário (requer autenticação).
    *   `POST /api/reports`: Cria um novo report com upload de imagem (requer autenticação).
    *   `POST /api/reports/:id/vote`: Vota em um report (requer autenticação).
    *   `GET /api/reports/:id/image-proxy`: Proxy para servir a imagem do report (contorna CORS e entrega a partir do Supabase Storage ou URL pública).

## Armazenamento de Dados

Os dados de usuários e reports ficam no Supabase configurado via variáveis de ambiente.

## Variáveis de ambiente úteis

Além das chaves do Supabase e HuggingFace, configure também:

* `FRONTEND_BASE_URL`: URL base do frontend (ex.: `http://localhost:5173`). Usada para montar o link padrão de redefinição de senha.
* `PASSWORD_RESET_REDIRECT_URL`: URL completa para onde o Supabase deve redirecionar o usuário após clicar no link enviado por email (ex.: `http://localhost:5173/reset-password`).

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
