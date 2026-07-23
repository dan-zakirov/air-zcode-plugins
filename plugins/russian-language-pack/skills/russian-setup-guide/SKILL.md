---
name: russian-setup-guide
description: "Помогает на русском настраивать и диагностировать плагины, hooks, skills, команды и MCP-серверы ZCode."
---

# Russian Setup Guide

Используй фактическую конфигурацию ZCode и объясняй результат на русском.

## Основные пути

- Пользовательский конфиг: `~/.zcode/cli/config.json`.
- Пользовательские инструкции: `~/.zcode/AGENTS.md`.
- Пользовательские skills и команды: `~/.zcode/skills/`, `~/.zcode/commands/`.
- Совместимые общие ресурсы: `~/.agents/skills/`, `~/.agents/commands/`, `~/.agents/mcp.json`.
- Конфиг проекта: `<repo>/.zcode/config.json` или `<repo>/zcode.json`.
- Инструкции проекта: `<repo>/AGENTS.md`.
- Кеш плагинов: `~/.zcode/cli/plugins/cache/`.

## Проверка ресурсов

- Plugins: открой **Settings > Plugin Management** и проверь установленную версию, enable-state, компоненты и runnable hooks.
- Hooks: поддерживаются `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `Stop`.
- Пользовательские hooks в конфиге требуют `hooks.enabled: true`; plugin hooks включают runner автоматически.
- MCP-серверы проверяй в `mcp.servers` пользовательского или проектного конфига.
- Skills и команды проверяй одновременно в UI и в каталогах discovery; более высокий scope может затенить одноимённый ресурс.

Если установлен официальный `zcode-guide`, используй подходящий диагностический skill (`diagnosing-plugins`, `diagnosing-hooks`, `diagnosing-mcp`, `diagnosing-skills` или `diagnosing-commands`) и перескажи вывод на русском.

## Russian Language Pack

На Windows версия 0.1.18 работает внутри обычного ZCode Desktop 3.4.2 и не меняет файлы приложения. После первой установки один раз открой новую задачу, затем выбери **Settings > General > Language > Русский** или **Профиль > Язык > Русский**. Перезапуск ZCode не нужен.

После первого `SessionStart` пользовательский supervisor автоматически восстанавливает runtime при каждом запуске ZCode. При выключении русский язык и перевод исчезают, при включении возвращаются, а обновления применяются перезагрузкой только renderer.
