'use strict';

const assert = require('assert');
const { createFakeDomEnvironment } = require('../scripts/lib/fake-dom');

const GENERATIVE_UI_DESCRIPTION =
    'How to render rich interactive HTML widgets inline in the chat or as standalone artifacts. ' +
    'Use this skill when you want to show the user diagrams, data visualizations, interactive controls, ' +
    'educational walkthroughs, or any rich visual content beyond plain text and markdown.';

function runRendererRegression(generatedSource) {
    const dom = createFakeDomEnvironment(generatedSource);
    const { element, text, mount, dispatchAdded, dispatchCharacterData } = dom;
    let assertions = 0;

    function equal(actual, expected, message) {
        assert.strictEqual(actual, expected, message);
        assertions++;
    }

    function same(actual, expected, message) {
        assert.strictEqual(actual, expected, message);
        assertions++;
    }

    function notEqual(actual, expected, message) {
        assert.notStrictEqual(actual, expected, message);
        assertions++;
    }

    function makeCommitRow({ mixed = false, count = '4', branch = 'main', textualArrow = false } = {}) {
        const prefixNode = text(mixed ? '提交' : 'Commit ');
        const countNode = text(count);
        const fileNode = text(mixed ? ' 个文件 ' : ' file ');
        const changesNode = text(mixed ? '更改 ' : 'changes ');
        const toNode = text('to ');
        const arrowNode = textualArrow ? text('↗') : element('svg');
        arrowNode.clickHandler = () => 'preserved';
        const branchNode = text(branch);
        const row = element(
            'div',
            prefixNode,
            countNode,
            fileNode,
            changesNode,
            toNode,
            arrowNode,
            element('span', branchNode)
        );
        return {
            row,
            prefixNode,
            countNode,
            fileNode,
            changesNode,
            toNode,
            arrowNode,
            branchNode
        };
    }

    const fixedCases = new Map([
        ['At mention code block', '使用 @ 提及代码块'],
        ['(all agent edits)', '（智能体的所有修改）'],
        ['File not found', '未找到文件'],
        ['Conversation unavailable', '会话不可用'],
        ['The conversation could not be loaded because its data was not found.', '找不到该会话的数据，因此无法加载。'],
        ['Push succeeded', '推送成功'],
        ['Pushing...', '正在推送...'],
        ['Commit succeeded', '提交成功'],
        ['Failed to Commit', '提交失败'],
        ['Generating commit message...', '正在生成提交信息...'],
        ['Include unstaged changes', '包含未暂存的更改']
    ]);
    for (const [source, expected] of fixedCases) {
        const node = text(source);
        mount(element('div', node));
        equal(node.nodeValue, expected, `固定词条未正确翻译：${source}`);
    }

    const dynamicCases = new Map([
        ['Push 1 commit to origin/main', '将 1 个提交推送到 origin/main'],
        ['Push 3 commits to feature/demo', '将 3 个提交推送到 feature/demo'],
        ['Pushed 1 commit to origin/main.', '已将 1 个提交推送到 origin/main。'],
        ['Pushed 3 commits to origin/release.', '已将 3 个提交推送到 origin/release。'],
        ['Committed to main.', '已提交到 main。'],
        ['Commit 1 file change to main', '将 1 个文件的更改提交到 main'],
        ['Commit 4 files changes to feature/demo', '将 4 个文件的更改提交到 feature/demo']
    ]);
    for (const [source, expected] of dynamicCases) {
        const node = text(source);
        mount(element('div', node));
        equal(node.nodeValue, expected, `动态 Git 文本未正确翻译：${source}`);
    }

    const tooltip = element('button');
    tooltip.setAttribute('title', 'Push 1 commit to origin/main');
    mount(tooltip);
    equal(tooltip.getAttribute('title'), '将 1 个提交推送到 origin/main', 'Git tooltip 未翻译');

    const commitInput = element('textarea');
    commitInput.setAttribute('placeholder', 'Describe your changes, or leave empty to auto-generate');
    mount(element('div', commitInput));
    equal(commitInput.getAttribute('placeholder'), '描述您的更改，或留空以自动生成', '提交说明占位符未翻译');

    const splitCommit = makeCommitRow();
    const originalArrow = splitCommit.arrowNode;
    const originalClickHandler = splitCommit.arrowNode.clickHandler;
    mount(splitCommit.row);
    equal(splitCommit.row.textContent, '将 4 个文件的更改提交到 main', '拆分提交摘要未重排');
    equal(splitCommit.branchNode.nodeValue, 'main', '分支名被修改');
    same(splitCommit.row.childNodes[5], originalArrow, '箭头节点被替换');
    same(splitCommit.arrowNode.clickHandler, originalClickHandler, '箭头事件处理器丢失');

    const mixedCommit = makeCommitRow({ mixed: true, branch: 'release/v2' });
    mount(mixedCommit.row);
    equal(mixedCommit.row.textContent, '将 4 个文件的更改提交到 release/v2', '中英混合提交摘要未修复');

    const textArrowCommit = makeCommitRow({ textualArrow: true, branch: 'topic/a' });
    mount(textArrowCommit.row);
    equal(textArrowCommit.row.textContent, '将 4 个文件的更改提交到 ↗topic/a', '文本箭头未保留');
    equal(textArrowCommit.arrowNode.nodeValue, '↗', '文本箭头被修改');

    const writesBeforeRepeat = splitCommit.prefixNode.writeCount +
        splitCommit.countNode.writeCount +
        splitCommit.fileNode.writeCount +
        splitCommit.changesNode.writeCount +
        splitCommit.toNode.writeCount +
        splitCommit.branchNode.writeCount;
    dispatchAdded(splitCommit.row);
    const writesAfterRepeat = splitCommit.prefixNode.writeCount +
        splitCommit.countNode.writeCount +
        splitCommit.fileNode.writeCount +
        splitCommit.changesNode.writeCount +
        splitCommit.toNode.writeCount +
        splitCommit.branchNode.writeCount;
    equal(writesAfterRepeat, writesBeforeRepeat, '重复处理产生了同值 DOM 写入');

    splitCommit.countNode.nodeValue = '7';
    dispatchCharacterData(splitCommit.countNode);
    equal(splitCommit.row.textContent, '将 7 个文件的更改提交到 main', 'React 数量更新未修复');
    equal(splitCommit.countNode.nodeValue, '', 'React 数量碎片未清理');

    splitCommit.toNode.nodeValue = 'to ';
    dispatchCharacterData(splitCommit.toNode);
    equal(splitCommit.row.textContent, '将 7 个文件的更改提交到 main', 'React 英文连接词恢复后未修复');
    equal(splitCommit.toNode.nodeValue, '', '恢复的英文连接词未清理');

    splitCommit.branchNode.nodeValue = 'dev';
    dispatchCharacterData(splitCommit.branchNode);
    equal(splitCommit.row.textContent, '将 7 个文件的更改提交到 dev', '动态分支名更新被破坏');

    const siblingA = makeCommitRow({ count: '2', branch: 'main' });
    const siblingB = makeCommitRow({ count: '5', branch: 'dev' });
    mount(element('section', siblingA.row, siblingB.row));
    equal(siblingA.row.textContent, '将 2 个文件的更改提交到 main', '第一个兄弟提交行翻译错误');
    equal(siblingB.row.textContent, '将 5 个文件的更改提交到 dev', '第二个兄弟提交行翻译错误');

    const protectedCommit = makeCommitRow({ branch: 'secret-branch' });
    protectedCommit.row.setAttribute('data-ag-localization-skip', '');
    mount(protectedCommit.row);
    equal(protectedCommit.row.textContent, 'Commit 4 file changes to secret-branch', '显式禁区被翻译');

    const protectedBranchCommit = makeCommitRow({ branch: 'protected-branch' });
    protectedBranchCommit.row.children.at(-1).setAttribute('data-ag-localization-skip', '');
    mount(protectedBranchCommit.row);
    equal(protectedBranchCommit.branchNode.nodeValue, 'protected-branch', '受保护分支名被修改');
    notEqual(
        protectedBranchCommit.row.textContent,
        '将 4 个文件的更改提交到 protected-branch',
        '结构规则跨受保护边界合并了整句'
    );

    const gitDiagnostic =
        'Git commit failed: exit status 1. output: On branch main. ' +
        'Your branch is up to date with origin/main. Changes not staged for commit: ' +
        'use "git add <file>" or "git restore <file>". modified: dicts/common.json ' +
        '(error ID: 49df89a318cf4b1e8d27c2b8084a0c4c)';
    const diagnosticNode = text(gitDiagnostic);
    mount(element('div', diagnosticNode));
    equal(diagnosticNode.nodeValue, gitDiagnostic, '嵌入式 Git 诊断正文被翻译');
    equal(diagnosticNode.writeCount, 0, '嵌入式 Git 诊断正文发生 DOM 写入');

    const longerFailure = text('Failed to Commit changes');
    mount(element('div', longerFailure));
    equal(longerFailure.nodeValue, 'Failed to Commit changes', '固定标题误匹配了更长文本');

    const protectedUserText = text('Failed to Commit');
    const protectedUserHost = element('div', protectedUserText);
    protectedUserHost.setAttribute('data-testid', 'user-input-step');
    mount(protectedUserHost);
    equal(protectedUserText.nodeValue, 'Failed to Commit', '用户消息中的固定标题被翻译');

    const recentNode = text('Recent in Test');
    const nowNode = text('now');
    const timestamp = element('span', nowNode);
    timestamp.className = 'text-xs muted';
    const conversationList = element(
        'section',
        element('h3', recentNode),
        element('div', text('Example conversation '), timestamp)
    );
    conversationList.className = 'conversation-list';
    mount(conversationList);
    equal(recentNode.nodeValue, 'Test 中的近期会话', '动态项目近期会话标题未翻译');
    equal(nowNode.nodeValue, '刚刚', '会话时间戳 now 未翻译');

    const standaloneNow = text('now');
    mount(element('span', standaloneNow));
    equal(standaloneNow.nodeValue, 'now', '普通正文中的 now 被全局翻译');

    const skillName = text('generative_ui');
    const skillDescription = text(GENERATIVE_UI_DESCRIPTION);
    mount(element('div', element('span', skillName), element('span', skillDescription)));
    equal(skillName.nodeValue, '生成式界面', '技能表面名称未翻译');
    equal(
        skillDescription.nodeValue,
        '介绍如何在会话中以内嵌方式呈现丰富的交互式 HTML 小组件，或将其作为独立交付件呈现。' +
        '当您需要向用户展示图示、数据可视化、交互控件、教学演示，或任何超出纯文本和 Markdown 范畴的丰富可视化内容时，请使用此技能。',
        '技能表面说明未翻译'
    );

    const internalSkillIdentifier = text('generative_ui');
    mount(element('div', internalSkillIdentifier));
    equal(internalSkillIdentifier.nodeValue, 'generative_ui', '脱离技能选择器的内部标识被翻译');

    return { assertions };
}

module.exports = {
    runRendererRegression
};
