# Protótipo de seleção e transmissão de tela no Windows

## Objetivo

Permitir que uma pessoa escolha uma tela ou janela dentro da interface do Pherielium e publique essa fonte na chamada LiveKit sem abrir o seletor nativo do WebView2/Windows.

O protótipo deve validar o fluxo completo usando a conexão LiveKit JavaScript já existente. Ele prioriza funcionamento previsível e ciclo de vida correto; 1080p/60 FPS e captura nativa direta pelo SDK Rust do LiveKit ficam fora desta etapa.

## Escopo

O protótipo será exclusivo para Windows 10 e Windows 11 e incluirá:

- listagem de monitores e janelas capturáveis;
- miniaturas no seletor personalizado existente;
- seleção obrigatória de uma fonte;
- captura nativa da fonte selecionada;
- criação de uma `MediaStreamTrack` de vídeo no WebView;
- publicação dessa track como `ScreenShare` na sala LiveKit já conectada;
- áudio do sistema como recurso opcional e não bloqueante;
- encerramento seguro da captura e possibilidade de iniciar uma nova transmissão.

Não fazem parte deste protótipo:

- suporte a macOS ou Linux;
- publicação direta pelo SDK Rust do LiveKit;
- criação ou alteração do backend de tokens LiveKit;
- garantia de 1080p/60 FPS;
- captura de conteúdo protegido por DRM;
- substituição completa do transporte de áudio da chamada.

## Arquitetura

### Seletor React

`ScreenPickerModal` obtém as fontes pela ponte Tauri e separa monitores de janelas. Uma fonte válida deve estar selecionada antes de habilitar o botão de transmissão.

O seletor não oferecerá um fallback que chame `getDisplayMedia`. Se a listagem falhar ou ficar vazia, a interface mostrará o erro e permitirá atualizar a lista.

Para manter o protótipo compatível com o transporte de frames escolhido, a interface oferecerá inicialmente 720p e 30 FPS. Opções que sugiram 1080p/60 FPS não serão exibidas como funcionais nesta etapa.

### Captura Rust

O comando Tauri recebe um identificador no formato `screen:<índice>` ou `window:<HWND>`, valida que ele ainda existe e inicia uma geração de captura.

No protótipo, a implementação existente baseada em GDI produz frames limitados a 1280×720 e 30 FPS. Cada frame é codificado em JPEG e emitido para o WebView. Esse caminho é deliberadamente temporário: ele permite validar o seletor e a integração LiveKit sem introduzir uma segunda conexão ou exigir mudanças no backend.

A captura usa um número de geração para que threads antigas parem quando uma transmissão é encerrada ou substituída. Erros consecutivos de captura devem encerrar a sessão e notificar a interface, em vez de manter uma thread em loop indefinidamente.

### Track no WebView

`createTauriScreenCaptureStream` mantém apenas o frame mais recente, decodifica-o e desenha em um canvas. `canvas.captureStream(30)` fornece a track publicada pelo LiveKit.

O início só é considerado bem-sucedido depois do primeiro frame válido. Um timeout encerra a captura e remove todos os listeners. Frames recebidos durante uma decodificação em andamento podem substituir o frame pendente; eles não devem formar uma fila crescente.

### Publicação LiveKit

`startScreenShare` exige `sourceId` e não chama `navigator.mediaDevices.getDisplayMedia`. A track do canvas é publicada pela instância LiveKit JavaScript já conectada, com `source: ScreenShare`, H.264 e parâmetros adequados ao perfil 720p/30.

O estado `isSharingScreen` só muda para verdadeiro depois da publicação bem-sucedida. Se a publicação falhar, captura, tracks, áudio e listeners são encerrados antes de exibir o erro.

O fluxo P2P existente continuará recebendo a mesma `MediaStreamTrack` quando o LiveKit não for o transporte primário.

### Áudio do sistema

Quando solicitado, o loopback WASAPI existente continuará sendo iniciado como melhor esforço. Os blocos PCM podem alimentar uma track criada com Web Audio.

Falha na captura ou publicação do áudio não cancela o vídeo. A interface informa que a transmissão continuará sem áudio. A barreira de áudio da chamada continuará opcional.

## Ciclo de vida e erros

O encerramento deve ser idempotente porque pode ser acionado pelo botão, pelo fim da track ou por uma falha de publicação ao mesmo tempo.

Ao parar, o sistema deve:

1. despublicar as tracks de tela e áudio;
2. remover senders P2P quando aplicável;
3. invalidar a geração de captura Rust;
4. remover listeners de frame e áudio;
5. fechar o `AudioContext` criado para loopback;
6. parar todas as `MediaStreamTrack`s locais;
7. limpar referências e estado da interface.

Erros serão apresentados em três categorias: fonte indisponível, falha de captura e falha de publicação. Mensagens técnicas permanecem no console; a interface recebe texto curto em português.

## Segurança e privacidade

O aplicativo só inicia a captura depois de uma seleção e confirmação explícitas. Nenhum segredo do LiveKit será usado pelo Rust ou incorporado no binário. O protótipo reutiliza apenas a sessão LiveKit autenticada que já existe no WebView.

## Verificação

A validação automatizada inclui:

- `npm run typecheck`;
- `npm run build`;
- `cargo check --manifest-path src-tauri/Cargo.toml`;
- testes unitários dos helpers de seleção/ciclo de vida quando a estrutura atual permitir isolamento sem acoplar DOM ou Tauri real.

A validação manual no Windows 10/11 cobre:

- listar e atualizar monitores;
- listar e atualizar janelas;
- transmitir um monitor sem abrir o seletor nativo;
- transmitir uma janela sem abrir o seletor nativo;
- confirmar vídeo remoto na chamada LiveKit;
- parar pelo botão e iniciar novamente;
- fechar a janela capturada durante a transmissão;
- continuar com vídeo quando o loopback WASAPI falhar;
- sair da chamada durante uma transmissão ativa.

## Critérios de aceitação

O protótipo será considerado concluído quando:

- nenhuma ação normal de compartilhamento chamar `getDisplayMedia`;
- o item escolhido no modal for a fonte efetivamente transmitida;
- o participante remoto receber uma track marcada como compartilhamento de tela;
- a transmissão puder ser parada e reiniciada sem listeners, threads ou tracks órfãos;
- falhas de áudio não interromperem o vídeo;
- TypeScript, build do frontend e `cargo check` passarem.

