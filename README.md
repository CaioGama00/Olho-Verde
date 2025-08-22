# Olho Verde

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)

## 1. Visão Geral

**Olho Verde** é um projeto de engenharia de software que visa criar uma plataforma web colaborativa para o mapeamento de problemas urbanos na cidade de São Paulo. Inspirado em modelos de *crowdsourcing* como o Waze, o sistema permitirá que os cidadãos reportem, de forma geolocalizada, questões que afetam a sustentabilidade e a qualidade de vida na cidade.

Este projeto está sendo desenvolvido como parte da disciplina de Engenharia de Software, utilizando a metodologia ágil **Scrum**.

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

A principal API utilizada para esta funcionalidade será a **API do Google Maps**.

## 4. Documentação do Projeto

Toda a documentação referente ao planejamento, requisitos, arquitetura e testes está localizada na pasta `/docs`.

*   [Definição do Problema e Escolha da API](./docs/01_PROBLEMA_E_API.md)
*   [Público-Alvo e Mapa de Empatia](./docs/02_PUBLICO_ALVO.md)
*   [Backlog Inicial de Funcionalidades](./docs/03_BACKLOG_INICIAL.md)
*   [Apoio Ferramental](./docs/04_FERRAMENTAS.md)

## 5. Tecnologias (Proposta Inicial)

*   **Frontend:** React
*   **Backend:** Node.js com Express.js
*   **Banco de Dados:** PostgreSQL

## 6. Como Contribuir

Este é um projeto acadêmico. Para detalhes sobre o cronograma e as entregas, consulte a documentação na pasta `/docs`.