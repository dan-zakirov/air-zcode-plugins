---
description: Справка по Russian Language Pack и восстановлению локализации ZCode.
skills: russian-response,russian-setup-guide
---

Выведи краткую справку по `russian-language-pack`:

- поддержка: Windows 10/11, ZCode Desktop 3.3.4;
- marketplace: `https://github.com/dan-zakirov/air-zcode-plugins` без `/` в конце;
- после первого **Get** один раз открой новую задачу, перезапуск ZCode не нужен;
- выбери **Settings > General > Language > Русский**;
- версия 0.1.13 работает в памяти обычного ZCode на Windows и не изменяет `app.asar`;
- выключение плагина убирает русский язык и перевод, включение возвращает их онлайн;
- runtime state: `~/.zcode/air-russian-language-pack/runtime.lock.json`;
- если русский не появился, проверь `SessionStart`, установленную версию и `plugins.enabledPlugins`.

Также перечисли команды `/obzor`, `/diagnostika` и `/podderzhka`.
