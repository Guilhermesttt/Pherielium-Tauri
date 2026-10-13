# Do que o Discord faz bem para dentro do hub: roteiro

Base: mapa de chamadas, grupos, transmissão, chat e rede (`docs/ARCHITECTURE.md` e a análise de 2026-10-13) e a leitura estática do app desktop do Discord (só a casca: o cliente web não está no disco).
Regra do projeto: uma fatia por vez, atrás de flag quando muda comportamento, com teste e commit atômico. Nada abaixo "se aplica sozinho": cada item precisa do seu OK.

## Feito nesta rodada
| Item | O que o Discord faz | O que o hub fazia | Agora |
| --- | --- | --- | --- |
| **R1. Saúde da conexão da chamada** | Mostra "reconectando", avisa conexão ruim e encerra com motivo claro | A sala do LiveKit só reagia a faixas e participantes; queda no meio da chamada não aparecia e a chamada podia ficar "ativa" sem som (`useVoiceCall.ts`, 5 eventos registrados) | `Reconnecting` e `Reconnected` ligam o banner "reconectando"; `ConnectionQualityChanged` (meu enlace) liga o aviso "conexão ruim"; `Disconnected` com motivo diferente de "eu desliguei" encerra a chamada com mensagem específica (`livekitHealth.ts`, testado) |

## Próximas fatias sugeridas (ordem por valor e risco)
| # | Fatia | Por quê | Esforço | Depende de |
| --- | --- | --- | --- | --- |
| R2 | **Religar automaticamente** a sala depois de queda definitiva (o app já guarda a última sessão em `checkpoint_last_voice_session`) | O Discord volta sozinho para o canal; o hub hoje só oferece religar depois de reiniciar | 1 dia | R1 |
| R3 | **Qualidade por participante** (ping e barras), usando `ConnectionQualityChanged` remoto e o RTT já medido a cada 2 s (`mediaStats.ts`) | Ajuda a saber quem está com a conexão ruim | 0,5 a 1 dia | R1 |
| R4 | **Convite com cartão que expira e pode ser reenviado** (já existe local, falta autoridade do servidor) | É o fluxo de convites do Discord | bloqueado | schema + API (I) |
| R5 | **Canais de voz privados salvos** (como canais persistentes do Discord) | Entrar de novo sem convite novo | bloqueado | schema + API (R) |
| R6 | **Qualidade "Fonte"** na transmissão (a opção existe no tipo `ScreenShareOptions` mas o perfil a ignora) e presets nomeados | Paridade com o "Go Live" | 0,5 dia | medição de fps/bitrate |
| R7 | **Quem está assistindo** a minha transmissão e miniatura/prévia | Recurso do "Go Live" | 1 a 2 dias | R1 |
| R8 | **Sinalização por canal privado** (hoje público) | Segurança; o Discord não confia no remetente do payload | grande | A2 (ADR-0001) |

Itens do Discord que **o hub já tem** (verificados no código): volume por usuário e mute independente, supressão de ruído, push-to-talk (`pushToTalkKey`), edição/apagar/reação/resposta em mensagens, recibo de leitura, "digitando", presença, overlay no jogo, transmissão com áudio do PC e qualidade/fps/bitrate selecionáveis.
Itens **não verificados** (podem existir): texto em grupo/threads, soundboard, clipes. Dizer se interessam antes de eu investigar.

## Como testar R1
1. Entre numa chamada. Desligue o Wi-Fi por ~5 s e religue: o banner deve mostrar "reconectando" e voltar sozinho.
2. Limite a rede (ou use um perfil de rede ruim no Windows): o banner deve mostrar "conexão ruim".
3. Mantenha a rede fora por 1 a 2 min: a chamada deve encerrar com "A conexão com o servidor de voz foi perdida." (ou o motivo específico do servidor).
4. Desligar a chamada normalmente **não** deve mostrar mensagem de erro.
