# Houses: Cloudflare Free

API de líderes e pastores em Workers, dados no D1 e arquivos privados no KV. Produção continua no Appwrite até a conferência final. Não habilitar plano pago, R2 ou billing.

## Publicação

No Worker houses-api, adicionar o secret MIGRATION_TOKEN com valor aleatório de pelo menos 32 caracteres. Manter esse secret após a importação: ele também deriva a chave de assinatura dos links privados. Não colocar seu valor em arquivos, screenshots ou mensagens.

No GitHub Actions, adicionar CLOUDFLARE_MIGRATION_TOKEN com exatamente o mesmo valor. APPWRITE_API_KEY já é usado pela infraestrutura existente.

Configurar Cloudflare Builds: diretório raiz `cloudflare`, instalação `npm ci`, publicação `npm run deploy`. Bindings DB e FILES estão configurados em wrangler.jsonc. Habilitar builds somente após configurar os secrets. Não alterar o nome do Worker.

Rodar manualmente o workflow "Importar Houses para Cloudflare". Ele copia os registros, preserva IDs e datas, verifica SHA-256 dos arquivos e compara todos os campos antes de liberar a API. A origem não é alterada. A importação se encerra quando concluída; coordenar uma breve pausa nos registros antes de executar e realizar a troca após testes, para evitar novos dados na origem durante esse intervalo.

Testar líderes com `/?backend=cloudflare` e pastores diretamente em `/admin.html?backend=cloudflare`. A página /pastores/ continua usando o backend padrão. Somente depois da conferência final alterar backend-config.js para backend cloudflare. Há limites do plano gratuito: verificar uso real antes da troca. API limitada a 5.000 registros por coleção e importação atual a 500; ampliar paginação antes de ultrapassar esses limites.

## Verificação local

`npm ci && npm test`. Os testes compilam o Worker e executam workerd com D1 e KV locais, sem tocar dados reais. Verificam rollback de importação, integridade dos arquivos, autenticação, CORS, materiais privados, fotos, respostas pastorais e edição de encontros. Uploads reais de maior tamanho e custo de CPU ainda precisam ser verificados no Worker publicado.
