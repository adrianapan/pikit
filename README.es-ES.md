

<img alt="banner" src="https://github.com/user-attachments/assets/3c0eb2a6-fce9-4c39-8943-d348ce1bc284" />

<h3 align="center">Pikit — una configuración con opiniones propias para el agente de codificación Pi. Con todo incluido.</h3>

<p align="center">
  <a href="#whats-in-here">Contenido</a> &nbsp;·&nbsp;
  <a href="#install">Instalación</a> &nbsp;·&nbsp;
  <a href="#extensions">Extensiones</a> &nbsp;·&nbsp;
  <a href="#skills">Habilidades</a> &nbsp;·&nbsp;
  <a href="#prompt-templates">Plantillas de prompts</a> &nbsp;·&nbsp;
  <a href="#theme">Tema</a> &nbsp;·&nbsp;
  <a href="#configs">Configuraciones</a>
  
</p>

---

## Contenido

```
agent/
├── configs/
│   ├── caveman.json             # Nivel predeterminado Caveman — ignorado por git, se crea automáticamente en el primer uso
│   ├── chat-mode.json           # Configuración del modo chat (versionado)
│   ├── plan-mode.json           # Configuración del modo planificación (versionado)
│   ├── footer.json              # Configuración del segmento del pie de página — ignorado por git, consulta footer/footer.example.json
│   ├── mcp.json                 # Configuración del servidor MCP — ignorado por git, consulta mcp/mcp.example.json
│   ├── permission-gate.json     # Patrones de puerta de permiso — ignorado por git, consulta permission-gate.example.json
│   ├── protected-paths.json     # Entradas de rutas protegidas — ignorado por git, consulta protected-paths.example.json
│   └── .env                     # Variables de entorno secretas — ignorado por git, consulta env-loader/.env.example
├── APPEND_SYSTEM.md             # Directrices de codificación adjuntas al prompt del sistema en cada sesión
├── settings.example.json        # Configuraciones con opiniones propias para Pi — copia a settings.json (ignorado por git)
├── skills/
│   ├── pi-extension-builder/    # Directrices para construir y modificar extensiones en este repositorio
│   ├── add-ollama-cloud-model/  # Directrices para agregar un modelo de Ollama Cloud a models.json
│   ├── gh/                      # Acceso de solo lectura a la CLI de GitHub mediante un wrapper obligatorio
│   └── pr-review/               # Revisar una PR de GitHub y emitir los hallazgos como un artefacto en markdown
├── prompts/
│   ├── handoff.md               # /handoff — escribe un documento de traspaso de sesión en .pi/handoffs/
│   └── pickup.md                # /pickup — reanuda el trabajo desde el último documento de traspaso
├── themes/
│   └── slop.json                # Tema de color cálido personalizado
└── extensions/
    ├── chat-input/              # Borde de caja Unicode alrededor del editor principal de entrada de chat
    ├── caveman/                 # Comprime las respuestas del LLM: lite (profesional) / full (caveman) / ultra (compresión máxima)
    ├── env-loader/              # Inyecta tokens de .env en process.env al iniciar
    ├── footer/                  # Barra de estado con git, tokens, costo, contexto
    ├── mcp/                     # Puente del servidor MCP con conexiones perezosas y herramienta proxy
    ├── plan-mode/               # Flujo de trabajo planificar-entonces-ejecutar: planificación de solo lectura, luego ejecutar con plan_complete
    ├── chat-mode/               # Modo conversacional de solo lectura: chat, explorar, buscar — sin ediciones
    ├── permission-gate/         # Confirma comandos bash peligrosos antes de ejecutarlos
    ├── protected-paths/         # Bloquea el acceso de lectura/escritura a archivos y directorios sensibles
    ├── llm-council/             # Consejo multimodelo: los miembros responden de forma independiente, el presidente sintetiza
    ├── spinners/                # Verbos de spinner rotativo mientras el agente piensa
    ├── startup/                 # Encabezado de bienvenida mostrado al inicio de la sesión
    ├── styled-outputs/          # Renderizado con estilo personalizado para todos los tipos de mensajes (herramientas, diffs, pensamiento, habilidades)
    ├── subagents/               # Delega tareas a agentes secundarios especializados (único, paralelo, cadena)
    ├── web-access/              # Búsqueda web, obtención de páginas y extracción de PDF
    └── artifacts/               # Artefactos HTML visuales (markdown/html) en un servidor localhost perezoso con recarga en vivo
```

