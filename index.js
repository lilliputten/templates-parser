// ex: set commentstring=/*%s*/ :
/* jshint camelcase: false, unused: false, expr: true */

/**
 *
 * @overview TemplatesParser
 *
 * @author lilliputten <lilliputten@yandex.ru>
 * @since 2017.02.03, 16:43
 * @version 2017.02.26, 02:01
 *
*/

/*
 * @module TemplatesParser
 */

var

    /*{{{ Дебаг, инфо... */
    DBG = function () { console && console.error.apply(console, arguments); },
    /*}}}*/

    /*{{{ Библиотечные модули... */

    argv = require('yargs').alias('d', 'debug').boolean('d').argv,

    cheerio = require('cheerio'),
    yaml = require('js-yaml'),
    // vow = require('vow'),
    extend = require('extend'),
    fs = require('fs-extra'),
    path = require('path'),

    template = require('lodash.template'),
    styleHtml = require('html').prettyPrint,

    /*}}}*/

    /*{{{ Системное... */

    global = typeof window !== 'undefined' ? window : global || this,

    /*}}}*/

    /** defaultConfig{} ** {{{ Обязательные параметры и значения по умолчанию
     */
    defaultConfig = /** @lends TemplatesParser.defaultConfig */ {

        /** Внутренний флаг отладки */
        DEBUG : argv.debug || true,

        /** Уровень выводимой отладочное информации (если 0 -- все уровни, иначе только если _infoLevel < debugLevel) */
        debugLevel : 2,

        /** Имя файла конфигурации */
        configFile : 'sample_config.yaml',

        /** Корневая папка проекта. Устанавливается в init() */
        rootPath : './',

        /** Исходный путь, в котором лежат страницы для обработки */
        srcPath : 'src/',

        /** Конечный путь, -- туда складываем обработанные шаблоны и блоки */
        destPath : 'dest/',

        /** Длина строки для вывода по умолчанию */
        defaultMaxlen : 50,

        /** Отбивка уровней для информационных/отладочных сообщений */
        infoLevelSymbol : '.',

        /** quotes {{{ Парные символы кавычек/скобок */
        quotes : {

            '' : '',
            '"' : '"',
            '\'' : '\'',

            '("' : '")',
            '["' : '"]',
            '<"' : '">',

            '(' : ')',
            '[' : ']',
            '<' : '>',

        },/*}}}*/

    },/*}}}*/

    END_CONST
;

