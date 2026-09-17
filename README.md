# Houses Catalise — Appwrite Free

House Líderes e Houses Pastores usam a mesma API, com a interface existente e
acesso individual. O novo backend usa Appwrite Auth, TablesDB, Storage e Functions.
O frontend permanece preparado para o GitHub Pages deste repositório.

**Situação em 17/09/2026:** migração de código preparada e testada localmente.
O projeto Appwrite ainda não foi criado: aguarda a conclusão do acesso seguro
à conta para provisionamento. Este PR permanece em rascunho. Não integrar à `main` até configurar
o projeto real e validar login, publicação de PDF e registro de foto.
`appwrite-config.js` permanece vazio intencionalmente até esse provisionamento.

## Organização dos dados e arquivos

| Conteúdo | Local no Appwrite |
|---|---|
| Redes e Houses | Banco `houses`, tabelas `networks` e `houses` |
| Contas e permissões | Auth e tabela privada `users` |
| Reunião por House e data | `reports`, chave `0119_2026-09-17` |
| Foto da reunião | Bucket privado `house-files`, pasta `meetings/{house}/{data}` |
| PDFs e imagens semanais | Mesmo bucket, pasta `materials/{semana}/{material}` |
| Informações dos materiais | Tabela `materials` |
| Comunicações e cuidado pastoral | `communications` e `care` |
| Envios em andamento | `uploads`; partes temporárias em `uploads/{id}/{geração}` |
| Controle de gravações simultâneas | Tabela privada `locks` |

Os arquivos binários ficam no Storage; o banco guarda metadados. Uma reunião
realizada exige uma foto. Fotos são reduzidas no aparelho para JPEG de até
1600 pixels, com limite de 5 MB. Materiais aceitam PDF, JPG e PNG de até 20 MB.
O envio usa partes de 512 KB e confere tamanho, assinatura do formato e SHA-256.
A finalização de arquivos maiores ocorre em segundo plano para respeitar o
limite de 30 segundos das chamadas síncronas do Appwrite.

Corrigir a mesma House/data mantém um registro. A foto anterior só é removida
após salvar a substituta. A função `houses-cleanup`, sem acesso de clientes,
limpa envios vencidos a cada seis horas, até 20 por execução. Ela preserva os
arquivos vinculados a registros. Nenhuma foto histórica é apagada por idade;
excluir um material no painel apenas o arquiva.

## Acesso

- Administrador: cadastros, materiais, comunicações, usuários e acompanhamento.
- Pastor: acompanhamento e cuidado das Redes atribuídas.
- Líder: reuniões e dados das Houses atribuídas, com materiais do seu público.

O ID da House identifica o cadastro; não substitui e-mail e senha. Cada chamada
valida a sessão/JWT e consulta o perfil ativo. Clientes não têm permissão direta
nas tabelas nem no bucket. Somente a função autorizada escreve no banco ou envia
arquivos. A leitura recebe um link de arquivo válido por cinco minutos, após
verificação do público. Um link já emitido pode funcionar até expirar.

O administrador cadastra os e-mails em **Acessos**. Cada pessoa define a senha
pela opção **Definir ou recuperar senha**. Não há senha compartilhada ou chave
administrativa no frontend. A página `recuperar.html` remove o segredo da URL do
histórico e não carrega scripts de terceiros. O SDK Appwrite 27.0.0 está incluído
localmente, com sua licença, em `assets/vendor`.

Desativar download remove/bloqueia a ação de baixar pelo aplicativo. Como em
qualquer visualizador web, permitir visualizar entrega os bytes ao navegador;
essa opção não constitui proteção contra cópia.

## Provisionamento automático

Requer um projeto Appwrite Cloud na organização **Free**, sem upgrade de plano.
Após autenticar e criar esse projeto, configure uma chave temporária de servidor
no ambiente seguro. Nunca coloque essa chave no GitHub nem em mensagens públicas.
A chave de provisionamento precisa dos escopos de leitura/gravação de projeto,
plataformas, bancos, tabelas, colunas, índices, linhas, buckets, arquivos, usuários,
funções e execuções, além de `sessions.write` e `tokens.write`.
Os escopos das chaves dinâmicas das funções são reduzidos pelo instalador.

1. Instalar dependências com `npm ci` e `npm ci --prefix functions`.
2. Criar `.env` a partir de `.env.example` e preencher endpoint regional, ID do
   projeto, chave temporária e e-mail/nome do administrador.
3. Manter a carga conferida em `private/seed.local.json` e definir
   `HOUSES_SEED_FILE` para esse caminho. A carga preparada contém as 25 Houses da
   Rede 04, seus IDs e líderes, conferidos no PDF de treinamento de 09/09/2026.
   Ela fica fora do repositório público. Não inventa e-mails, endereços ou reuniões.
4. Executar `npm run provision:appwrite`.

O comando habilita e-mail/senha e JWT, cadastra `projetosetags.github.io`, cria um
banco serverless, tabelas e índices privados, um bucket e duas funções. Cria as
Redes 01–04, importa as Houses sem sobrescrever cadastros existentes e cria o
perfil do proprietário sem senha predefinida. Publica API e limpeza e escreve
apenas os identificadores públicos em `appwrite-config.js`.

Não altera faturamento, não cria banco dedicado e não habilita plano pago.
Depois de validar o projeto real, revogue a chave temporária; as funções usam
chaves dinâmicas fornecidas pelo Appwrite. Publique a configuração pública e o
frontend somente após concluir os testes abaixo. O projeto gratuito anterior
não é alterado por estes scripts.

## Validação

```sh
npm test
npm run check
npm run build:hosting
```

Os testes locais verificam papéis, isolamento de Houses/Redes, foto obrigatória,
correção sem duplicidade, envio em partes, integridade, público dos PDFs,
arquivamento, limpeza e os controladores dos dois painéis. Os testes de API usam
adaptadores em memória; ainda não comprovam comportamento do Appwrite Cloud.
A checagem automática do GitHub executa os mesmos comandos em Node 22.

Antes da troca do site, testar no Appwrite real: primeiro acesso do proprietário;
conta de líder com uma House; bloqueio de outra House; PDF publicado e baixado;
foto enviada, visualizada e substituída; recuperação de senha e conta desativada.
Verificar também que chamadas diretas ao banco e ao bucket são negadas.
O build em `dist/` exclui backend, scripts, testes e dados privados.

## Limites do plano gratuito

A solução usa um banco, um bucket e duas funções. Em 17/09/2026, o Free oferece
2 GB de armazenamento e 5 GB/mês de tráfego, compartilhados na organização.
Há limites de execuções, leituras e gravações; o serviço pode ser pausado após
uma semana de inatividade. Ao atingir cotas, o Free pode bloquear operações;
não há contratação automática de plano pago neste projeto. A redução de fotos
ajuda a economizar espaço, mas o armazenamento não é ilimitado.

Fontes oficiais: [planos](https://appwrite.io/pricing),
[limites do Free](https://appwrite.io/docs/advanced/billing/free),
[execuções](https://appwrite.io/docs/products/functions/execute) e
[tokens de arquivo](https://appwrite.io/docs/products/storage/file-tokens).
