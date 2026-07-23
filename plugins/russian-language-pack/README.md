# Russian Language Pack для ZCode на Windows

Плагин A.I.R ZCode Plugins версии 0.1.18 добавляет русский язык и перевод интерфейса в обычный ZCode Desktop 3.4.2 на Windows 10 и Windows 11.

---

## Установка

1. Добавьте marketplace `https://github.com/dan-zakirov/air-zcode-plugins` без `/` в конце.
2. Нажмите **Get** у `russian-language-pack`.
3. Один раз откройте новую задачу. Перезапуск ZCode не нужен.
4. Выберите `Settings > General > Language > Русский`.

---

## Поведение

* Плагин включён - русский язык доступен, выбранный перевод работает.
* Плагин выключен - русский язык и перевод исчезают.
* Плагин обновлён - runtime подхватывает новую версию без закрытия ZCode.
* После перезагрузки Windows runtime автоматически восстанавливается при запуске ZCode.
* `app.asar` и подпись приложения не изменяются.

---

## Состав

```text
russian-language-pack/
├── .zcode-plugin/plugin.json
├── .codex-plugin/plugin.json
├── commands/
├── hooks/hooks.json
├── instructions/AGENTS.ru.md
├── scripts/
│   ├── inject-ru.cmd
│   ├── ru-translations.js
│   ├── run-ui-patch.cmd
│   ├── run-ui-patch.ps1
│   ├── runtime-supervisor.ps1
│   └── runtime-ui-controller.mjs
└── skills/
```

Первый `SessionStart` регистрирует пользовательский supervisor Windows. Он автоматически ждёт запуск обычного ZCode, поднимает runtime, внедряет перевод только в память renderer и следит за состоянием плагина. `UserPromptSubmit` восстанавливает supervisor при необходимости и добавляет русскоязычный контекст к запросу.

---

## Команды

* `/obzor` - краткий обзор проекта;
* `/diagnostika` - read-only проверка конфигурации и runtime;
* `/podderzhka` - помощь с установкой и обновлением.

---

## Совместимость

Поддерживаются только Windows 10, Windows 11 и ZCode Desktop 3.4.2.

---

## Лицензия

MIT