---

## Instalación

```bash
# Instalar Pi
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# Instalar Pikit
pi install npm:@adrianapan/pikit

# (Opcional, pero recomendado) Genera los archivos con opiniones propias de Pikit en ~/.pi/agent
bash ~/.pi/agent/npm/node_modules/@adrianapan/pikit/setup.sh

# Iniciar Pi
pi
```

### `setup.sh`

Puedes sincronizar manualmente las configuraciones con opiniones propias de Pikit (ajustes, atajos de teclado, prompt del sistema adicional) extrayéndolos del repositorio y colocando los archivos relevantes en tu carpeta de Pi. Como alternativa, puedes usar el script automatizado `setup.sh`.

```bash
# Las banderas son opcionales
bash ~/.pi/agent/npm/node_modules/@adrianapan/pikit/setup.sh [flags]
```

Banderas | Descripción
|-|-|
| `--settings` | Sincroniza `settings.json` (tema: "slop")
| `--system-prompt` | Sincroniza `APPEND_SYSTEM.md`
| `--modes` | Sincroniza `configs/chat-mode.json` y `configs/plan-mode.json`
| `--keybindings` | Sincroniza `keybindings.json` (dos atajos de Pikit)
| `--help`, `-h` | Muestra esta ayuda


* Ejecutarlo sin banderas ejecuta cada tarea en orden: settings, system-prompt, modes, keybindings

* Los archivos existentes se respaldan en `~/.pi/agent/_bak/` antes de ser reemplazados

* Es idempotente, por lo que las configuraciones de modo existentes y los campos ya correctos se omiten

### ¿Clonar el repositorio?

Si decides clonar el repositorio directamente en tu carpeta `~/.pi` en lugar de instalarlo mediante `pi install`, deberás ejecutar `npm i` para instalar las dependencias.

```bash
git clone git@github.com:adrianapan/pikit.git
cd ~/.pi
npm i
```

---


## Extensiones

### Flujos de trabajo y modos

* **plan-mode** — Agrega un flujo de trabajo `/plan`. Restringe las herramientas al modo de solo lectura mientras el LLM redacta una ruta de ejecución estructurada, y luego desbloquea todas las capacidades una vez que comienza la ejecución. → [`README`](agent/extensions/plan-mode/README.md)
* **chat-mode** — Se activa con `/chat` o `Ctrl+Shift+C`. Bloquea el sistema de archivos en modo de solo lectura para que puedas discutir, buscar y analizar código libremente sin riesgo de cambios accidentales. → [`README`](agent/extensions/chat-mode/README.md)
* **subagents** — Delega tareas aisladas a subprocesos secundarios de `pi` en segundo plano. Admite ejecutar tareas únicas, lotes en paralelo o cadenas de ejecución encadenadas. → [`README`](agent/extensions/subagents/README.md)
* **llm-council** — Ejecuta preguntas en un panel paralelo de modelos distintos y luego pasa sus hallazgos independientes a un modelo presidente para sintetizar una respuesta final. → [`README`](agent/extensions/llm-council/README.md)

### Interfaz y experiencia de usuario

* **styled-outputs** — Reemplaza las lecturas de consola planas por bloques de diff con código de color, secciones expandibles, iconos personalizados y grupos de herramientas visuales. → [`README`](agent/extensions/styled-outputs/README.md)
* **footer** — Una línea de estado densa y personalizada que detalla los modelos activos, métricas de tokens, costos de ejecución en vivo y el estado actual de git. Admite Nerd Fonts y alternativas en ASCII. → [`README`](agent/extensions/footer/README.md)
* **artifacts** — Renderiza markdown rico, HTML y diagramas Mermaid en una pestaña de navegador local autosuficiente con recarga en vivo. → [`README`](agent/extensions/artifacts/README.md)
* **chat-input** — Dibuja un marco Unicode estilizado y aislado alrededor de tu línea de entrada de terminal activa mientras preserva todos los atajos de edición subyacentes. → [`README`](agent/extensions/chat-input/README.md)
* **spinners** — Intercambia los indicadores estáticos de carga por estados de pensamiento dinámicos y temporizados, y acumuladores de tokens en vivo. → [`README`](agent/extensions/spinners/README.md)
* **startup** — Muestra un panel de diagnóstico conciso al iniciar, mapeando complementos activos, estados del servidor y recordatorios de atajos. → [`README`](agent/extensions/startup/README.md)

