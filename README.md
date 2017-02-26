[![GitHub Release](https://img.shields.io/github/release/lilliputten/templates-parser.svg)](https://github.com/lilliputten/templates-parser/releases)
[![Build Status](https://travis-ci.org/lilliputten/templates-parser.png?branch=master)](https://travis-ci.org/lilliputten/templates-parser)

templates-parser
================

> Модуль для разбора готовых html страниц на блоки для вёрстки (напр., для twig|django шаблонизаторов).

Инсталляция
-----------

```shell
  npm install templates-parser --save
```

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

2017.02.26, 03:38 -- Пробные тесты.

