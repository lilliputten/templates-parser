templates-parser
================

Модуль для разбора готовых html страниц на блоки для вёрстки (напр., для twig|django шаблониазторов).

## Installation

```shell
  npm install templates-parser --save
```

## Usage

```js
    var templatesParser = require('templates-parser');
    templatesParser.run({
        configFile: 'parse_config.yaml',
        debugLevel: 5,
    });
```

## Tests

```shell
   npm test
```

## Contributing

In lieu of a formal styleguide, take care to maintain the existing coding style.
Add unit tests for any new or changed functionality. Lint and test your code.

## Release History

* 1.0.0 Refactor to avoid double unescape and to use npm scripts instead
  of makefile.  Also add link to associated blog post.
* 0.1.0 Initial release