var TemplatesParser = /** @lends TemplatesParser */ {

    // Данные...

    /** Уровень вложенности для отладочных сообщений (стартовое значение) */
    _infoLevel : 0,

    /** Тестовое свойство для проверки шаблонов */
    testParam : 'TEST',

    /** Конфигурация. Загружается в @see loadConfig */
    config : defaultConfig,

    /** Страницы */
    pages : {},

    // Методы...

    /** _level ** {{{ Увеличить или уменьшить отступ отладочных сообщений
     * @param {boolean} step - Увеличение или уменьшение
     */
    _level : function (step) {

        this._infoLevel += ( ( typeof step === 'undefined' || step ) ? 1 : -1 );

    },/*}}}*/
    /** _unlevel ** {{{ Уменшить отступ отладочных сообщений
     */
    _unlevel : function () {

        this._level(false);

    },/*}}}*/

    /** _strMult ** {{{ Повторить строку/символ n раз
     */
    _strMult : function (s,n) {

        var res = '';

        for ( var i=0; i<n; i++ ) {
            res += s;
        }

        return res;

    },/*}}}*/
    /** _infoRaw ** {{{ Безусловный вывод отладочной/статусной информации
     */
    _infoRaw : function () {

        var args = Array.prototype.slice.call(arguments);

        args.unshift( this._strMult(this.config.infoLevelSymbol, this._infoLevel + 1) );

        console && console.info.apply(console, args);

    },/*}}}*/
    /** _info ** {{{ Вывод отладочной/статусной информации (с проверкой debugLevel)
     */
    _info : function () {

        if ( !this.config.debugLevel || this._infoLevel < this.config.debugLevel ) {

            this._infoRaw.apply(this, arguments);

        }

    },/*}}}*/

    /** _strQuote ** {{{ Подготавливаем строку к выводу на консоль.
     * @param {string} str - Строка
     * @param {string} [q] - Сивол кавычек/скобок
     * @param {number} [maxlen] - Максимальная длина
     */
    _strQuote : function (str, q, maxlen) {

        q = typeof q !== 'undefined' ? q : '"';
        str = String ( str );

        var
            q1 = q || '',
            q2 = this.config.quotes[q] || '',
            reg = new RegExp ( '([' + (q1+q2).replace(/(["'\[\]\(\)])/g, '\\$1') + '])', 'g' ),

            undef
        ;

        str = this._strTrim(str, maxlen)
            .replace(reg, '\\$1')
            .replace(/[\n\r]/g, '\\n')
        ;

        str = q1 + str + q2;

        return str;

    },/*}}}*/
    /** _strTrim ** {{{ Ограничиваем строку заданной длиной. При обрезании добавляем многоточние.
     * @param {string} str - Строка
     * @param {number} maxlen - Максимальная длина
     */
    _strTrim : function (str, maxlen) {

        maxlen = maxlen || this.config.defaultMaxlen;

        if ( typeof maxlen === 'number' && maxlen >= 3 && str.length > maxlen ) {
            str = str.substr(0, maxlen-3) + '...';
        }

        return str;

    },/*}}}*/

    /** _expandPath ** {{{ Получить путь, годный для использования для функций работы с файловой системой
     * @param {string, ...} path
     */
    _expandPath : function () {

        var paths = [ this.config.rootPath ];

        for ( var i=0; i<arguments.length; i++ ) {
            paths.push(arguments[i] || '');
        }

        var result = path.posix.join.apply(path, paths);

        return result;

    },/*}}}*/

    /** _isCorrectRule ** {{{ Определить, является ли объект правилом парсинга
     */
    _isCorrectRule : function (rule) {

        return ( typeof rule === 'object' && ( rule.selector || rule.block || rule.blocks || rule.manipulate ) ) ? true : false;

    },/*}}}*/

    /** _parseTemplate ** {{{ Применить lodash шаблон
     * @param {string} tmpl - Шаблон
     * @param {object} [options] - Данные для передачи в шаблонизатор
     */
    _parseTemplate : function (tmpl, options) {

        if ( typeof tmpl === 'string' ) {
            tmpl = template(tmpl)(extend({}, options, {
                TemplatesParser : this,
            }));
        }

        return tmpl;

    },/*}}}*/

    /** _prepareParams ** {{{ Подготовить параметры / список параметров (производятся подстановки и пр.)
     * @param {*|string|array} param - Параметр/параметры
     * @param {object} [options] - Данные для подстановки в шаблонизаторе
     */
    _prepareParams : function (param, options) {

        var that = this,
            res;

        // Если набор параметров, то обрабатываем их рекурсивно...
        if ( Array.isArray(param) ) {
            return param.map(function(param){
                return that._prepareParams(param, options);
            });
        }
        // Если спецпараметр вида `cmd:param`, то...
        else if ( typeof param === 'string' && ( res = param.match(/^(?:(_parse|file):)(.*)$/) ) !== null ) {
            var cmd = res[1],
                subParam = res[2];
            // Если `file`, то загружаем файл
            cmd === 'file' && ( subParam = this.loadFile(subParam) );
            // Парсим lodash
            return this._parseTemplate(subParam, options);
        }

        return param;

    },/*}}}*/

    /** _applyManipulates ** {{{ Применить нативные манипуляцию cheerio
     *
     * Напр (vinyl-аналог): `cheerNode.replaceWith('<!-- XXX -->');`
     * @see методы из {@link file:node_modules/cheerio/lib/api/manipulation.js}
     * @see документацию {@link https://github.com/cheeriojs/cheerio}
     *
     * @param {cheerio} cheerNode - cheerio html элемент
     * @param {object|object[]} manipulate - Описание манипуляции
     *
     */
    _applyManipulates : function (cheerNode, manipulate, options) {

        this._info( 'Список манипуляций: (', Object.keys(manipulate).join(', '), ')' );

        this._level();

        var lastResult = '';

        for ( var cmd in manipulate ) {

            // Параметр(ы)
            var params = manipulate[cmd];
            var m = params;

            if ( typeof params === 'object' &&  params.cmd ) {
                cmd = params.cmd;
                params = params.params;
            }

            if ( typeof cheerNode[cmd] !== 'function' ) {
                this._infoRaw( '(!) Неизвестная команда cheerio:', this._strQuote(cmd) );
                continue;
            }

            this._info( 'Манипуляция (', cmd, ':', this._strQuote(params), ')' );

            // Подготавливаем комплексные параметры
            var id = [ cmd, ( m.name || '' ) ].join(' ');
            var opt = extend({}, options, {
                node : cheerNode,
                manipulate : manipulate,
                m : m,
                ID : id,
                IDTAG : '<!-- '+id+' -->',
                cmd : cmd,
                lastResult : lastResult,
            });
            params = this._prepareParams(params, opt);
            // Убеждаемся, что массив -- для `apply`
            Array.isArray(params) || ( params = [ params ] );

            // Применяем метод
            lastResult = cheerNode[cmd].apply(cheerNode, params);

        }

        this._unlevel();

    },/*}}}*/

    /** _matchValues ** {{{ Соответствует ли значение (списку или проверочному значению)
     * @param {*} what - Проверяемое значение
     * @param {*|*[]} - Проверочное значение
     * @return {boolean}
     */
    _matchValues : function (what, where) {

        if ( Array.isArray(where) ) {
            if ( where.indexOf(what) !== -1 ) {
                return true;
            }
        }
        /* jshint eqeqeq: false */ else if ( what == where ) {
            return true;
        }

        return false;

    },/*}}}*/

    /** _matchAllOrAny ** {{{ Проверить совпадение всех условий
     * @param match - Условия. Один элемент или список элементов { id : valueOrList }
     * @param values - Проверяемые значения
     * @return {boolean}
     */
    _matchAllOrAny : function (isMatchAll, match, values) {

        for ( var id in match ) {
            var
                where = match[id],
                what = values[id],
                isMatch = this._matchValues(what, where)
            ;
            // Если требуется сопадение всех условий и текущее не совпадает...
            if ( isMatchAll && !isMatch  ) {
                return false;
            }
            // Если требуется хоть одно совпадение и текущее совпадает...
            if ( isMatchAll && isMatch ) {
                return true;
            }
        }

        // Иначе, если просмотрены все значения, то результат
        // - истина, если нужны все совпадения,
        // - ложь, если нужно хотя бы одно.
        var result = isMatchAll ? true : false;

        return result;

    },/*}}}*/

    /** _checkMatches ** {{{ Проверяем совпадение условий для объекта
     * @param obj - Объект, в котором ищем описания условий (match, matchAll, matchAny)
     * @param values - Проверяемые значения
     * @return {boolean}
     */
    _checkMatches : function (obj, values) {

        if ( obj.match && !this._matchAllOrAny(true, obj.match, values) ) {
            this._info( 'Не совпадает условие (match):', obj.match );
            return false;
        }
        if ( obj.matchAll && !this._matchAllOrAny(true, obj.matchAll, values) ) {
            this._info( 'Не совпадает условие (matchAll):', obj.matchAll );
            return false;
        }
        if ( obj.matchAny && !this._matchAllOrAny(false, obj.matchAny, values) ) {
            this._info( 'Не совпадает условие (matchAny):', obj.matchAny );
            return false;
        }

        return true;

    },/*}}}*/

    /** _makeBlocks ** {{{ Создать блок из элемента cheerio по объекту описания
     *
     * @param {cheerio} cheerNode - cheerio html элемент
     * @param {object|object[]} blocks - Описание правил создания блока (одиночное или список)
     * @param {object} [options] - Параметры
     *
     */
    _makeBlocks : function (cheerNode, blocks, options) {

        options || ( options = {} );

        this.blocks || ( this.blocks = {} );

        // Если `true`, то создаём блок с идентификтором правила
        if ( blocks === true ) {
            if ( options && options.rule && options.rule.id ) {
                blocks = options.rule.id;
            }
        }

        if ( !blocks ) {
            this._infoRaw( '(!) Не задан блок' );
        }

        // Блок по умолчанию: извлечь весь контент (`toString`)
        ( typeof blocks === 'string' ) && ( blocks = [ blocks ] );
        if ( Array.isArray(blocks) ) {
            var list = blocks;
            blocks = {};
            for ( var i in list ) {
                var newId = list[i];
                blocks[newId] = { extract : 'toString' };
            }
        }

        this._info( 'Блок (', Object.keys(blocks).join(', '), ')' );

        this._level();

        for ( var id in blocks ) {

            var block = blocks[id] || {},
                cfg = this.config.parseBlocks[id] || {},
                extract = ( ( typeof block === 'string' ) ? block : block.extract ) || {},
                cmd = ( ( typeof extract === 'string' ) ? extract : extract.cmd ) || 'toString',
                params = extract.params || [],
                rules = cfg.makeRules || this.config.defaultMakeBlocksRules,
                undef
            ;

            if ( !this._checkMatches(block, options) ) {
                continue;
            }

            if ( typeof cheerNode[cmd] !== 'function' ) {
                this._infoRaw( '(!) Неизвестная команда cheerio:', this._strQuote(cmd) );
                continue;
            }

            this._info( 'Извлекаем блок', this._strQuote(id), ': (', cmd, this._strQuote(params), ')' );

            // Подготавливаем комплексные параметры
            params = this._prepareParams(params, extend({}, options, {
                blockId : id,
            }));

            // Убеждаемся, что массив -- для `apply`
            Array.isArray(params) || ( params = [ params ] );

            // Применяем метод, извлекаем контент
            var content = cheerNode[cmd].apply(cheerNode, params) || '';

            if ( rules ) {
                content = this.parseContent(content, rules, extend({}, options, {
                    parseId : 'block:'+id,
                    blockId : id,
                }));
            }

            this.blocks[id] || ( this.blocks[id] = {} );
            this.blocks[id].content = content;

            this._info( 'Блок', this._strQuote(id), this._strQuote(content.length, '['), ':', this._strQuote(content) );
        }

        this._unlevel();

    },/*}}}*/

    /** _applyReplaces ** {{{ Замена
     * @param {string} html - html
     * @param {object|obect[]} replaces - Правила(правило) замены
     * @param {object} [options] - Параметры
     */
    _applyReplaces : function (html, replaces, options) {

        if ( Array.isArray(replaces) ) {
            this._info( 'Набор правил замены', this._strQuote(replaces.length, '[') );
            this._level();
            for ( var i=0; i<replaces.length; i++ ) {
                // ...то обрабатываем по одному
                html = this._applyReplaces(html, replaces[i], options);
            }
            this._unlevel();
        }
        else {

            var r = replaces;

            this._info( 'Замена', ( r.id || this._strQuote(r.pattern) ) );

            var
                reg = new RegExp(r.pattern, r.options || 'g'),
                result = this._prepareParams(r.result, extend({}, options, {
                    replace : r,
                }))
            ;

            // this._info( 'Замена', this._strQuote(replaces[i].pattern) );

            html = html.replace(reg, result);

        }

        return html;

    },/*}}}*/

    /** _applyRuleBase ** {{{ Правило (cheerio)
     * @param {cheerio} cheerHtml - html
     * @param {object} rule - Правило парсинга
     * @param {object} [options] - Параметры
     */
    _applyRuleBase : function (cheerHtml, rule, options) {

        var cheerNode;

        // Ищем элемент по селектору...
        if ( rule.selector ) {
            this._info( 'Селектор', this._strQuote(rule.selector) );
            cheerNode = cheerHtml(rule.selector);
        }
        // Или выбираем ключевой элемент
        else {
            cheerNode = cheerHtml.root();
        }

        if ( !cheerNode || !cheerNode.length ) {
            this._infoRaw( '(!) Не найден элемент для правила', this._strQuote(rule.id || rule.selector), options );
            return false;
        }

        options = extend({}, options, {
            cheerHtml : cheerHtml,
            node : cheerNode,
            rule : rule,
        });

        for ( var key in rule ) {
            switch ( key ) {
                case 'manipulate':
                    this._applyManipulates(cheerNode, rule.manipulate, options);
                    break;
                case 'block':
                    this._makeBlocks(cheerNode, rule.block, options);
                    break;
                case 'blocks':
                    this._makeBlocks(cheerNode, rule.blocks, options);
                    break;
            }
        }


    },/*}}}*/

    /** _applyRule ** {{{ Применить правило
     * @param {cheerio} cheerHtml - html
     * @param {object} rule - Правило парсинга
     * @param {object} [options] - Параметры
     */
    _applyRule : function (cheerHtml, rule, options) {

        this._info( 'Применяем правило', this._strQuote(rule.id || rule.selector) );//, ':', this._strQuote(rule.selector) );

        this._level();

        if ( this._isCorrectRule(rule) ) {
            this._applyRuleBase(cheerHtml, rule, options);
        }

        this._unlevel();

    },/*}}}*/

    /** _parse ** {{{ Распарсить cheerio html
     * @param {cheerio} cheerHtml - html
     * @param {object|array} rules - Правила парсинга
     */
    _parse : function (cheerHtml, rules, options) {

        var that = this;

        // Если набор правил...
        if ( Array.isArray(rules) && rules.length ) {
            this._info( 'Набор правил парсера', this._strQuote(rules.length, '['), ':', rules.map(function(rule){
                return Array.isArray(rule) ? that._strQuote(rule.length, '[') : rule.id;
            }).join(', ') );
            this._level();
            for ( var i=0; i<rules.length; i++ ) {
                var rule = rules[i];
                // ...то обрабатываем по одному
                this._parse(cheerHtml, rule, options);
            }
            this._unlevel();
        }
        // Если корректное правило
        else if ( this._isCorrectRule(rules) ) {
            this._applyRule(cheerHtml, rules, options);
        }

    },/*}}}*/

    // Интерфейс...

    /** testMethod ** {{{ Dummy test
     */
    testMethod : function () {
        return 'test ok';
    },/*}}}*/

    /** loadPages ** {{{ Загрузить исходные страницы
     */
    loadPages : function () {

        this.pages || ( this.pages = {} );

        var that = this,
            srcPath = this._expandPath(this.config.srcPath),
            undef
        ;

        this._info( 'Исходные страницы <-', this._strQuote(this.config.srcPath) );

        // Если путь не задан ('./') либо задан и существует...
        if ( !srcPath || ( fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory() ) ) {

            this._level();

            fs.readdirSync(srcPath)
                .filter(function(fileName){
                    return !fileName.startsWith('.') && ( !that.config.srcExt || fileName.endsWith(that.config.srcExt) );
                })
                .map(function(fileName){

                    var
                        id = ( that.config.srcExt && fileName.substr(0,fileName.length-that.config.srcExt.length) ) || fileName,
                        filePath = path.posix.join(that.config.srcPath, fileName),
                        fileContent = that.loadFile(filePath),
                        undef
                    ;

                    that._info( 'Страница', that._strQuote(id), '<-', that._strQuote(filePath) );

                    that.pages[id] = {
                        id : id,
                        fileName : fileName,
                        srcContent : fileContent,
                    };

                })
            ;

            this._unlevel();

        }

    },/*}}}*/

    /** parseAndWriteTemplates ** {{{ Сохранить шаблоны
     */
    parseAndWriteTemplates : function () {

        var
            parseTemplates = this.config.parseTemplates || {},
            pages = this.pages || {}
        ;

        this._info( 'Обрабатываем шаблоны (', Object.keys(parseTemplates).join(', '), ')' );

        this._level();

        for ( var id in parseTemplates ) {

            var

                // Описание шаблона
                ctx = parseTemplates[id] || {},

                // Идентификатор исходной страницы
                pageId = ctx.pageId || id,

                options = {
                    template : id,
                }

            ;

            this._info( 'Шаблон', this._strQuote(id) );

            if ( !pageId ) {
                this._infoRaw( '(!) Не задана страница для шаблона', this._strQuote(id, '("') );
                continue;
            }

            if ( !pages[pageId] ) {
                this._infoRaw( '(!) Отсутствует страница для шаблона', this._strQuote(id, '("'), this._strQuote(pageId) );
                continue;
            }

            var

                // Описание страницы
                pageCtx = pages[pageId] || {},

                // Имя конечного файла
                destFileName = id + ( this.config.destExt || '' ),

                // Полный путь к конечному файлу
                destFilePath = path.posix.join(this.config.destPath, destFileName),

                // Исходный контент шаблона
                content = pageCtx.content || pageCtx.srcContent || '',

                // Получаем cheerio объект шаблона
                cheerHtml = cheerio.load(content, this.config.cheerioOptions),

                // Правила обработки шаблона
                rules = ctx.rules || this.config.defaultTemplateRules

            ;

            this._level();

            this._info( 'Парсим шаблон', this._strQuote(id), '<-', this._strQuote(pageId) );
            this._level();
            this._parse(cheerHtml, rules, options);
            this._unlevel();

            var html = cheerHtml.html();
            if ( this.config.beautifyHtml ) {
                html = styleHtml(html, this.config.beautifyOptions);
            }

            this._info( 'Сохраняем шаблон', this._strQuote(id), '->', this._strQuote(destFilePath) );
            this._level();
            this.writeFile(destFilePath, html);
            this._unlevel();

            this._unlevel();

        }

        this._unlevel();

    },/*}}}*/

    /** parseAndWritePages ** {{{ Сохранить страницы
     */
    parseAndWritePages : function (options) {

        var
            parsePages = this.config.parsePages || {},
            pages = this.pages || {}
        ;

        this._info( 'Парсим страницы (', Object.keys(parsePages).join(', '), ')' );

        this._level();

        for ( var id in parsePages ) {

            var

                // Описание шаблона
                ctx = parsePages[id] || {}

            ;

            this._info( 'Страница', this._strQuote(id) );

            if ( !pages[id] ) {
                this._infoRaw( '(!) Отсутствует страница', this._strQuote(id) );
                continue;
            }

            var

                // Описание страницы
                pageCtx = pages[id] || {},

                // Исходный контент шаблона
                content = pageCtx.content || pageCtx.srcContent || ''

            ;

            this._level();

            var replaces = ctx.replaces || this.config.defaultPageReplaces;

            if ( replaces ) {
                content = this._applyReplaces(content, replaces, options);
            }

            // Получаем cheerio объект шаблона
            var cheerHtml = cheerio.load(content, this.config.cheerioOptions);

            // Правила обработки шаблона
            var rules = ctx.rules || this.config.defaultPageRules;

            if ( rules ) {
                content = this.parseContent(content, rules, extend({}, options, {
                    parseId : 'page:'+id,
                    pageId : id,
                }));
            }

            content = pageCtx.content = cheerHtml.html();
            if ( this.config.beautifyHtml ) {
                content = styleHtml(content, this.config.beautifyOptions);
            }

            // Имя конечного файла
            var srcFileName = id + ( this.config.srcExt || '' );

            // Полный путь к конечному файлу
            var srcFilePath = path.posix.join(this.config.srcPath, srcFileName);

            if ( ctx.save ) {
                this._info( 'Сохраняем страницу', this._strQuote(id), '->', this._strQuote(srcFilePath) );
                this._level();
                this.writeFile(srcFilePath, content);
                this._unlevel();
            }

            this._unlevel();

        }

        this._unlevel();

    },/*}}}*/

    /** parseContent ** {{{ Разбираем строку контента (блок, страница, шаблон, ...)
     * @param {string} content
     * @param {object} [rules]
     * @param {object} [options]
     */
    parseContent : function (content, rules, options) {

        content = content || '';

        if ( rules ) {

            // Получаем cheerio объект шаблона
            var cheerHtml = cheerio.load(content, this.config.cheerioOptions);

            this._info( 'Парсим контент', this._strQuote( options && options.parseId ) );
            this._level();
            this._parse(cheerHtml, rules, options);
            this._unlevel();

            content = cheerHtml.html();

        }

        return content;

    },/*}}}*/

    /** parseAndWriteBlocks ** {{{ Сохранить шаблоны
     */
    parseAndWriteBlocks : function (options) {

        var
            parseBlocks = this.config.parseBlocks || {},
            blocks = this.blocks || {},
            listBlocks = this.config.saveAllBlocks ? blocks : parseBlocks,
            undef
        ;

        this._info( 'Сохраняем блоки (', Object.keys(listBlocks).join(', '), ')' );

        this._level();

        for ( var id in listBlocks ) {

            var

                // Описание блока
                cfg = parseBlocks[id] || {}

            ;

            this._info( 'Блок', this._strQuote(id) );

            if ( !blocks[id] && !this.config.saveEmptyBlocks ) {
                this._infoRaw( '(!) Отсутствует блок', this._strQuote(id) );
                continue;
            }

            var

                // Данные блока
                blockData = blocks[id] || {},

                // Исходный контент шаблона
                content = blockData.content || '',

                // Правила обработки
                rules = cfg.rules || this.config.defaultBlockRules

            ;

            this._level();

            if ( rules ) {
                content = this.parseContent(content, rules, extend({}, options, {
                    parseId : 'block:'+id,
                    blockId : id,
                }));
            }

            if ( this.config.beautifyHtml ) {
                content = styleHtml(content, this.config.beautifyOptions);
            }

            // Имя конечного файла
            var destFileName = ( cfg.file || id ) + ( this.config.destExt || '' );
            if ( this.config.defaultBlocksFolder ) {
                destFileName = path.posix.join(this.config.defaultBlocksFolder, destFileName);
            }
            destFileName = path.posix.join(this.config.destPath, destFileName);

            // if ( cfg.save ) {
            this._info( 'Сохраняем блок', this._strQuote(id), '->', this._strQuote(destFileName) );
            this._level();
            this.writeFile(destFileName, content);
            this._unlevel();
            // }

            this._unlevel();

        }

        this._unlevel();

    },/*}}}*/

    // /** writePages ** {{{ Сохранить страницы (???)
    //  */
    // writePages : function () {
    //
    //     var that = this,
    //         srcPath = this._expandPath(this.config.srcPath),
    //         undef
    //     ;
    //
    //     typeof this.pages === 'object' && Object.keys(this.pages).map(function(id){
    //         var page = that.pages[id] || {},
    //             destFileName = id + ( that.config.destExt || '' ),
    //             filePath = path.posix.join(that.config.destPath, destFileName),
    //             fileContent = page.content || page.srcContent,
    //             undef
    //         ;
    //         that.writeFile(filePath, fileContent);
    //         // gulpFile('aaa', 'bbb', { src: true })
    //         //     .pipe( gulp.dest('dest') )
    //         //     .pipe( gulpDebug({ title: 'test ->' }) )
    //         // ;
    //
    //     });
    //
    // },/*}}}*/

    /** writeFile ** {{{ Сохранить файл
     * @param {string} fileName - Имя файла
     * @param {string} data - Данные для сохранения
     */
    writeFile : function (fileName, data) {

        var filePath = this._expandPath(fileName, ''),
            dirPath = path.posix.dirname(filePath);

        fs.mkdirsSync(dirPath);

        fs.outputFileSync(filePath, data, 'utf8');

    },/*}}}*/
    /** loadFile ** {{{ Загрузить файл
     * @param {string} fileName - Имя файла
     */
    loadFile : function (fileName) {

        var filePath = this._expandPath(fileName, '');

        if ( fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory() ) {
            return fs.readFileSync(filePath, 'utf8');
        }

        return '';

    },/*}}}*/
    /** loadYaml ** {{{ Загружаем конфигурацию
     * @param {string} fileName - Имя файла
     */
    loadYaml : function (fileName) {

        var fileContent = this.loadFile(fileName);

        return yaml.load(fileContent) || {};

    },/*}}}*/
    /** loadConfig ** {{{ Загружаем конфигурацию
     * @param {object} [config] - Дополнительные параметры конфигурации
     */
    loadConfig : function (config) {

        config = config || {};

        // Определяем файл описания конфигурации
        var configFile = config.configFile || this.config.configFile;

        // Расширяем конфигурацию из внешнего файла (если задан и существует) и переданного набора параметров (если передан)
        extend(this.config, this.loadYaml(configFile), config);

    },/*}}}*/

    /** init ** {{{ Инициализация
     * @param {object} [config] - Дополнительные параметры конфигурации
     */
    init : function (config) {

        var that = this,
            undef
        ;

        // Если уже инициализирован...
        if ( this._inited ) {
            return false;
        }

        this._info( 'Инициализация' );

        this.loadConfig(config);

        // Устанавливаем флаг инициализации
        this._inited = true;

    },/*}}}*/

    /** run ** {{{ Запуск в автономном режиме
     * @param {object} [config] - Дополнительные параметры конфигурации
     */
    run : function (config) {

        this.init(config);

        this.loadPages();
        this.parseAndWritePages();
        this.parseAndWriteTemplates();
        this.parseAndWriteBlocks();

    },/*}}}*/

};

// Если подключён, как модуль...
if ( module.parent ) {
    // Экспорт модуля
    module.exports = TemplatesParser;
}
// Если запущен автономно...
else {
    TemplatesParser.run({
        configFile : 'sample_config.yaml',
        debugLevel: 5,
    });
}
