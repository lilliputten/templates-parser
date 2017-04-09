// ex: set commentstring=/*%s*/ :
/* jshint camelcase: false, unused: false, expr: true */

var
    should = require('chai').should(),
    TemplatesParser = require('../index'),
    undef
;

// Инициализируем модуль
TemplatesParser.init({
    configFile : 'sample_config.yaml',
    debugLevel: 5,
});

/*{{{ Тестовый метод */describe('testMethod', function() {

    it('returns "test ok"', function() {
        TemplatesParser.testMethod().should.equal('test ok');
    });

});/*}}}*/
/*{{{ Функция экранирования строк */describe('_strQuote', function() {

    it('simple quote', function() {
        TemplatesParser._strQuote('text').should.equal('"text"');
    });

    it('quote newline', function() {
        TemplatesParser._strQuote('\n').should.equal('"\\n"');
    });

    it('quote escaped', function() {
        TemplatesParser._strQuote('"', '').should.equal('\"');
    });

    it('quote bracket', function() {
        TemplatesParser._strQuote('()', '(').should.equal('(\\(\\))');
    });

    it('special quote', function() {
        TemplatesParser._strQuote('text', '("').should.equal('("text")');
    });

    it('skip trim', function() {
        var str = '0123456789';
        TemplatesParser._strQuote(str, '', str.length).should.equal(str);
    });

    it('trim 5', function() {
        TemplatesParser._strQuote('0123456789', '', 5).should.equal('01...');
    });

});/*}}}*/
/*{{{ Функция восстановления аттрибутов data-bem */describe('_repairDataBem', function() {

    it('repair', function() {
        // TemplatesParser._repairDataBem('data-bem="{" page":{"mode":"inject"}}"=""').should.equal('data-bem=\'{"page":{"mode":"inject"}}\'');
        TemplatesParser._repairDataBem('data-bem="{&quot;page&quot;:{&quot;mode&quot;:&quot;inject&quot;}}"').should.equal('data-bem=\'{"page":{"mode":"inject"}}\'');
    });

});/*}}}*/

