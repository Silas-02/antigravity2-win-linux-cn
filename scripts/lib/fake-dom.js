'use strict';

function createFakeDomEnvironment(generatedSource) {
    let observerCallback = null;
    const documentListeners = new Map();
    const windowListeners = new Map();

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
    }

    class FakeTextNode extends FakeNode {
        constructor(value) {
            super(3);
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
            super(1);
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
            return this.childNodes.filter(node => node.nodeType === 1);
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
                if (node.nodeType !== 1) return;
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
            super(11);
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
            observerCallback = callback;
        }

        observe() {}
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
            documentListeners.set(type, callback);
        }
    };
    const window = {
        addEventListener(type, callback) {
            windowListeners.set(type, callback);
        }
    };
    const Node = {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3,
        DOCUMENT_FRAGMENT_NODE: 11
    };

    const executeInjection = new Function(
        'document',
        'window',
        'MutationObserver',
        'Element',
        'Node',
        generatedSource
    );
    executeInjection(document, window, FakeMutationObserver, FakeElement, Node);
    if (typeof observerCallback !== 'function') {
        throw new Error('生成的注入代码没有注册 MutationObserver');
    }

    function dispatchAdded(node) {
        observerCallback([{ type: 'childList', addedNodes: [node] }]);
    }

    function dispatchCharacterData(node) {
        observerCallback([{ type: 'characterData', target: node }]);
    }

    function dispatchAttributes(node) {
        observerCallback([{ type: 'attributes', target: node }]);
    }

    function mount(node) {
        body.append(node);
        dispatchAdded(node);
        return node;
    }

    function triggerDOMContentLoaded() {
        documentListeners.get('DOMContentLoaded')?.();
    }

    return {
        FakeDocumentFragment,
        FakeElement,
        FakeTextNode,
        body,
        dispatchAdded,
        dispatchAttributes,
        dispatchCharacterData,
        document,
        element(tagName, ...children) {
            return new FakeElement(tagName).append(...children);
        },
        mount,
        text(value) {
            return new FakeTextNode(value);
        },
        triggerDOMContentLoaded,
        windowListeners
    };
}

module.exports = {
    createFakeDomEnvironment
};
