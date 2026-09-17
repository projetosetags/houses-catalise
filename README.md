# Houses Catalise — Firebase

House Líderes e Houses Pastores compartilham o projeto Firebase `houses-catalise`.
O frontend estático mantém os endereços `index.html`, `admin.html` e `pastores/`.

## Dados e arquivos

| Conteúdo | Local |
|---|---|
| Redes e Houses | Firestore: `networks`, `houses` |
| Usuários e vínculos | Firebase Authentication e Firestore: `users` |
| Reuniões | Firestore: `reports/{houseId}_{AAAA-MM-DD}` |
| Foto única por reunião | Storage: `meetings/{houseId}/{AAAA-MM-DD}/photo.jpg` |
| PDFs e imagens semanais | Storage: `materials/{inicio-da-semana}/{materialId}/original.ext` |
| Metadados dos materiais | Firestore: `materials` |
| Comunicações e cuidado pastoral | Firestore: `communications`, `care` |

Fotos são convertidas para JPEG com até 1600 px, máximo 5 MB. Materiais aceitam PDF,
JPG ou PNG até 20 MB. Nenhum arquivo é convertido em base64 para o Firestore.
Uma reunião usa a mesma chave por House e data: um reenvio atualiza o registro e a
foto existente. Reuniões realizadas exigem foto; adiamentos exigem justificativa.

## Acesso

- Administrador: cadastros, publicação, usuários e acompanhamento geral.
- Pastor: acompanhamento e cuidado das Redes atribuídas.
- Líder: dados e reuniões das Houses atribuídas e materiais destinados a elas.

O ID da House identifica o cadastro; a autenticação usa conta individual.
Tokens antigos na URL não autorizam o novo backend. Perfis são consultados no
servidor a cada chamada. O cliente não pode alterar funções ou seus vínculos.
O administrador cadastra e-mail e vínculos em **Acessos**; o usuário define sua
senha pela opção **Definir ou recuperar senha**. Arquivos são lidos com a sessão
autenticada, sem links públicos permanentes.

## Implantação

1. Ativar Blaze e vincular faturamento para Storage e Functions.
2. Criar Firestore em modo nativo/produção, registrar o app web e habilitar
   Authentication por e-mail/senha. Incluir `projetosetags.github.io` nos domínios
   autorizados. Colocar somente a configuração pública em `firebase-config.js`.
3. Criar o bucket padrão e configurar CORS com `firebase/storage-cors.json`.
4. Em ambiente autenticado no projeto:

   ```sh
   npm ci
   npm ci --prefix functions
   npm test
   npm run check
   firebase deploy --project houses-catalise --only firestore,storage,functions
   gcloud storage buckets update gs://houses-catalise.firebasestorage.app --cors-file=firebase/storage-cors.json
   ```

5. Definir `HOUSES_PROJECT_ID`, `HOUSES_ADMIN_EMAIL` e, quando disponível,
   `HOUSES_SEED_FILE` com os cadastros conferidos. Rodar `node scripts/seed.cjs`.
   A carga é idempotente e não importa registros de teste nem credenciais antigas.
   Sem arquivo de carga, cria apenas Redes 01 a 04. A carga privada foi reconstruída
   a partir do PDF oficial de identificação da Rede 04 (treinamento de 09/09/2026),
   com 25 Houses e seus IDs e líderes. Não é uma exportação do banco anterior e não
   inclui e-mails, endereços nem reuniões. O arquivo fica fora do repositório público.
6. Publicar o frontend somente depois de testar o backend. Para Firebase Hosting,
   executar `npm run build:hosting` e `firebase deploy --only hosting`.

Não publicar chaves de serviço nem exportações privadas no GitHub ou no frontend.
Fotos não são apagadas automaticamente por idade. Materiais excluídos são
arquivados logicamente e ficam inacessíveis pelo aplicativo.

## Testes

`npm test` verifica escopos de acesso e invariantes das reuniões. `npm run check`
verifica sintaxe e referências. Testes reais das regras usam os emuladores
Firestore/Storage e exigem Java 21 ou superior:

```sh
firebase emulators:exec --project demo-houses --only firestore,storage "node --test test/rules.integration.cjs"
```

O frontend conserva recursos de materiais por semana, personalização de PDFs,
endereços, redes, relatórios, semáforo e cuidado pastoral.

## Situação da preparação em 17/09/2026

- Projeto `houses-catalise`, app web e Firestore em São Paulo criados; login
  por e-mail e senha habilitado no Firebase Authentication.
- Domínio `projetosetags.github.io` autorizado no Firebase Authentication.
- Redes 01 a 04 cadastradas no Firestore. A carga das 25 Houses está preparada.
- Migração de código e testes locais concluídos; não publicados em produção.
- Storage e Functions aguardam ativação do plano Blaze. A seleção do plano foi
  bloqueada pela revisão automática por exigir autorização explícita de cobrança;
  o projeto permanece no Spark.
- A conexão do GitHub foi corrigida para a conta `projetosetags`, com acesso
  de escrita confirmado ao repositório `projetosetags/houses-catalise`.

As regras testadas, o backend, os perfis de acesso e os arquivos precisam ser
implantados antes da troca do frontend. Não tratar esta preparação como sistema
em produção.
