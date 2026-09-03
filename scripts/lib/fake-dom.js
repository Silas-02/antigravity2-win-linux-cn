'use strict';

const vm = require('vm');

class MutationObserverStormError extends Error {
    constructor(message = 'MutationObserver cascading depth exceeded limit of 10') {
        super(message);
        this.name = 'MutationObserverStormError';
    }
}

function createFakeDomEnvironment(generatedSource) {
    const activeObservers = new Set();
    const pendingMutations = [];
    let isFlushing = false;

    const documentListeners = new Map();
    const windowListeners = new Map();

    function addListener(map, type, callback) {
        if (!map.has(type)) {
            map.set(type, new Set());
        }
        map.get(type).add(callback);
    }

    function removeListener(map, type, callback) {
        if (map.has(type)) {
            map.get(type).delete(callback);
        }
    }

    function dispatchEvent(map, type, event) {
        if (map.has(type)) {
            for (const callback of Array.from(map.get(type))) {
                callback(event);
            }
        }
    }

    class FakeNode {
        constructor(nodeType) {
            this.nodeType = nodeType;
            this.parentNode = null;
            this.parentElement = null;
        }

        get previousSibling() {
            if (!this.parentNode?.childNodes) return null;
            const index = this.parentNode.childNodes.indexOf(this);
            return index > 0 ? this.parentNode.childNodes[index - 1] : null;
        }

        get nextSibling() {
            if (!this.parentNode?.childNodes) return null;
            const index = this.parentNode.childNodes.indexOf(this);
            return index >= 0 && index + 1 < this.parentNode.childNodes.length
                ? this.parentNode.childNodes[index + 1]
                : null;
        }

        getRootNode() {
            let current = this;
            while (current.parentNode) current = current.parentNode;
            return current;
        }

        contains(other) {
            if (!other) return false;
            let current = other;
            while (current) {
                if (current === this) return true;
                current = current.parentNode || current.host || null;
            }
            return false;
        }
    }

    FakeNode.ELEMENT_NODE = 1;
    FakeNode.TEXT_NODE = 3;
    FakeNode.DOCUMENT_FRAGMENT_NODE = 11;

    class FakeTextNode extends FakeNode {
        constructor(value) {
            super(FakeNode.TEXT_NODE);
            this._nodeValue = String(value);
            this.writeCount = 0;
        }

        get nodeValue() {
            return this._nodeValue;
        }

        set nodeValue(value) {
            this._nodeValue = String(value);
            this.writeCount++;
        }

        get textContent() {
            return this._nodeValue;
        }

        set textContent(value) {
            this.nodeValue = value;
        }
    }

    class FakeClassList {
        constructor(element) {
            this.element = element;
        }

        contains(value) {
            return this.element.className.split(/\s+/).filter(Boolean).includes(value);
        }

        add(value) {
            const values = new Set(this.element.className.split(/\s+/).filter(Boolean));
            values.add(value);
            this.element.className = Array.from(values).join(' ');
        }
    }

    class FakeElement extends FakeNode {
        constructor(tagName = 'div') {
            super(FakeNode.ELEMENT_NODE);
            this.tagName = String(tagName).toUpperCase();
            this.childNodes = [];
            this.attributes = new Map();
            this.attributeWriteCount = 0;
            this.className = '';
            this.classList = new FakeClassList(this);
            this.shadowRoot = null;
        }

        append(...nodes) {
            for (const node of nodes) {
                node.parentNode = this;
                node.parentElement = this;
                this.childNodes.push(node);
            }
            return this;
        }

        insertBefore(node, referenceNode) {
            const index = this.childNodes.indexOf(referenceNode);
            if (index < 0) return this.append(node);
            node.parentNode = this;
            node.parentElement = this;
            this.childNodes.splice(index, 0, node);
            return node;
        }

        get children() {
            return this.childNodes.filter(node => node.nodeType === FakeNode.ELEMENT_NODE);
        }

        get textContent() {
            return this.childNodes.map(node => node.textContent || '').join('');
        }

        set textContent(value) {
            this.childNodes = [];
            this.append(new FakeTextNode(value));
        }

        hasAttribute(name) {
            return this.attributes.has(name);
        }

        getAttribute(name) {
            if (name === 'class') return this.className || null;
            return this.attributes.has(name) ? this.attributes.get(name) : null;
        }

        setAttribute(name, value) {
            const stringValue = String(value);
            if (name === 'class') this.className = stringValue;
            this.attributes.set(name, stringValue);
            this.attributeWriteCount++;

            queueMutation({
                type: 'attributes',
                target: this,
                attributeName: name
            });
        }

        matches(selectors) {
            return String(selectors).split(',').some(selector => {
                const value = selector.trim();
                if (!value) return false;
                if (/^[a-z]+$/i.test(value)) return this.tagName === value.toUpperCase();
                const roleMatch = value.match(/^\[role=["']?([^"'\]]+)["']?\]$/i);
                if (roleMatch) return this.getAttribute('role') === roleMatch[1];
                const attributeMatch = value.match(/^\[([^\]]+)\]$/);
                return attributeMatch ? this.hasAttribute(attributeMatch[1]) : false;
            });
        }

        querySelectorAll(selector) {
            if (selector !== '*') return [];
            const result = [];
            const visit = node => {
                if (node.nodeType !== FakeNode.ELEMENT_NODE) return;
                result.push(node);
                for (const child of node.childNodes) visit(child);
            };
            for (const child of this.childNodes) visit(child);
            return result;
        }

        attachShadow() {
            const fragment = new FakeDocumentFragment(this);
            this.shadowRoot = fragment;
            return fragment;
        }
    }

    class FakeDocumentFragment extends FakeNode {
        constructor(host) {
            super(FakeNode.DOCUMENT_FRAGMENT_NODE);
            this.host = host;
            this.childNodes = [];
        }

        append(...nodes) {
            for (const node of nodes) {
                node.parentNode = this;
                node.parentElement = null;
                this.childNodes.push(node);
            }
            return this;
        }
    }

    class FakeMutationObserver {
        constructor(callback) {
            this.callback = callback;
            this.observedTargets = new Map();
            activeObservers.add(this);
        }

        observe(target, options = {}) {
            this.observedTargets.set(target, {
                childList: Boolean(options.childList),
                subtree: Boolean(options.subtree),
                attributes: Boolean(options.attributes),
                characterData: Boolean(options.characterData),
                attributeFilter: options.attributeFilter ? Array.from(options.attributeFilter) : null
            });
        }

        disconnect() {
            this.observedTargets.clear();
            activeObservers.delete(this);
        }

        takeRecords() {
            return [];
        }
    }

    function isRecordObservedBy(observer, record) {
        for (const [target, options] of observer.observedTargets) {
            const recordTarget = record.target;
            if (!recordTarget) continue;
            const isTargetOrDescendant = (target === recordTarget) ||
                (Boolean(options.subtree) && target.contains(recordTarget));
            if (!isTargetOrDescendant) continue;

            if (record.type === 'childList') {
                if (options.childList) return true;
            } else if (record.type === 'characterData') {
                if (options.characterData) return true;
            } else if (record.type === 'attributes') {
                if (!options.attributes) return false;
                if (options.attributeFilter && !options.attributeFilter.includes(record.attributeName)) {
                    return false;
                }
                return true;
            }
        }
        return false;
    }

    function queueMutation(record) {
        let anyObserved = false;
        for (const observer of activeObservers) {
            if (isRecordObservedBy(observer, record)) {
                anyObserved = true;
                break;
            }
        }
        if (!anyObserved) return;

        pendingMutations.push(record);
        if (!isFlushing) {
            flushMutations();
        }
    }

    function flushMutations() {
        isFlushing = true;
        try {
            let depth = 0;
            while (pendingMutations.length > 0) {
                depth++;
                if (depth > 10) {
                    pendingMutations.length = 0;
                    throw new MutationObserverStormError('MutationObserver cascading depth exceeded limit of 10');
                }
                const currentBatch = pendingMutations.splice(0, pendingMutations.length);
                for (const observer of activeObservers) {
                    const recordsForObserver = currentBatch.filter(record => isRecordObservedBy(observer, record));
                    if (recordsForObserver.length > 0) {
                        observer.callback(recordsForObserver, observer);
                    }
                }
            }
        } finally {
            isFlushing = false;
        }
    }

    const html = new FakeElement('html');
    const body = new FakeElement('body');
    html.append(body);

    const document = {
        readyState: 'loading',
        body,
        documentElement: html,
        createTextNode(value) {
            return new FakeTextNode(value);
        },
        addEventListener(type, callback) {
            addListener(documentListeners, type, callback);
        },
        removeEventListener(type, callback) {
            removeListener(documentListeners, type, callback);
        }
    };

    const window = {
        addEventListener(type, callback) {
            addListener(windowListeners, type, callback);
        },
        removeEventListener(type, callback) {
            removeListener(windowListeners, type, callback);
        }
    };

    const sandbox = {
        document,
        window,
        MutationObserver: FakeMutationObserver,
        Element: FakeElement,
        Node: FakeNode,
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Map,
        Set,
        WeakMap,
        WeakSet,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        TypeError,
        RangeError,
        Math,
        Date,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        decodeURI,
        decodeURIComponent,
        encodeURI,
        encodeURIComponent
    };
    sandbox.window.window = sandbox.window;
    sandbox.window.document = document;
    sandbox.window.MutationObserver = FakeMutationObserver;
    sandbox.window.Element = FakeElement;
    sandbox.window.Node = FakeNode;

    const context = vm.createContext(sandbox);
    const script = new vm.Script(generatedSource, { filename: 'generated-localization-injection.js' });
    script.runInContext(context);

    if (activeObservers.size === 0) {
        throw new Error('生成的注入代码没有注册 MutationObserver');
    }

    function triggerDOMContentLoaded() {
        document.readyState = 'interactive';
        dispatchEvent(documentListeners, 'DOMContentLoaded', { type: 'DOMContentLoaded' });
        document.readyState = 'complete';
        dispatchEvent(windowListeners, 'load', { type: 'load' });
    }

    // Trigger DOMContentLoaded immediately after injection to ensure startEngine() registers document.body to the observer
    triggerDOMContentLoaded();

    function dispatchAdded(node) {
        const target = node.parentNode || null;
        queueMutation({
            type: 'childList',
            target,
            addedNodes: [node],
            removedNodes: []
        });
    }

    function dispatchCharacterData(node) {
        queueMutation({
            type: 'characterData',
            target: node
        });
    }

    function dispatchAttributes(node, attributeName) {
        queueMutation({
            type: 'attributes',
            target: node,
            attributeName
        });
    }

    function mount(node) {
        body.append(node);
        dispatchAdded(node);
        return node;
    }

    function reset() {
        pendingMutations.length = 0;
        for (const child of Array.from(body.childNodes)) {
            child.parentNode = null;
            child.parentElement = null;
        }
        body.childNodes = [];
        body.className = '';
        body.attributes.clear();
        body.attributeWriteCount = 0;
        return api;
    }

    const api = {
        FakeDocumentFragment,
        FakeElement,
        FakeMutationObserver,
        FakeNode,
        FakeTextNode,
        MutationObserver: FakeMutationObserver,
        MutationObserverStormError,
        Node: FakeNode,
        body,
        dispatchAdded,
        dispatchAttributes,
        dispatchCharacterData,
        document,
        element(tagName, ...children) {
            return new FakeElement(tagName).append(...children);
        },
        mount,
        reset,
        text(value) {
            return new FakeTextNode(value);
        },
        triggerDOMContentLoaded,
        windowListeners
    };

    return api;
}

module.exports = {
    MutationObserverStormError,
    createFakeDomEnvironment
};
