# Instaladores dos drivers de controle

Os `.exe` desta pasta **não** ficam no git. Rode `npm run drivers:fetch` antes de
gerar o instalador: ele baixa ViGEmBus e HidHide nas versões fixadas em
`scripts/drivers.manifest.json` e confere o SHA-256.

Este README existe só para o glob `windows/drivers/*` do bundle sempre ter algo
a casar; sem os `.exe` o hook do NSIS apenas pula a instalação dos drivers.
