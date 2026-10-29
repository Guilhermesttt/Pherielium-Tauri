# Third-party notices

## bloub

- Source: https://github.com/jeremy-prt/bloub
- License: MIT — Copyright (c) 2026 Jérémy Perret (full text in `src/mascot/engine/LICENSE`)
- Used in: `src/mascot/engine/` (animation engine — body morphing, eye projection, expressions, gaze).
  The files are vendored unchanged except for import paths and a license header.

The MIT license covers the code only. bloub is not affiliated with x.ai; the Pherielium
mascot ("Pherie") uses its own body shape, colors, accessories and extra states
(`src/mascot/pherieStates.ts`) on top of the engine.

## ViGEmBus

- Source: https://github.com/nefarius/ViGEmBus
- Version: 1.22.0 (final release; the upstream repository is archived)
- License: BSD-3-Clause
- Used in: the Windows installer. The unmodified, Authenticode-signed installer is bundled and run
  only when the driver is not already present, so the controller profile feature can present a
  virtual Xbox 360 controller and hide the physical one from games. It is never removed on uninstall.

```
BSD 3-Clause License

Copyright (c) 2016-2020, Nefarius Software Solutions e.U.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## HidHide

- Source: https://github.com/nefarius/HidHide
- Version: 1.5.230.0
- License: MIT
- Used in: the Windows installer. The unmodified, Authenticode-signed installer is bundled and run
  only when the driver is not already present, so the controller profile feature can present a
  virtual Xbox 360 controller and hide the physical one from games. It is never removed on uninstall.

```
MIT License

Copyright (c) 2020 Eric Korff de Gidts
Copyright (c) 2021-2024 Benjamin Höglinger-Stelzer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Coucou

- Source: https://github.com/Louis-CFM/coucou (`windows/`)
- License: MIT — Copyright (c) 2026 Louis Raillé
- Used in: o movimento do notch e a lógica de tema do notch (`src/components/notch/DesktopNotch.tsx`,
  `src/mascot/motion.ts`, `src/mascot/notchTheme.ts`), adaptados do frontend de referência.
  Não foram copiados o personagem Mochi, o nome Coucou, ícones, sons nem capturas (fora da MIT).

```
MIT License

Copyright (c) 2026 Louis Raillé

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
