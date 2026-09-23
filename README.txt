FIRST CANOPY — página única de envio de proposta
Versão final v4 — animação JS/CSS/SVG e nome da equipe editável

ARQUIVOS NA RAIZ
- index.html: página única do formulário
- styles.css: layout responsivo, identidade visual e estados da animação
- app.js: animação da marca, validações, uploads e envio do formulário
- _worker.js: backend do Cloudflare Pages para envio de e-mail
- QA_REPORT.txt: registro dos testes realizados
- assets/: logos e fundo topográfico

LOGO FIRST CANOPY
- A marca principal é exibida como SVG vetorial inline, derivado do asset de referência fornecido no projeto.
- FIRST, a placa creme e as formas das letras CANOPY permanecem vetoriais no navegador.
- Não há CANOPY recriado como texto HTML ou fonte semelhante.
- A animação NÃO usa SMIL, <animate>, GIF, MP4, CDN ou biblioteca externa.
- O disparo é controlado explicitamente por JavaScript após o DOM estar pronto.
- FIRST e a placa creme permanecem estáticos.
- CANOPY é desmontado progressivamente e reconstruído C → A → N → O → P → Y.
- A animação dura aproximadamente 4,5 segundos e roda uma vez por carregamento da página.
- Em caso de erro, a marca completa é restaurada automaticamente.
- Em prefers-reduced-motion: reduce, a animação é pulada e a marca completa é exibida imediatamente.
- assets/first-canopy-logo-vector.svg contém uma cópia vetorial estática da marca.
- assets/first-canopy-logo.png é um fallback raster em alta resolução (1640×648), gerado a partir do vetor para evitar ampliação de um PNG pequeno.

IDENTIDADE VISUAL / FUNDO
- Fundo integral em teal/azul-petróleo.
- assets/topography.svg contém as linhas topográficas orgânicas utilizadas em toda a página.
- Não há grandes círculos radiais ou áreas brancas fora do card.
- A logo oficial do SESI fornecida está em assets/sesi-logo.png e mantém a proporção original.

VALIDAÇÕES DO FORMULÁRIO
- Todos os campos são obrigatórios.
- Nome da equipe é EDITÁVEL e obrigatório.
- Espaços em branco no início/fim são ignorados na validação do nome da equipe.
- Mínimo de 3 e máximo de 10 integrantes.
- Integrantes com apenas espaços não contam como válidos.
- Integrantes adicionais também precisam ser preenchidos ou removidos.
- Telefone obrigatório com DDD.
- E-mail obrigatório e validado.
- Apresentação obrigatória: PDF, PPT ou PPTX, até 5 MB.
- Artes obrigatórias: PDF, PNG, JPG ou JPEG, até 10 MB por arquivo.
- Total de anexos limitado a 25 MB.
- O botão “Enviar proposta” permanece desabilitado até que todos os requisitos estejam válidos.
- O backend repete as validações antes de enviar.

ENVIO DE E-MAIL
Destino principal fixo:
- isabela.lima@senaicni.com.br

Cópia:
- e-mail informado pela equipe no formulário

Reply-To:
- e-mail informado pela equipe

Os arquivos submetidos são encaminhados como anexos.

CONFIGURAÇÃO OBRIGATÓRIA NO CLOUDFLARE
O backend usa a API do Resend. No projeto do Cloudflare Pages, configure:
- RESEND_API_KEY = chave da API do Resend
- FROM_EMAIL = remetente de um domínio verificado no Resend
  Exemplo: FIRST CANOPY <nao-responda@seudominio.com.br>

Depois de configurar as variáveis, faça um novo deploy.

PUBLICAÇÃO NO CLOUDFLARE PAGES
- Faça upload do conteúdo deste ZIP diretamente.
- index.html está diretamente na raiz do ZIP.
- _worker.js também está na raiz para atender /api/submit.
- Todos os caminhos de assets usados no projeto são relativos.
