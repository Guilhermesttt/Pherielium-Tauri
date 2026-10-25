# Instalação automática de mods (Nexus)

Do clique em **Instalar** até os arquivos na pasta do jogo, sem a pessoa abrir pasta nenhuma, e
sem deixar o jogo pior do que estava.

Código: `src-tauri/src/commands/nexus_download.rs` (download e pedidos da tela),
`src-tauri/src/commands/mod_install.rs` (a instalação em si), `src/services/nexusFiles.ts`
(qual arquivo instalar) e `src/components/mods/ModGameDetailPanel.tsx` (tela).

## Qual arquivo é instalado

A Nexus lista todos os arquivos de um mod (principal, atualizações, opcionais e versões antigas).
O botão **Instalar** pega o **principal mais recente**:

1. o arquivo marcado como principal pela Nexus;
2. senão, o `MAIN`/`UPDATE` mais novo;
3. senão, o mais novo que não seja `OLD_VERSION`.

Opcionais ficam em "Outros arquivos" e versões antigas em "Versões antigas", ambos recolhidos.

## O caminho do download

| Conta | O que acontece |
|---|---|
| **Premium** | A API devolve o link direto. O download começa ao clicar, sem abrir o site. |
| **Grátis** | A Nexus só entrega o link a quem clica em *Download lento* no site, que abre um link `nxm://`. O Pherielium recebe esse link e segue sozinho. |

O Pherielium só vira o programa que abre `nxm://` quando a pessoa clica em **Ativar instalação
automática**. Isso é opt-in porque tira os links da Nexus de outro gerenciador (Vortex, Mod
Organizer). O botão fica na tela de mods e só aparece para conta grátis ainda sem o protocolo.

Fluxo: `prepare` (registra o pedido, 15 min de validade) → site da Nexus → `nxm://` → API
`download_link.json` → download com progresso → instalação → estado `completed`.

## Como o mod entra na pasta do jogo

1. **Preparo.** O arquivo (ZIP ou 7z) é extraído para uma pasta temporária. Se estiver corrompido
   ou truncado, o jogo nem é tocado. ZIP e 7z passam pelo **mesmo** caminho de extração e pelas
   mesmas proteções; só muda como as entradas são enumeradas.
2. **Onde cada arquivo vai.**
   - Uma única pasta de embrulho (`MeuMod-1.2/`) que o jogo **não** tem é descartada.
   - Se o jogo já tem uma pasta com esse nome (`Data/`, `bin/`), ela é a estrutura do mod e fica.
   - Plugins soltos na raiz (`.esp`, `.esm`, `.esl`, `.bsa`, `.ba2`) vão para a pasta `Data` do jogo, se ela existir.
   - Nos demais casos, a estrutura do ZIP é preservada a partir da raiz do jogo.
3. **Backup.** Tudo o que seria sobrescrito é copiado para `…\Pherielium\mod-backups\<jogo>-<mod>\`.
4. **Cópia atômica.** Cada arquivo vai para um nome temporário e só então é renomeado.
5. **Manifesto.** `…\Pherielium\mod-manifests\<jogo>-<mod>.json` registra cada arquivo (com SHA-256),
   o backup e as pastas criadas.
6. **Se algo falhar no meio**, tudo o que já foi feito é desfeito (backups restaurados, arquivos
   criados removidos).

**Remover** faz o caminho inverso: restaura os originais, apaga o que o mod criou e as pastas que
ele criou (se vazias). Um arquivo que mudou depois da instalação (outro mod, atualização do jogo)
**não é tocado**; a remoção só avisa quantos foram pulados.

**Atualizar** um mod (outra versão do mesmo mod) desfaz a instalação anterior antes de instalar a
nova, para não acumular cópias nem perder o original.

## O que é recusado

- Caminhos com `..`, absolutos, com unidade (`C:`) ou atalhos dentro do arquivo (zip-slip). No 7z,
  atalhos são reconhecidos tanto pelo atributo de *reparse point* do Windows quanto pelo modo Unix
  de symlink (o que o p7zip grava).
- Destinos que saem da pasta do jogo, inclusive por atalho (junction) já existente no caminho.
- Mais de 20 000 arquivos ou mais de 10 GiB extraídos. Conta o que realmente sai do arquivo, não o
  tamanho declarado. No 7z o cabeçalho é conferido **antes** de descomprimir, então uma bomba de
  descompressão é recusada sem gastar disco nem tempo.
- Arquivo 7z com senha (não suportado, em vez de tentar e falhar no meio).
- Pasta do jogo que seja a raiz do disco, a pasta do Windows ou o perfil inteiro do usuário.
- Download fora de HTTPS em `nexusmods.com` / `nexus-cdn.com`, ou com tamanho diferente do anunciado.
- Arquivo ou manifesto fora das pastas do Pherielium (o front não consegue apontar para qualquer lugar do disco).

## Limites conhecidos

- **ZIP e 7z são instalados automaticamente.** O 7z cobre LZMA, LZMA2, BZip2, PPMd e Deflate (o que
  a Nexus usa na prática); métodos raros (zstd, brotli) e arquivos com senha são recusados com mensagem.
- **`.rar` não é instalado automaticamente**, de propósito: o arquivo é baixado e a tela explica
  como extrair com o 7-Zip ou o WinRAR. Motivos:
  - o decodificador RAR de referência (`unrar`) tem licença própria, que não é de código aberto
    livre, e é código C++ embutido no build;
  - as bibliotecas puras em Rust são recentes e **não dá para testá-las aqui**: criar arquivos RAR
    de teste exige o WinRAR, que é proprietário. Um decodificador que erra em silêncio corromperia o
    jogo, que é exatamente o que este recurso existe para evitar.
  Quando houver uma biblioteca madura e testável, o `stage_archive` já tem o ponto de entrada.
- A regra de "onde vai cada arquivo" é uma heurística (ver acima). Mods de jogos com estrutura própria
  que não seja a do ZIP podem exigir instalação manual; o backup e o manifesto permitem desfazer.
- A integração com `nxm://` e com a Nexus real **não foi testada com contas reais**; o que está
  coberto por testes automáticos é o motor de instalação, a leitura dos links e a segurança.
- O registro do protocolo fica no usuário (`HKCU`) e não é removido ao desinstalar o app.

## Como testar à mão

1. Conecte a chave da Nexus em *Mods* e escolha a pasta do jogo.
2. Escolha um mod pequeno em ZIP e clique em **Instalar** (conta grátis: ative a instalação
   automática e clique em *Download lento* na página que abrir).
3. Confira os arquivos na pasta do jogo e o manifesto em `…\Pherielium\mod-manifests\`.
4. Remova o mod e confira que a pasta do jogo voltou ao que era.