### Salvaguardas y seguridad

* **permission-gate** — Intercepta las ejecuciones de bash predeterminadas y fuerza pasos de confirmación antes de ejecutar comandos destructivos o sensibles como `sudo` o `rm`. → [`README`](agent/extensions/permission-gate/README.md)
* **protected-paths** — Niega explícitamente el acceso de escritura o lectura a áreas críticas (p. ej., `.git`, `.env`, credenciales) para asegurar que el agente permanezca dentro de su ámbito. → [`README`](agent/extensions/protected-paths/README.md)

### Integraciones y ajustes

* **mcp** — Un puente de Protocolo de Contexto de Modelo con carga perezosa. En lugar de afectar la velocidad de inicialización analizando todos los esquemas al arrancar, expone herramientas bajo demanda. → [`README`](agent/extensions/mcp/README.md)
* **web-access** — Agrega resúmenes de búsqueda en vivo a través de la API de Gemini y extrae formateo markdown limpio de URLs remotas y archivos PDF. → [`README`](agent/extensions/web-access/README.md)
* **env-loader** — Inyecta automáticamente variables personalizadas de `.env` en el contexto del proceso del agente al arrancar, manteniendo la gestión de claves fuera de los archivos de shell globales. → [`README`](agent/extensions/env-loader/README.md)
* **caveman** — Elimina el relleno conversacional cortés de la salida del modelo. Cuenta con tres niveles objetivo: `lite` (prosa concisa), `full` (gruñido prehistórico) y `ultra` (compresión máxima de tokens). → [`README`](agent/extensions/caveman/README.md)

---

## Habilidades

### pi-extension-builder

Se carga cuando le pides a pi que construya o modifique una extensión en este repositorio. Cubre la estructura de archivos, convenciones de código y requisitos de documentación. Invócalo explícitamente con `/skill:pi-extension-builder`.

### add-ollama-cloud-model

Se carga cuando le pides a pi que agregue un modelo de Ollama Cloud. Obtiene la página del modelo, extrae las capacidades y escribe la entrada correcta en `models.json`. Invócalo explícitamente con `/skill:add-ollama-cloud-model`.

### gh

Acceso de solo lectura a la CLI de GitHub mediante un wrapper obligatorio. Lista issues, PRs, repositorios, ejecuciones, lanzamientos y más, pero bloquea todos los comandos de escritura, eliminación y modificación. Cargalo al trabajar con recursos de GitHub. Invócalo explícitamente con `/skill:gh`.

### pr-review

Revisa una PR de GitHub y emite los hallazgos como un artefacto en markdown (informe HTML renderizado en el navegador). Recopila el diff a través de la habilidad `gh`, lo revisa y luego produce un único `artifact`: veredicto en la parte superior, hallazgos clasificados por gravedad, vallas `diff` por archivo. Invócalo explícitamente con `/skill:pr-review`.

---

## Plantillas de prompts

### handoff

`/handoff` genera un documento de traspaso completo (resumen, trabajo completado, archivos afectados, estado actual, siguientes pasos) y lo guarda en el directorio `.pi/handoffs/` del proyecto (misma convención que `.pi/plans/` de plan-mode). Úsalo cuando el contexto de una sesión se esté llenando o quieras continuar en una sesión nueva sin llevar toda la conversación.

### pickup

`/pickup` es el compañero de `/handoff`. Lee el documento de traspaso más reciente desde `.pi/handoffs/` (o uno específico por nombre), lo verifica contra el estado actual de git, resume en qué punto se encuentran las cosas y comienza en la sección "Próximos pasos inmediatos".

---

## Tema

### slop

