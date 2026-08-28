'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MAIN_CALL_PATTERN = /\nmain\(\);\s*$/;

function loadGenerateJs(rootDir) {
    const enginePath = path.join(rootDir, 'localization_engine.js');
    const source = fs.readFileSync(enginePath, 'utf8');
    if (!MAIN_CALL_PATTERN.test(source)) {
        throw new Error('无法安全隔离 localization_engine.js 的最终 main() 调用');
    }

    const nonInstallingSource = source.replace(
        MAIN_CALL_PATTERN,
        '\nmodule.exports = { generateJs };\n'
    );
    const moduleBox = { exports: {} };
    const evaluateModule = new Function(
        'require',
        'module',
        'exports',
        '__dirname',
        '__filename',
        nonInstallingSource
    );
    evaluateModule(require, moduleBox, moduleBox.exports, rootDir, enginePath);

    if (typeof moduleBox.exports.generateJs !== 'function') {
        throw new Error('未能从 localization_engine.js 获取 generateJs()');
    }
    return moduleBox.exports.generateJs;
}

function generateInjection(rootDir) {
    const generateJs = loadGenerateJs(rootDir);
    const generatedSource = generateJs();
    if (typeof generatedSource !== 'string' || generatedSource.length === 0) {
        throw new Error('generateJs() 没有生成有效的注入代码');
    }
    return generatedSource;
}

function compileJavaScript(source, filename) {
    new vm.Script(source, { filename });
}

module.exports = {
    compileJavaScript,
    generateInjection,
    loadGenerateJs
};
