[![GitHub Release](https://img.shields.io/github/release/lilliputten/templates-parser.svg)](https://github.com/lilliputten/templates-parser/releases)
[![Build Status](https://api.travis-ci.org/lilliputten/templates-parser.svg?branch=master)](https://travis-ci.org/lilliputten/templates-parser)
[![npm version](https://badge.fury.io/js/templates-parser.svg)](https://badge.fury.io/js/templates-parser)

# templates-parser

> Модуль для разбора готовых html страниц на блоки для вёрстки (напр., для twig|django шаблонизаторов).

Инсталляция
-----------

```shell
  npm install templates-parser --save
```

Описание
--------

Для парсинга исопльзуется модуль [cheerio](https://github.com/cheeriojs/cheerio).

Использование
-------------

```js
    var templatesParser = require('templates-parser');
    templatesParser.run({
        configFile: 'parse_config.yaml',
        debugLevel: 5,
    });
```

Тестирование
------------

```shell
   npm test
```

История изменений
-----------------

2017.02.27, 03:45 -- Метод `_repairDataBem`. Исправление испорченных атрибутов `data-bem`. См. секцию в TODO.

2017.02.26, 03:38 -- Пробные тесты.

TODO
----

### 2017.02.27, 03:45

htmlparser2 (cheerio) ошибочно считыввает атрибуты вида `data-bem='{"page":{"mode":"inject"}}'`. Они превращаются в нечто похожее на `data-bem="{" page":{"mode":"inject"}}"=""`.

Как временное решение добавлена ф-ция `_repairDataBem`, возвращающая атрибут в исходный вид (через RegEx).

Необходимо найти способ объяснить htmlparser2, что атрибуты в одинарных кавычках (`data-bem='...'`) тоже корректны.

