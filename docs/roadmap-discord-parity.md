# Do que o Discord faz bem para dentro do hub: roteiro

Base: mapa de chamadas, grupos, transmissão, chat e rede (`docs/ARCHITECTURE.md` e a análise de 2026-10-13) e a leitura estática do app desktop do Discord (só a casca: o cliente web não está no disco).
Regra do projeto: uma fatia por vez, atrás de flag quando muda comportamento, com teste e commit atômico. Nada abaixo "se aplica sozinho": cada item precisa do seu OK.

## Feito nesta rodada
| Item | O que o Discord faz | O que o hub fazia | Agora |
| --- | --- | --- | --- |
| **R1. Saúde da conexão da chamada** | Mostra "reconectando", avisa conexão ruim e encerra com motivo claro | A sala do LiveKit só reagia a faixas e participantes; queda no meio da chamada não aparecia e a chamada podia ficar "ativa" sem som (`useVoiceCall.ts`, 5 eventos registrados) | `Reconnecting` e `Reconnected` ligam o banner "reconectando"; `ConnectionQualityChanged` (meu enlace) liga o aviso "conexão ruim"; `Disconnected` com motivo diferente de "eu desliguei" encerra a chamada com mensagem específica (`livekitHealth.ts`, testado) |
| **R2. Religar sozinho** | O Discord volta para o canal depois de uma queda | Depois da queda definitiva o app só avisava | `Disconnected` por rede ou servidor tenta religar a mesma sala 3 vezes (2 s, 5 s, 10 s), reaproveitando o microfone; se falhar, encerra com a mensagem. Motivos deliberados (removido, sala fechada, outro dispositivo) não tentam |
| **R3. Qualidade por participante** | Barras de conexão por pessoa | Nada | Cada cartão de participante mostra um aviso quando a conexão dele está ruim ou perdida (`ConnectionQualityChanged` remoto); o meu cartão usa o meu enlace |
| **R6. Qualidade "Fonte"** | "Go Live" até a resolução da tela | A opção existia no tipo e era ignorada | Terceira opção "Fonte" no modal: pede o tamanho nativo da tela até 4K, com bitrate padrão de 16 Mbps (30 fps) ou 20 Mbps (60 fps) |
| **R7. Quem assiste** | Mostra quantos assistem à live | Nada | Quem vê a tela de alguém avisa (`call:state.isWatchingScreen`); no cartão de quem transmite aparece "Transmitindo · N pessoas assistindo". Miniatura/prévia: **não feita** |

## Não aplicadas (dependem de outra coisa)
| # | Fatia | Bloqueio |
| --- | --- | --- |
| R4 | Convite com autoridade do servidor (expira, reenvia) | schema do Supabase e código da API (I) |
| R5 | Canais de voz privados salvos | schema e API (R) |
| R8 | Sinalização por canal privado | A2 (ADR-0001), exige staging e janela de corte; risco alto para quem está na 1.0.2 |

Itens do Discord que **o hub já tem** (verificados no código): volume por usuário e mute independente, supressão de ruído, push-to-talk (`pushToTalkKey`), edição/apagar/reação/resposta em mensagens, recibo de leitura, "digitando", presença, overlay no jogo, transmissão com áudio do PC e qualidade/fps/bitrate selecionáveis.
Itens **não verificados** (podem existir): texto em grupo/threads, soundboard, clipes. Dizer se interessam antes de eu investigar.

## Como testar R1
1. Entre numa chamada. Desligue o Wi-Fi por ~5 s e religue: o banner deve mostrar "reconectando" e voltar sozinho.
2. Limite a rede (ou use um perfil de rede ruim no Windows): o banner deve mostrar "conexão ruim".
3. Mantenha a rede fora por 1 a 2 min: a chamada deve encerrar com "A conexão com o servidor de voz foi perdida." (ou o motivo específico do servidor).
4. Desligar a chamada normalmente **não** deve mostrar mensagem de erro.

## Como testar R2 a R7 (dois PCs, rc.6)
- **R2:** em uma chamada de sala, desligue a internet de um PC por ~1 min. Esperado: "reconectando"; ao voltar a rede em até ~17 s, a chamada volta sozinha ("Reconectado à chamada.") e o microfone funciona. Se ficar fora mais tempo: encerra com "A conexão com o servidor de voz foi perdida." Desligar a chamada durante as tentativas as cancela.
- **R3:** com a rede de um participante degradada (limite de banda), o cartão dele mostra um ícone de Wi-Fi cortado (amarelo = ruim, vermelho = sem conexão), com o texto no balão ao passar o mouse.
- **R6:** no modal "Compartilhar tela", escolha **Fonte** e 60 fps; ao transmitir, o resumo de `pherielium_stream_debug` deve mostrar largura/altura da tela (até 3840x2160) e bitrate perto de 20 Mbps (com Auto).
- **R7:** A transmite a tela; B abre a chamada e foca a tela de A. Em A o cartão "Transmitindo" passa a dizer "· 1 pessoa assistindo". B fecha a janela ou desfoca a tela: o contador volta a zero.
