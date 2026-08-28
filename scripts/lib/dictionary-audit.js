'use strict';

const fs = require('fs');
const path = require('path');

function normalizeDictionaryText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"');
}

function extractTopLevelObjectKeys(source) {
    const keys = [];
    let depth = 0;
    let expectingKey = false;

    function readString(start) {
        let escaped = false;
        for (let index = start + 1; index < source.length; index++) {
            const character = source[index];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (character === '\\') {
                escaped = true;
                continue;
            }
            if (character === '"') {
                return {
                    end: index,
                    value: JSON.parse(source.slice(start, index + 1))
                };
            }
        }
        throw new Error('JSON 字符串没有结束引号');
    }

    for (let index = 0; index < source.length; index++) {
        const character = source[index];
        if (/\s/.test(character)) continue;
        if (character === '"') {
            const parsed = readString(index);
            if (depth === 1 && expectingKey) {
                keys.push(parsed.value);
                expectingKey = false;
            }
            index = parsed.end;
            continue;
        }
        if (character === '{' || character === '[') {
            depth++;
            if (depth === 1 && character === '{') expectingKey = true;
            continue;
        }
        if (character === '}' || character === ']') {
            depth--;
            continue;
        }
        if (character === ',' && depth === 1) {
            expectingKey = true;
        }
    }
    return keys;
}

function auditDictionaries(rootDir) {
    const dictsDir = path.join(rootDir, 'dicts');
    if (!fs.existsSync(dictsDir)) {
        return {
            files: [],
            versionFiles: [],
            entries: 0,
            issues: [`字典目录不存在：${dictsDir}`]
        };
    }

    const files = fs.readdirSync(dictsDir)
        .filter(file => file.endsWith('.json'))
        .sort();
    const versionFiles = files.filter(file => /^v\d+\.\d+\.\d+\.json$/.test(file));
    const normalizedKeys = new Map();
    const caseFoldedKeys = new Map();
    const issues = [];
    let entries = 0;

    for (const file of files) {
        const filePath = path.join(dictsDir, file);
        const source = fs.readFileSync(filePath, 'utf8');
        let dictionary;
        try {
            dictionary = JSON.parse(source);
        } catch (error) {
            issues.push(`${file} 不是有效 JSON：${error.message}`);
            continue;
        }

        if (!dictionary || Array.isArray(dictionary) || typeof dictionary !== 'object') {
            issues.push(`${file} 的顶层值必须是 JSON 对象`);
            continue;
        }

        const rawKeys = extractTopLevelObjectKeys(source);
        const rawKeyCounts = new Map();
        for (const key of rawKeys) {
            rawKeyCounts.set(key, (rawKeyCounts.get(key) || 0) + 1);
        }
        for (const [key, count] of rawKeyCounts) {
            if (count > 1) {
                issues.push(`${file} 重复定义了 ${count} 次原始键：${JSON.stringify(key)}`);
            }
        }

        for (const [source, translation] of Object.entries(dictionary)) {
            entries++;
            const record = { file, source, translation };
            const normalizedSource = normalizeDictionaryText(source);

            if (!normalizedSource) {
                issues.push(`${file} 包含空英文键`);
                continue;
            }
            if (typeof translation !== 'string') {
                issues.push(`${file}: ${JSON.stringify(source)} 的译文不是字符串`);
                continue;
            }
            if (!translation.trim()) {
                issues.push(`${file}: ${JSON.stringify(source)} 的译文为空`);
            }

            const normalizedDuplicate = normalizedKeys.get(normalizedSource);
            if (normalizedDuplicate) {
                issues.push(
                    `规范化重复：${normalizedDuplicate.file}: ${JSON.stringify(normalizedDuplicate.source)} ` +
                    `与 ${file}: ${JSON.stringify(source)}`
                );
            } else {
                normalizedKeys.set(normalizedSource, record);
            }

            const foldedSource = normalizedSource.toLowerCase();
            const caseDuplicate = caseFoldedKeys.get(foldedSource);
            if (caseDuplicate && normalizeDictionaryText(caseDuplicate.source) !== normalizedSource) {
                issues.push(
                    `大小写冲突：${caseDuplicate.file}: ${JSON.stringify(caseDuplicate.source)} ` +
                    `与 ${file}: ${JSON.stringify(source)}`
                );
            } else if (!caseDuplicate) {
                caseFoldedKeys.set(foldedSource, record);
            }

            if (normalizedSource === normalizeDictionaryText(translation)) {
                issues.push(`${file}: ${JSON.stringify(source)} 的原文与译文相同`);
            }
        }
    }

    if (files.length === 0) {
        issues.push('dicts/ 中没有 JSON 字典');
    }
    if (versionFiles.length !== 1) {
        issues.push(
            `必须且只能存在一个版本字典，当前检测到：${versionFiles.length ? versionFiles.join(', ') : '无'}`
        );
    }

    return {
        files,
        versionFiles,
        entries,
        issues
    };
}

module.exports = {
    auditDictionaries,
    extractTopLevelObjectKeys,
    normalizeDictionaryText
};
