# Pherielium 1.0.3

## Visual novo
- O hub inteiro foi redesenhado. As superfícies se separam por tom, sem bordas, sombras ou vidro, e os botões e controles viraram pílulas. O texto nunca fica abaixo de 13 px, e o movimento usa uma mola suave.
- Telas novas: Login, Configurações, Troféus, Mods, a barra do topo e os cartões da Biblioteca, além do modal de transmissão.
- As fontes vêm embutidas no app, então a abertura não depende mais de rede para baixá-las.
- A legenda do controle no rodapé ficou legível.

## Chamadas e transmissão
- Se a internet cair, a chamada avisa que está reconectando e volta para a sala sozinha.
- Cada participante mostra um aviso quando a conexão dele está ruim.
- Na transmissão você escolhe a qualidade (720p, 1080p ou Fonte, até 4K), os 30 ou 60 quadros e o bitrate, e vê quantas pessoas estão assistindo.
- O áudio do PC sai sem a voz da chamada voltar em eco, e o volume de voz e o da transmissão são independentes.

## Convites e notificações
- Ligar ou convidar para uma sala chega como convite, com notificação no notch e no jogo, em vez de tocar como ligação.
- As prévias de mensagens de convite são legíveis em todos os lugares.
- O notch deixa escolher quais avisos aparecem e por quanto tempo.

## Mods e troféus
- Mods: o filtro por categoria funciona, há mais filtros e ordens, e os filtros são lembrados entre aberturas.
- Troféus: raridade desconhecida não vira mais platina, e os detalhes usam conquistas da Steam de no máximo 60 segundos atrás.

## Segurança
- A janela do app não tem mais permissão de executar programas nem de ler e escrever qualquer arquivo. Ela nunca usou essas permissões; o acesso a arquivos passa por comandos internos verificados.
- O sanitizador de HTML (DOMPurify) foi atualizado.
- Os drivers de controle que vão no instalador têm a assinatura digital e o SHA-256 conferidos quando o instalador é gerado.
- Detalhes em [security-review-1.0.3.md](security-review-1.0.3.md).

## Para quem testou a 1.0.3-rc
O verificador de atualização trata `1.0.3-rc.N` como `1.0.3`, então quem tem um rc instalado **não recebe o aviso**. Desinstale o rc e instale a 1.0.3 manualmente. Quem está na 1.0.2 é avisado normalmente.
