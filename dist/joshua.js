(function () {
	'use strict';

	/**
	* A minimal compiler that interpret follow
	* Inline Action Expression(IAE):
	* 	 "add(1, 2);delay(100, fn: plus(3, 1))"
	* to JavaScript runtime code:
	*    add(1, 2)
	*    delay(100, function() {
	*        plus(3, 1)
	*    })
	*/
	function tokenizer(input) {
		let current = 0;
		let tokens = [];

		while (current < input.length) {

			let char = input[current];

			if (char === "'") {
				let value = '';
				current++;
				char = input[current];
				while(char !== "'") {
					value += char;
					current++;
					char = input[current];
				}
				tokens.push({
					type: 'string',
					value: value
				});
				current++;
				continue
			}

			if (char === '(') {
				tokens.push({
					type: 'paren',
					value: '('
				});
				current++;
				continue
			}

			if (char === ')') {
				tokens.push({
					type: 'paren',
					value: ')'
				});
				current++;
				continue
			}

			let WHITESPACE = /\s/;
			if (WHITESPACE.test(char)) {
				current++;
				continue
			}
			if (char === ',' || char === ';' || char === ':') {
				current++;
				continue
			}

			let NUMBERS = /[0-9]/;
			if (NUMBERS.test(char)) {
				let value = '';
				while(NUMBERS.test(char)) {
					value += char;
					current++;
					char = input[current];
				}
				tokens.push({
					type: 'number',
					value: value
				});
				continue
			}
			let LETTERS = /[a-z]|-|_|\$/i;
			if (LETTERS.test(char)) {
				let value = '';
				while(LETTERS.test(char)) {
					value += char;
					current++;
					char = input[current];
				}
				if (value === 'fn') {
					tokens.push({
						type: 'lambda',
						value: value
					});
				} else if (value === 'self') {
					tokens.push({
						type: 'keyword',
						value: value
					});
				} else {
					tokens.push({
						type: 'name',
						value: value
					});
				}
				continue
			}


			throw new TypeError(`Unexcepted charactor "${char}".`)
		}
		return tokens
	}

	function parser(tokens) {
		let current = 0;
		let ast = {
			type: 'Program',
			body: []
		};

		function walk() {
			let token = tokens[current];

			if (token.type === 'string') {
				current++;
				return {
					type: 'RawString',
					value: token.value
				}
			}
			if (token.type === 'keyword') {
				current++;
				return {
					type: 'KeywordLiteral',
					value: token.value
				}
			}
			if (token.type === 'number') {
				current++;
				return {
					type: 'NumberLiteral',
					value: token.value
				}
			}
			if(token.type === 'lambda') {
				token = tokens[++current];
				let node = {
					type: 'LambdaExpression',
					name: token.value,
					params: []
				};
				token = tokens[++current];
				// LambdaExpression 表达式
				if (token.type === 'paren' && token.value === '(') {
					// 跳过括号，方便取到函数名
					token = tokens[++current];

					while(
						(token.type !== 'paren') ||
						(token.type === 'paren' && token.value !== ')')
					) {
						node.params.push(walk());
						token = tokens[current];
					}

					current++;
					return node
				}
			}

			if (token.type === 'name') {
				let name = token.value;
				token = tokens[++current];
				// CallExpression 调用表达式   add  (  1  2  )
				if (token.type === 'paren' && token.value === '(') {
					// 跳过括号，方便取到函数名
					token = tokens[++current];
					let node = {
						type: 'CallExpression',
						name: name,
						params: []
					};

					while(
						(token.type !== 'paren') ||
						(token.type === 'paren' && token.value !== ')')
					) {
						node.params.push(walk());
						token = tokens[current];
					}

					current++;
					return node
				} else {
					// StringLiteral
					return {
						type: 'StringLiteral',
						value: name
					}
				}
			}
		}

		while(current < tokens.length) {
			ast.body.push(walk());
		}

		return ast
	}

	function codeGen(ast, fns) {
		function traverseArray(arr, parent) {
			let result = '';
			if (parent.type === 'LambdaExpression') result += 'function() {\n';
			if (parent.name) {
				if (!fns.includes(parent.name)) throw new Error(`Unsupported function [${parent.name}].`)
				result += `w.${parent.name}(`;
			}

			arr.forEach((child, idx) => {
				if (parent.name) {
					result += `${idx === 0 ? '': ', '}${traverseNode(child, parent)}`;
				} else {
					result += `${idx === 0 ? '': '; '}${traverseNode(child, parent)}`;
				}
			});

			if (parent.name) result += `)`;
			if (parent.type === 'LambdaExpression') result += '\n}';
			return result
		}

		function traverseNode(node, parent) {
			if (node.type === 'Program') {
				return traverseArray(node.body, node)
			}
			if (node.type === 'CallExpression') {
				return traverseArray(node.params, node)
			}
			if (node.type === 'LambdaExpression') {
				return traverseArray(node.params, node)
			}
			if (node.type === 'KeywordLiteral') {
				return node.value
			}
			if (node.type === 'StringLiteral') {
				return node.value === 'PARAM'
					? node.value
					:`"${node.value}"`
			}
			if (node.type === 'RawString') {
				return `"${node.value}"`
			}
			if (node.type === 'NumberLiteral') {
				return node.value
			}
			throw new TypeError(node.type)
		}

		return traverseNode(ast, null)
	}

	function compile(input, fns) {
		let tokens = tokenizer(input);
		let ast    = parser(tokens);
		let out    = codeGen(ast, fns);

		return out
	}

	(function(config, window, document) {
	    let cfg = Object.assign({
	        namespace: null
	    }, config);

	    let ns = cfg.namespace;
	    let w = window;
	    let d = document;

	    if (typeof ns === 'string') w = window[ns] = {};

	    /* DOM */
	    // Query
	    w.get = (id, ctx) => (ctx || d).getElementById(id);
	    w.one = (sel, ctx) => (ctx || d).querySelector(sel);
	    w.all = (sel, ctx) => (ctx || d).querySelectorAll(sel);
	    w.remove = (el) => el.remove();

	    // Classes
	    w.hasClass = (el, cName) => el.classList && el.classList.contains(cName);
	    w.toggleClass = (el, cName) => el.classList.toggle(cName);
	    w.adClass = (el, cName) => el.classList.add(cName);
	    w.adAllClass = (el, cName) => {
	        return el.length ? el.forEach(e => adClass(e, cName)) : adClass(el, cName)
	    };
	    w.rmClass = (el, cName) => el.classList.remove(cName);
	    w.rmAllClass = (el, cName) => {
	        return el.length ? el.forEach(e => rmClass(e, cName)) : rmClass(el, cName)
	    };
	    w.addClass = (sel, cName, ctx) => {
	        return sel instanceof HTMLElement
	            ? adClass(sel, cName)
	            : w.all(sel, ctx).forEach(e => adClass(e, cName))
	    };
	    w.removeClass = (sel, cName, ctx) => {
	        return sel instanceof HTMLElement
	            ? rmClass(sel, cName)
	            : w.all(sel, ctx).forEach(e => rmClass(e, cName))
	    };

	    w.eq = (sel, idx, ctx) => w.all(sel, ctx)[idx];
	    w.sel = (el, key) => w.all(w.data(el, key), el);

	    // Data
	    w.data = (el, key) => el.dataset && el.dataset[key];
	    w.hasData = (el, key) => w.data(el, key) !== undefined;
	    w.attr = (el, key) => el.getAttribute(key);
	    w.hasAttr = (el, key) => el.hasAttribute(key);
	    w.setAttr = (el, key, value) => el.setAttribute(key, value);
	    w.removeAttr = (el, key) => el.removeAttribute(key);
	    w.toggleAttr = (...args) => w.hasAttr(...args) ? w.removeAttr(...args) : w.setAttr(...args, true);
	    w._valid_fns_ = [
	        'sel', 'eq',
	        'remove', 'delay',
	        'addClass', 'removeClass', 'hasClass', 'adClass', 'adAllClass', 'toggleClass', 'rmClass', 'rmAllClass',
	        'data', 'hasData', 'attr', 'hasAttr', 'setAttr', 'removeAttr', 'toggleAttr'
	    ];

	    /* Event */
	    w.addEvent = (el, ...args) => el.addEventListener(...args);
	    w.removeEvent = (el, ...args) => el.removeEventListener(...args);

	    /* utils */
	    w.delay = function(...args) {
	        if (typeof args[0] !== 'number') {
	            args.shift();
	        }
	        return setTimeout(() => args[1](), args[0])
	    };

	    // UI Component init
	    w.toast = (content, pos) => {
	        let el = d.createElement('div');
	        el.className = `toast ${pos}`;
	        el.innerHTML = `<span class="message" data-trigger="close">${content}</span>`;
	        d.body.appendChild(el);
	        setTimeout(() => {
	            adClass(el, 'show');
	        }, 100);
	    };
	    w.dialog = (el) => {
	        setAttr(el, 'open', true);
	    };

	    function parseTrigger(el, trigger) {
	        let param = null;
	        if (trigger.includes('|')) {
	            let str = trigger.split('|');
	            trigger = str[0];
	            param = str[1];
	        }
	        if (trigger === '') {
	            return [el.closest('[data-action]'), param]
	        } else if (trigger === 'self') {
	            return [el, param]
	        } else {
	            return [w.one(trigger), param]
	        }
	    }

	    function clickAction(e) {
	        let trigger = w.data(e.target, 'trigger');
	        if (trigger !== undefined) {
	            let [self, PARAM] = parseTrigger(e.target, trigger);

	            if (!self) throw new Error('Can`t find action target.')

	            let actionInput = w.data(self, 'action');
	            let code = compile(actionInput, w._valid_fns_, PARAM);

	            console.log(code.replace(/PARAM/g, PARAM));
	            eval(code.replace(/PARAM/g, PARAM));
	        }
	    }

	    function domReady() {
	        w.addEvent(document, 'click', clickAction);
	    }

	    // When dom ready, bind default action to triggers.
	    w.addEvent(window, 'DOMContentLoaded', domReady);

	})(window.JOSHUA_CONFIG || {}, window, document);

}());
