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

function extractPlaceholders(text) {
    const matches = [];
    const printfMatches = text.match(/%(?:\d+\$)?[sdf]/g);
    if (printfMatches) matches.push(...printfMatches);
    const doubleBraceMatches = text.match(/\{\{[a-zA-Z0-9_-]+\}\}/g);
    if (doubleBraceMatches) matches.push(...doubleBraceMatches);
    const singleBraceMatches = text.match(/(?<!\{)\{[a-zA-Z0-9_-]+\}(?!\})/g);
    if (singleBraceMatches) matches.push(...singleBraceMatches);
    return matches.sort();
}

function checkPlaceholderSymmetry(source, translation) {
    const src = extractPlaceholders(source);
    const dst = extractPlaceholders(translation);
    if (src.join(',') !== dst.join(',')) {
        return [`占位符不匹配：原文 [${src.join(', ')}] 与译文 [${dst.join(', ')}]`];
    }
    return [];
}

function checkPunctuationMatching(source, translation) {
    const issues = [];
    const trimmedSource = source.trim();
    const trimmedTranslation = translation.trim();

    const ellipsisPattern = /(?:\.{3,}|…|……|\.\s*\.\s*\.)$/;
    const srcHasEllipsis = ellipsisPattern.test(trimmedSource);
    const dstHasEllipsis = ellipsisPattern.test(trimmedTranslation);
    if (srcHasEllipsis !== dstHasEllipsis) {
        issues.push(`省略号不匹配：原文末尾${srcHasEllipsis ? '有' : '无'}省略号，译文末尾${dstHasEllipsis ? '有' : '无'}省略号`);
    }

    const colonPattern = /[:：]\s*$/;
    const srcHasColon = colonPattern.test(trimmedSource);
    const dstHasColon = colonPattern.test(trimmedTranslation);
    if (srcHasColon && !dstHasColon) {
        issues.push('冒号不匹配：原文末尾有冒号，译文末尾缺少冒号');
    }

    const questionPattern = /[?？]\s*$/;
    const srcHasQuestion = questionPattern.test(trimmedSource);
    const dstHasQuestion = questionPattern.test(trimmedTranslation);
    if (srcHasQuestion !== dstHasQuestion) {
        issues.push(`问号不匹配：原文末尾${srcHasQuestion ? '有' : '无'}问号，译文末尾${dstHasQuestion ? '有' : '无'}问号`);
    }

    const exclamationPattern = /[!！]\s*$/;
    const srcHasExclamation = exclamationPattern.test(trimmedSource);
    const dstHasExclamation = exclamationPattern.test(trimmedTranslation);
    if (srcHasExclamation !== dstHasExclamation) {
        issues.push(`感叹号不匹配：原文末尾${srcHasExclamation ? '有' : '无'}感叹号，译文末尾${dstHasExclamation ? '有' : '无'}感叹号`);
    }

    return issues;
}

function checkTerminology(source, translation) {
    const issues = [];
    if (/\bagents?\b/i.test(source) && !/user-agent|proxy/i.test(source)) {
        if (/代理/.test(translation)) {
            issues.push('agent 术语违规（使用了“代理”，应为“智能体”）');
        }
        if (/[\u4e00-\u9fa5]/.test(translation) && /\bAgents?\b/.test(translation) && !/User-Agent|Subagent/i.test(translation)) {
            issues.push('agent 术语未翻译（残留“Agent”，应为“智能体”）');
        }
    }
    if (/\bworkspaces?\b/i.test(source) && !/\bprojects?\b/i.test(source)) {
        if (/项目/.test(translation)) {
            issues.push('workspace 术语混淆（译文中包含“项目”，应为“工作区”）');
        }
        if (/工作空间/.test(translation)) {
            issues.push('workspace 术语违规（使用了“工作空间”，应为“工作区”）');
        }
    }
    if (/\bprojects?\b/i.test(source) && !/\bworkspaces?\b/i.test(source)) {
        if (/工作区/.test(translation)) {
            issues.push('project 术语混淆（译文中包含“工作区”，应为“项目”）');
        }
        if (/工程/.test(translation)) {
            issues.push('project 术语违规（使用了“工程”，应为“项目”）');
        }
    }
    if (/\bworktrees?\b/i.test(source)) {
        if (/工作区/.test(translation)) {
            issues.push('worktree 术语混淆（译文中包含“工作区”，应为“工作树”）');
        }
    }
    if (/\bartifacts?\b/i.test(source) && !/build artifact/i.test(source)) {
        if (/工件|制品/.test(translation) && !/人工件/.test(translation)) {
            issues.push('artifact 术语违规（使用了“工件/制品”，应为“交付件”）');
        }
    }
    return issues;
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

            const placeholderIssues = checkPlaceholderSymmetry(source, translation);
            for (const issue of placeholderIssues) {
                issues.push(`${file}: ${JSON.stringify(source)} -> ${issue}`);
            }

            const punctuationIssues = checkPunctuationMatching(source, translation);
            for (const issue of punctuationIssues) {
                issues.push(`${file}: ${JSON.stringify(source)} -> ${issue}`);
            }

            const terminologyIssues = checkTerminology(source, translation);
            for (const issue of terminologyIssues) {
                issues.push(`${file}: ${JSON.stringify(source)} -> ${issue}`);
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
    checkPlaceholderSymmetry,
    checkPunctuationMatching,
    checkTerminology,
    extractPlaceholders,
    extractTopLevelObjectKeys,
    normalizeDictionaryText
};