Una paleta cálida y terrosa con primario terracota (`#d67858`) y texto blanco cálido (`#f5f2ee`), que cubre los 51 tokens de color de pi, incluido el resaltado de sintaxis y los indicadores de nivel de pensamiento. Actívalo con `/settings → Theme → slop`.

---

## Prompt del sistema

Pi adjunta [`agent/APPEND_SYSTEM.md`](agent/APPEND_SYSTEM.md) a su prompt del sistema predeterminado en cada sesión (sin código de extensión involucrado). Es una versión recortada y adaptada de las [directrices de codificación de Andrej Karpathy](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md): piensa antes de codificar, simplicidad primero, cambios quirúrgicos, ejecución orientada a objetivos y un quinto recordatorio para emitir salida visual a través de la herramienta `artifact`.

---

## Configuraciones

> Se experimenta mejor con [Ghostty](https://ghostty.org/): un emulador de terminal rápido, acelerado por GPU y multiplataforma.

### Modelos

Inicia `pi` en tu terminal y luego elige tu mecanismo de autenticación:

* **Proveedores por suscripción:** Dispara `/login` y autentícate con tu contexto de cuenta existente (Claude Pro, ChatGPT Plus, Copilot o Gemini).
* **Claves API directas:** Exporta tus claves a tu sesión de shell activa antes del arranque (p. ej., `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).

### Fuentes

Si los iconos de la interfaz o los gráficos de estado se ven rotos, instala una configuración moderna de fuente para desarrolladores:

```bash
brew install --cask font-jetbrains-mono-nerd-font

```

*Nota para usuarios de iTerm2:* Asegúrate de que **Settings → Profiles → Text** apunte a tu familia de fuentes Nerd Font elegida y habilita **Use a different font for non-ASCII text**. Si el renderizado del diseño vuelve a la forma predeterminada, fuerza el renderizado de símbolos explícitamente mediante `export FOOTER_NERD_FONTS=1`.

### Modelos personalizados o locales

`agent/models.json` (ignorado por git, recarga en caliente mientras pi se ejecuta) registra modelos locales o cualquier punto de conexión compatible con OpenAI. Referencia completa en la [documentación de modelos](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md).

#### Ollama — modelos locales

Apunta `baseUrl` al daemon de Ollama y lista los modelos que hayas descargado. `apiKey` es obligatorio pero se ignora localmente.

```json
{
  "providers": {
    "ollama": {
      "api": "openai-completions",
      "apiKey": "ollama",
      "baseUrl": "http://127.0.0.1:11434/v1",
      "models": [
        {
          "id": "qwen3.5:4b",
          "name": "Qwen3.5 4B",
          "contextWindow": 265000,
          "input": ["text", "image"],
          "reasoning": true
        }
      ]
    }
  }
}
```

#### Ollama — modelos en la nube

Ollama Cloud necesita una clave API y un bloque `compat`, porque los modelos en la nube no admiten el rol `developer` que usa pi para modelos de razonamiento. Almacena la clave en `agent/configs/.env` y léela con la forma de comando de shell para que se resuelva en tiempo de ejecución:

```json
{
  "providers": {
    "ollama-cloud": {
      "api": "openai-completions",
      "apiKey": "!grep ^OLLAMA_API_KEY ~/.pi/agent/configs/.env | cut -d= -f2",
      "baseUrl": "https://ollama.com/v1",
      "compat": {
        "supportsDeveloperRole": false
      },
      "models": [
        {
          "id": "qwen3.5:cloud",
          "name": "Qwen 3.5",
          "contextWindow": 265000,
          "input": ["text", "image"],
          "reasoning": true
        }
      ]
    }
  }
}
```

Explora modelos en [ollama.com/search](https://ollama.com/search); las variantes en la nube usan el sufijo `:cloud`. O salta el JSON y simplemente pídele a pi: *"Add https://ollama.com/library/qwen3.5 to my Ollama cloud config"*, y la habilidad [`add-ollama-cloud-model`](agent/skills/add-ollama-cloud-model/SKILL.md) se encarga de ello.

> Las extensiones de pi se ejecutan con acceso completo al sistema; esto aplica a este kit y a cualquier otra cosa que instales. Revisa el código fuente antes de confiar en un paquete; todo aquí es lo suficientemente pequeño para leerse de una sentada.
