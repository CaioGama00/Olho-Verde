# 1. Definição do Problema e Escolha da API

## Problema

A cidade de São Paulo, como grande metrópole, enfrenta diversos desafios urbanos que afetam diretamente a qualidade de vida de seus cidadãos e o meio ambiente. Problemas como alagamentos recorrentes, acúmulo de lixo em locais inadequados, árvores com risco de queda, bueiros entupidos e focos de água parada (potenciais criadouros de mosquitos) são comuns e muitas vezes não são reportados ou solucionados com a devida agilidade.

A falta de um canal centralizado e de fácil acesso para que a população possa notificar esses problemas de forma geolocalizada dificulta a ação dos órgãos públicos responsáveis e a conscientização da própria comunidade.

## Solução Proposta: Olho Verde

O "Olho Verde" será uma plataforma web que permitirá aos cidadãos reportar e visualizar esses problemas urbanos em um mapa interativo da cidade de São Paulo. A solução visa ser um canal direto entre a população e a gestão pública, promovendo a cidadania ativa e a colaboração para a construção de uma cidade mais sustentável e resiliente.

## Escolha da API: OpenStreetMap API

Para viabilizar a geolocalização e a interatividade do mapa, a **API do OpenStreetMap** foi escolhida.

**Justificativa:**

*   **Base de Mapas Confiável e Abrangente:** Oferece mapas detalhados e atualizados de São Paulo.
*   **Funcionalidades Essenciais:** Permite a criação de marcadores customizados (ícones para cada tipo de problema), visualização de informações em janelas (info windows) e a obtenção de coordenadas a partir de cliques no mapa.
*   **Familiaridade do Usuário:** A interface do OpenStreetMap é conhecida, o que reduz a curva de aprendizado para os usuários da nossa plataforma.
*   **Documentação Robusta:** Possui uma vasta documentação e uma grande comunidade de desenvolvedores, facilitando a integração e o desenvolvimento.
