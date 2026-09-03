'use strict';

const assert = require('assert');
const { createFakeDomEnvironment } = require('../scripts/lib/fake-dom');

const GENERATIVE_UI_DESCRIPTION =
    'How to render rich interactive HTML widgets inline in the chat or as standalone artifacts. ' +
    'Use this skill when you want to show the user diagrams, data visualizations, interactive controls, ' +
    'educational walkthroughs, or any rich visual content beyond plain text and markdown.';

function runRendererRegression(generatedSource) {
    const dom = createFakeDomEnvironment(generatedSource);
    const { element, text, mount, dispatchAdded, dispatchCharacterData, reset } = dom;
    let assertions = 0;

    function equal(actual, expected, message) {
        assert.strictEqual(actual, expected, message);
        assertions++;
    }

    function same(actual, expected, message) {
        assert.strictEqual(actual, expected, message);
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

    // 1. Static dictionary smoke cases (2 smoke cases, avoiding shadow dictionary bloat)
    reset();
    const fixedCases = new Map([
        ['Push succeeded', '推送成功'],
        ['  Push  succeeded  ', '推送成功'],
        ['Renamed', '已重命名']
    ]);
    for (const [source, expected] of fixedCases) {
        const node = text(source);
        mount(element('div', node));
        equal(node.nodeValue, expected, `固定词条未正确翻译：${source}`);
    }

    // 2. Dynamic Git cases & tooltips
    reset();
    const dynamicCases = new Map([
        ['Push 1 commit to origin/main', '将 1 个提交推送到 origin/main'],
        ['Push 3 commits to feature/demo', '将 3 个提交推送到 feature/demo'],
        ['Pushed 1 commit to origin/main.', '已将 1 个提交推送到 origin/main。'],
        ['Pushed 3 commits to origin/release.', '已将 3 个提交推送到 origin/release。'],
        ['Committed to main.', '已提交到 main。'],
        ['Commit 1 file change to main', '将 1 个文件的更改提交到 main'],
        ['Commit 4 files changes to feature/demo', '将 4 个文件的更改提交到 feature/demo'],
        ['v2.12.0.json (uncommitted)', 'v2.12.0.json (未提交)'],
        ['src/index.ts (unstaged)', 'src/index.ts (未暂存)'],
        ['README.md (staged)', 'README.md (已暂存)'],
        ['new_file.py (untracked)', 'new_file.py (未跟踪)'],
        ['v2.12.0.json (all agent edits)', 'v2.12.0.json (智能体的所有修改)'],
        ['v2.12.0.json (agent edits)', 'v2.12.0.json (智能体修改)'],
        ['All files (uncommitted)', '所有文件 (未提交)'],
        ['Added (staged)', '已添加 (已暂存)'],
        ['Deleted (unstaged)', '已删除 (未暂存)'],
        ['Modified (staged)', '已修改 (已暂存)'],
        ['Untracked (unstaged)', '未跟踪（未暂存）'],
        ['Untracked (uncommitted)', '未跟踪 (未提交)'],
        ['My Document.docx (uncommitted)', 'My Document.docx (未提交)'],
        ['path with space/file.js (staged)', 'path with space/file.js (已暂存)']
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

    // 3. Commit summary container tests (split, mixed, text arrow, repeat writes, dynamic React updates, siblings, protected)
    reset();
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

    splitCommit.countNode.nodeValue = '1';
    splitCommit.changesNode.nodeValue = 'change';
    dispatchCharacterData(splitCommit.countNode);
    dispatchCharacterData(splitCommit.changesNode);
    equal(splitCommit.row.textContent, '将 1 个文件的更改提交到 dev', 'React 单文件单数 change 恢复后产生残留');
    equal(splitCommit.changesNode.nodeValue, '', '单数 change 碎片未清理');

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
    equal(
        protectedBranchCommit.row.textContent,
        'Commit 4 file changes to protected-branch',
        '受保护分支提交摘要应保持完整英文'
    );

    // 4. Git status negative cases & diagnostics
    reset();
    const gitStatusNegatives = [
        'Please review the changes before continuing (uncommitted)',
        'git commit -m "feat: add feature" (unstaged)',
        'git checkout -b feature/demo (staged)',
        'Ensure all tasks are completed (untracked)'
    ];
    for (const statement of gitStatusNegatives) {
        const node = text(statement);
        mount(element('div', node));
        equal(node.nodeValue, statement, `Git 状态负例不应被翻译：${statement}`);
        equal(node.writeCount, 0, `Git 状态负例不应发生 DOM 写入：${statement}`);
    }

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

    // Network issue error banner & details
    reset();
    const errorTitle = text('Error');
    const errorBody = text('Unknown: There was a network issue connecting to the server, please try again.');
    const errorIdNode = text('Error ID:  5f6d0e51-6a2f-4ab6-b89e-5b37ccb44c71-88');
    const detailBody = text('Unknown: There was a network issue connecting to the server, please try again.');
    const errorCard = element(
        'div',
        element('div', element('span', errorTitle), text(' '), element('span', errorBody)),
        element('div', errorIdNode),
        element('div', detailBody)
    );
    mount(errorCard);
    equal(errorTitle.nodeValue, '错误', '错误卡片标题未翻译');
    equal(errorBody.nodeValue, '未知：连接到服务器时出现网络问题，请重试。', '错误卡片概要消息未翻译');
    equal(errorIdNode.nodeValue, '错误 ID: 5f6d0e51-6a2f-4ab6-b89e-5b37ccb44c71-88', '错误 ID 未正确翻译或保留');
    equal(detailBody.nodeValue, '未知：连接到服务器时出现网络问题，请重试。', '错误卡片详情消息未翻译');

    const singleNodeError = text('Error Unknown: There was a network issue connecting to the server, please try again.');
    mount(element('div', singleNodeError));
    equal(singleNodeError.nodeValue, '错误 未知：连接到服务器时出现网络问题，请重试。', '单节点错误提示未翻译');

    const rawNetworkError = text('There was a network issue connecting to the server, please try again.');
    mount(element('div', rawNetworkError));
    equal(rawNetworkError.nodeValue, '连接到服务器时出现网络问题，请重试。', '纯网络错误消息未翻译');

    // 5. Conversation list & timestamps
    reset();
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

    // 6. Skill selector tests
    reset();
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

    const boostName = text('boost');
    const boostDescription = text('Invoke the Boost multi-agent orchestrator for complex tasks.');
    mount(element('div', element('span', boostName), element('span', boostDescription)));
    equal(boostName.nodeValue, '多智能体编排', 'Boost 技能表面名称未翻译');
    equal(boostDescription.nodeValue, '调用 Boost 多智能体编排器处理复杂任务。', 'Boost 技能表面说明未翻译');

    const internalBoostIdentifier = text('boost');
    mount(element('div', internalBoostIdentifier));
    equal(internalBoostIdentifier.nodeValue, 'boost', '脱离技能选择器的内部 boost 标识被翻译');

    // Sibling topology isolation for skill selector
    const boostRow = element(
        'div',
        element('span', text('boost')),
        element('span', text('Invoke the Boost multi-agent orchestrator for complex tasks.'))
    );
    const genUiRow = element(
        'div',
        element('span', text('generative_ui')),
        element('span', text(GENERATIVE_UI_DESCRIPTION))
    );
    const skillContainer = element('div', boostRow, genUiRow);
    mount(skillContainer);
    equal(boostRow.children[0].textContent, '多智能体编排', '兄弟容器中的 boost 未正确翻译');
    equal(genUiRow.children[0].textContent, '生成式界面', '兄弟容器中的 generative_ui 未正确翻译');

    // Sibling isolation when one sibling is protected
    const protectedBoostRow = element(
        'div',
        element('span', text('boost')),
        element('span', text('Invoke the Boost multi-agent orchestrator for complex tasks.'))
    );
    protectedBoostRow.setAttribute('data-ag-localization-skip', '');
    const activeGenUiRow = element(
        'div',
        element('span', text('generative_ui')),
        element('span', text(GENERATIVE_UI_DESCRIPTION))
    );
    const mixedSkillContainer = element('div', protectedBoostRow, activeGenUiRow);
    mount(mixedSkillContainer);
    equal(protectedBoostRow.children[0].textContent, 'boost', '受保护的 boost 行不应被翻译');
    equal(activeGenUiRow.children[0].textContent, '生成式界面', '受保护兄弟旁的 generative_ui 应正常翻译');

    // User input negative test for skill selectors
    const userBoostInput = text('boost');
    const userBoostContainer = element('div', userBoostInput);
    userBoostContainer.setAttribute('data-testid', 'user-input-step');
    mount(userBoostContainer);
    equal(userBoostInput.nodeValue, 'boost', '用户输入中的 boost 标识符被错误翻译');

    const userGenUiInput = text('generative_ui');
    const userGenUiContainer = element('div', userGenUiInput);
    userGenUiContainer.setAttribute('data-testid', 'user-input-step');
    mount(userGenUiContainer);
    equal(userGenUiInput.nodeValue, 'generative_ui', '用户输入中的 generative_ui 标识符被错误翻译');

    // 7. Monaco suggest-widget & editor tests
    reset();
    // Monaco suggest-widget @mention file search state (ASCII dots)
    const suggestSearchNode = text('Searching...');
    const suggestMessage = element('div', suggestSearchNode);
    suggestMessage.className = 'message';
    const suggestWidget = element('div', suggestMessage);
    suggestWidget.className = 'editor-widget suggest-widget visible';
    const monacoEditor = element('div', suggestWidget);
    monacoEditor.className = 'monaco-editor';
    mount(monacoEditor);
    equal(suggestSearchNode.nodeValue, '正在搜索...', '输入框@文件时的 Searching... 提示未翻译');

    // Monaco suggest-widget @mention file search state (Unicode ellipsis …)
    const suggestEllipsisNode = text('Searching\u2026');
    const suggestEllipsisMessage = element('div', suggestEllipsisNode);
    suggestEllipsisMessage.className = 'message';
    const suggestEllipsisWidget = element('div', suggestEllipsisMessage);
    suggestEllipsisWidget.className = 'editor-widget suggest-widget visible';
    const monacoEllipsisEditor = element('div', suggestEllipsisWidget);
    monacoEllipsisEditor.className = 'monaco-editor';
    mount(monacoEllipsisEditor);
    equal(suggestEllipsisNode.nodeValue, '正在搜索...', '输入框@文件时的 Searching… (Unicode 省略号) 未翻译');

    // Fragmented text nodes: Searching + ...
    const searchingWordNode = text('Searching');
    const searchingDotsNode = text('...');
    const fragmentedMessage = element('div', element('span', searchingWordNode), element('span', searchingDotsNode));
    fragmentedMessage.className = 'message';
    const fragmentedWidget = element('div', fragmentedMessage);
    fragmentedWidget.className = 'editor-widget suggest-widget visible';
    mount(fragmentedWidget);
    equal(searchingWordNode.nodeValue, '正在搜索...', '碎片化 Searching 节点未翻译');
    equal(searchingDotsNode.nodeValue, '', '碎片化省略号节点未清空');

    // Search input with placeholder inside blocked editor/mention container
    const searchInput = element('input');
    searchInput.setAttribute('placeholder', 'Searching...');
    const blockedInputContainer = element('div', searchInput);
    blockedInputContainer.className = 'monaco-editor';
    mount(blockedInputContainer);
    equal(searchInput.getAttribute('placeholder'), '正在搜索...', '受保护容器内的搜索输入框 placeholder 未翻译');

    // Code line inside Monaco editor should NOT be translated even if it contains Searching...
    const codeLineNode = text('Searching...');
    const viewLine = element('span', codeLineNode);
    viewLine.className = 'mtk1';
    const editorLine = element('div', viewLine);
    editorLine.className = 'view-line';
    const linesContainer = element('div', editorLine);
    linesContainer.className = 'view-lines';
    const monacoEditorWithCode = element('div', linesContainer);
    monacoEditorWithCode.className = 'monaco-editor';
    mount(monacoEditorWithCode);
    equal(codeLineNode.nodeValue, 'Searching...', '编辑器代码行内的 Searching... 被错误翻译');

    // Search state with whitespace and No suggestions
    const searchSpaceNode = text('Searching ...');
    mount(element('div', searchSpaceNode));
    equal(searchSpaceNode.nodeValue, '正在搜索...', '带空格的 Searching ... 未翻译');

    const noSuggestionsNode = text('No suggestions.');
    mount(element('div', noSuggestionsNode));
    equal(noSuggestionsNode.nodeValue, '无建议。', 'No suggestions. 提示未翻译');

    // 8. Settings overrides indicators (Modified in ...)
    reset();
    // Single project override
    const prefixText = text('Modified in ');
    const projectBtn = element('button', text('antigravity2-win-linux-cn'));
    projectBtn.setAttribute('data-testid', 'artifact-review-overrides-trigger');
    const overrideSpan = element('span', prefixText, projectBtn);
    overrideSpan.className = 'inline-block';
    const settingDesc = element('span', text('智能体是否要求您审查其文档。'), overrideSpan);
    mount(settingDesc);
    equal(prefixText.nodeValue, '修改于 ', '单项目覆写前缀未翻译');
    equal(projectBtn.textContent, 'antigravity2-win-linux-cn', '单项目名称不应被改写');

    // Single project with Untitled project
    const untitledPrefix = text('Modified in ');
    const untitledBtn = element('button', text('Untitled project'));
    untitledBtn.setAttribute('data-testid', 'artifact-review-overrides-trigger');
    const untitledSpan = element('span', untitledPrefix, untitledBtn);
    untitledSpan.className = 'inline-block';
    mount(untitledSpan);
    equal(untitledPrefix.nodeValue, '修改于 ', '无标题项目覆写前缀未翻译');
    equal(untitledBtn.textContent, '无标题项目', 'Untitled project 未翻译为无标题项目');

    // Single project with Outside of Project
    const outsidePrefix = text('Modified in ');
    const outsideBtn = element('button', text('Outside of Project'));
    outsideBtn.setAttribute('data-testid', 'artifact-review-overrides-trigger');
    const outsideSpan = element('span', outsidePrefix, outsideBtn);
    outsideSpan.className = 'inline-block';
    mount(outsideSpan);
    equal(outsidePrefix.nodeValue, '修改于 ', '项目外部覆写前缀未翻译');
    equal(outsideBtn.textContent, '项目外部', 'Outside of Project 未翻译为项目外部');

    // Multi projects override with separate child text nodes
    const multiPrefix = text('Modified in ');
    const countNode = text('2');
    const unitNode = text(' projects');
    const underlineSpan = element('span', countNode, unitNode);
    underlineSpan.className = 'group-hover:underline';
    const icon = element('svg');
    const multiBtn = element('button', underlineSpan, icon);
    multiBtn.setAttribute('data-testid', 'security-preset-overrides-trigger');
    const multiSpan = element('span', multiPrefix, multiBtn);
    multiSpan.className = 'inline-block';
    mount(multiSpan);
    equal(multiPrefix.nodeValue, '修改于 ', '多项目覆写前缀未翻译');
    equal(underlineSpan.textContent, '2 个项目', '多项目 2 projects 未翻译为 2 个项目');

    // Multi projects intermediate state (2项目)
    const semiPrefix = text('Modified in ');
    const semiCountNode = text('2项目');
    const semiUnderline = element('span', semiCountNode);
    semiUnderline.className = 'group-hover:underline';
    const semiSpan = element('span', semiPrefix, element('button', semiUnderline));
    semiSpan.className = 'inline-block';
    mount(semiSpan);
    equal(semiPrefix.nodeValue, '修改于 ', '半汉化多项目前缀未翻译');
    equal(semiUnderline.textContent, '2 个项目', '2项目 未补齐量词为 2 个项目');

    // Also modified in
    const alsoPrefix = text('Also modified in ');
    const alsoBtn = element('button', text('3 workspaces'));
    const alsoSpan = element('span', alsoPrefix, alsoBtn);
    alsoSpan.className = 'inline-block';
    mount(alsoSpan);
    equal(alsoPrefix.nodeValue, '也修改于 ', 'Also modified in 前缀未翻译');
    equal(alsoBtn.textContent, '3 个项目', '3 workspaces 未翻译为 3 个项目');

    // Standalone text nodes
    const singleText = text('Modified in my-workspace');
    mount(element('div', singleText));
    equal(singleText.nodeValue, '修改于 my-workspace', '独立整句 Modified in 未翻译');

    const multiText = text('Modified in 5 projects');
    mount(element('div', multiText));
    equal(multiText.nodeValue, '修改于 5 个项目', '独立整句 Modified in X projects 未翻译');

    const outsideText = text('Modified in Outside of Project');
    mount(element('div', outsideText));
    equal(outsideText.nodeValue, '修改于 项目外部', '独立整句 Modified in Outside of Project 未翻译');

    // 9. Infrastructure & Fake DOM edge cases
    reset();
    // Node.prototype.contains
    const parentContainer = element('div');
    const childContainer = element('span');
    const grandChildContainer = element('b');
    childContainer.append(grandChildContainer);
    parentContainer.append(childContainer);
    const detachedContainer = element('div');
    equal(parentContainer.contains(parentContainer), true, 'contains 自包含判定失败');
    equal(parentContainer.contains(childContainer), true, 'contains 子节点判定失败');
    equal(parentContainer.contains(grandChildContainer), true, 'contains 孙节点判定失败');
    equal(childContainer.contains(parentContainer), false, 'contains 逆向祖先判定错误');
    equal(parentContainer.contains(detachedContainer), false, 'contains 游离节点判定错误');
    equal(parentContainer.contains(null), false, 'contains null 判定错误');

    // Unobserved target isolation: mutation on unmounted/detached node does not trigger observer
    const unmountedText = text('Searching...');
    const unmountedEl = element('div', unmountedText);
    dispatchAdded(unmountedEl);
    equal(unmountedText.nodeValue, 'Searching...', '未挂载到 observed target 的节点被错误触发翻译');
    equal(unmountedText.writeCount, 0, '未挂载到 observed target 的节点发生了 DOM 写入');

    // MutationObserverStormError: cascading mutation depth > 10 throws error
    const stormTarget = element('div');
    mount(stormTarget);
    let stormCount = 0;
    const stormObserver = new dom.MutationObserver(() => {
        stormCount++;
        stormTarget.setAttribute('title', 'cascade-' + stormCount);
    });
    stormObserver.observe(stormTarget, { attributes: true, attributeFilter: ['title'] });
    let caughtStormError = false;
    try {
        stormTarget.setAttribute('title', 'start-storm');
    } catch (e) {
        if (e instanceof dom.MutationObserverStormError) {
            caughtStormError = true;
        }
    }
    equal(caughtStormError, true, '级联变更超过 10 层未抛出 MutationObserverStormError');

    return { assertions };
}

if (require.main === module) {
    const path = require('path');
    const { generateInjection } = require('../scripts/lib/load-engine');
    const rootDir = path.resolve(__dirname, '..');
    const generatedSource = generateInjection(rootDir);
    const result = runRendererRegression(generatedSource);
    console.log(`[通过] 渲染层 DOM 回归测试通过，共 ${result.assertions} 项断言`);
}

module.exports = {
    runRendererRegression
};
