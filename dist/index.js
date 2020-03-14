(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.Carousel = factory());
}(this, function () { 'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function create_slot(definition, ctx, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, fn) {
        return definition[1]
            ? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
            : ctx.$$scope.ctx;
    }
    function get_slot_changes(definition, ctx, changed, fn) {
        return definition[1]
            ? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
            : ctx.$$scope.changed || {};
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_binding_callback(fn) {
        binding_callbacks.push(fn);
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.shift()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            while (render_callbacks.length) {
                const callback = render_callbacks.pop();
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_render);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_render.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.callbacks.push(() => {
                outroing.delete(block);
                if (callback) {
                    block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, changed, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(changed, child_ctx);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_render } = component.$$;
        fragment.m(target, anchor);
        // onMount happens after the initial afterUpdate. Because
        // afterUpdate callbacks happen in reverse order (inner first)
        // we schedule onMount callbacks before afterUpdate callbacks
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_render.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal: not_equal$$1,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_render: [],
            after_render: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_render);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var siema_min = createCommonjsModule(function (module, exports) {
    !function(e,t){module.exports=t();}("undefined"!=typeof self?self:commonjsGlobal,function(){return function(e){function t(r){if(i[r])return i[r].exports;var n=i[r]={i:r,l:!1,exports:{}};return e[r].call(n.exports,n,n.exports,t),n.l=!0,n.exports}var i={};return t.m=e,t.c=i,t.d=function(e,i,r){t.o(e,i)||Object.defineProperty(e,i,{configurable:!1,enumerable:!0,get:r});},t.n=function(e){var i=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(i,"a",i),i},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="",t(t.s=0)}([function(e,t,i){function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(t,"__esModule",{value:!0});var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},s=function(){function e(e,t){for(var i=0;i<t.length;i++){var r=t[i];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r);}}return function(t,i,r){return i&&e(t.prototype,i),r&&e(t,r),t}}(),l=function(){function e(t){var i=this;if(r(this,e),this.config=e.mergeSettings(t),this.selector="string"==typeof this.config.selector?document.querySelector(this.config.selector):this.config.selector,null===this.selector)throw new Error("Something wrong with your selector 😭");this.resolveSlidesNumber(),this.selectorWidth=this.selector.offsetWidth,this.innerElements=[].slice.call(this.selector.children),this.currentSlide=this.config.loop?this.config.startIndex%this.innerElements.length:Math.max(0,Math.min(this.config.startIndex,this.innerElements.length-this.perPage)),this.transformProperty=e.webkitOrNot(),["resizeHandler","touchstartHandler","touchendHandler","touchmoveHandler","mousedownHandler","mouseupHandler","mouseleaveHandler","mousemoveHandler","clickHandler"].forEach(function(e){i[e]=i[e].bind(i);}),this.init();}return s(e,[{key:"attachEvents",value:function(){window.addEventListener("resize",this.resizeHandler),this.config.draggable&&(this.pointerDown=!1,this.drag={startX:0,endX:0,startY:0,letItGo:null,preventClick:!1},this.selector.addEventListener("touchstart",this.touchstartHandler),this.selector.addEventListener("touchend",this.touchendHandler),this.selector.addEventListener("touchmove",this.touchmoveHandler),this.selector.addEventListener("mousedown",this.mousedownHandler),this.selector.addEventListener("mouseup",this.mouseupHandler),this.selector.addEventListener("mouseleave",this.mouseleaveHandler),this.selector.addEventListener("mousemove",this.mousemoveHandler),this.selector.addEventListener("click",this.clickHandler));}},{key:"detachEvents",value:function(){window.removeEventListener("resize",this.resizeHandler),this.selector.removeEventListener("touchstart",this.touchstartHandler),this.selector.removeEventListener("touchend",this.touchendHandler),this.selector.removeEventListener("touchmove",this.touchmoveHandler),this.selector.removeEventListener("mousedown",this.mousedownHandler),this.selector.removeEventListener("mouseup",this.mouseupHandler),this.selector.removeEventListener("mouseleave",this.mouseleaveHandler),this.selector.removeEventListener("mousemove",this.mousemoveHandler),this.selector.removeEventListener("click",this.clickHandler);}},{key:"init",value:function(){this.attachEvents(),this.selector.style.overflow="hidden",this.selector.style.direction=this.config.rtl?"rtl":"ltr",this.buildSliderFrame(),this.config.onInit.call(this);}},{key:"buildSliderFrame",value:function(){var e=this.selectorWidth/this.perPage,t=this.config.loop?this.innerElements.length+2*this.perPage:this.innerElements.length;this.sliderFrame=document.createElement("div"),this.sliderFrame.style.width=e*t+"px",this.enableTransition(),this.config.draggable&&(this.selector.style.cursor="-webkit-grab");var i=document.createDocumentFragment();if(this.config.loop)for(var r=this.innerElements.length-this.perPage;r<this.innerElements.length;r++){var n=this.buildSliderFrameItem(this.innerElements[r].cloneNode(!0));i.appendChild(n);}for(var s=0;s<this.innerElements.length;s++){var l=this.buildSliderFrameItem(this.innerElements[s]);i.appendChild(l);}if(this.config.loop)for(var o=0;o<this.perPage;o++){var a=this.buildSliderFrameItem(this.innerElements[o].cloneNode(!0));i.appendChild(a);}this.sliderFrame.appendChild(i),this.selector.innerHTML="",this.selector.appendChild(this.sliderFrame),this.slideToCurrent();}},{key:"buildSliderFrameItem",value:function(e){var t=document.createElement("div");return t.style.cssFloat=this.config.rtl?"right":"left",t.style.float=this.config.rtl?"right":"left",t.style.width=(this.config.loop?100/(this.innerElements.length+2*this.perPage):100/this.innerElements.length)+"%",t.appendChild(e),t}},{key:"resolveSlidesNumber",value:function(){if("number"==typeof this.config.perPage)this.perPage=this.config.perPage;else if("object"===n(this.config.perPage)){this.perPage=1;for(var e in this.config.perPage)window.innerWidth>=e&&(this.perPage=this.config.perPage[e]);}}},{key:"prev",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:1,t=arguments[1];if(!(this.innerElements.length<=this.perPage)){var i=this.currentSlide;if(this.config.loop){if(this.currentSlide-e<0){this.disableTransition();var r=this.currentSlide+this.innerElements.length,n=this.perPage,s=r+n,l=(this.config.rtl?1:-1)*s*(this.selectorWidth/this.perPage),o=this.config.draggable?this.drag.endX-this.drag.startX:0;this.sliderFrame.style[this.transformProperty]="translate3d("+(l+o)+"px, 0, 0)",this.currentSlide=r-e;}else this.currentSlide=this.currentSlide-e;}else this.currentSlide=Math.max(this.currentSlide-e,0);i!==this.currentSlide&&(this.slideToCurrent(this.config.loop),this.config.onChange.call(this),t&&t.call(this));}}},{key:"next",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:1,t=arguments[1];if(!(this.innerElements.length<=this.perPage)){var i=this.currentSlide;if(this.config.loop){if(this.currentSlide+e>this.innerElements.length-this.perPage){this.disableTransition();var r=this.currentSlide-this.innerElements.length,n=this.perPage,s=r+n,l=(this.config.rtl?1:-1)*s*(this.selectorWidth/this.perPage),o=this.config.draggable?this.drag.endX-this.drag.startX:0;this.sliderFrame.style[this.transformProperty]="translate3d("+(l+o)+"px, 0, 0)",this.currentSlide=r+e;}else this.currentSlide=this.currentSlide+e;}else this.currentSlide=Math.min(this.currentSlide+e,this.innerElements.length-this.perPage);i!==this.currentSlide&&(this.slideToCurrent(this.config.loop),this.config.onChange.call(this),t&&t.call(this));}}},{key:"disableTransition",value:function(){this.sliderFrame.style.webkitTransition="all 0ms "+this.config.easing,this.sliderFrame.style.transition="all 0ms "+this.config.easing;}},{key:"enableTransition",value:function(){this.sliderFrame.style.webkitTransition="all "+this.config.duration+"ms "+this.config.easing,this.sliderFrame.style.transition="all "+this.config.duration+"ms "+this.config.easing;}},{key:"goTo",value:function(e,t){if(!(this.innerElements.length<=this.perPage)){var i=this.currentSlide;this.currentSlide=this.config.loop?e%this.innerElements.length:Math.min(Math.max(e,0),this.innerElements.length-this.perPage),i!==this.currentSlide&&(this.slideToCurrent(),this.config.onChange.call(this),t&&t.call(this));}}},{key:"slideToCurrent",value:function(e){var t=this,i=this.config.loop?this.currentSlide+this.perPage:this.currentSlide,r=(this.config.rtl?1:-1)*i*(this.selectorWidth/this.perPage);e?requestAnimationFrame(function(){requestAnimationFrame(function(){t.enableTransition(),t.sliderFrame.style[t.transformProperty]="translate3d("+r+"px, 0, 0)";});}):this.sliderFrame.style[this.transformProperty]="translate3d("+r+"px, 0, 0)";}},{key:"updateAfterDrag",value:function(){var e=(this.config.rtl?-1:1)*(this.drag.endX-this.drag.startX),t=Math.abs(e),i=this.config.multipleDrag?Math.ceil(t/(this.selectorWidth/this.perPage)):1,r=e>0&&this.currentSlide-i<0,n=e<0&&this.currentSlide+i>this.innerElements.length-this.perPage;e>0&&t>this.config.threshold&&this.innerElements.length>this.perPage?this.prev(i):e<0&&t>this.config.threshold&&this.innerElements.length>this.perPage&&this.next(i),this.slideToCurrent(r||n);}},{key:"resizeHandler",value:function(){this.resolveSlidesNumber(),this.currentSlide+this.perPage>this.innerElements.length&&(this.currentSlide=this.innerElements.length<=this.perPage?0:this.innerElements.length-this.perPage),this.selectorWidth=this.selector.offsetWidth,this.buildSliderFrame();}},{key:"clearDrag",value:function(){this.drag={startX:0,endX:0,startY:0,letItGo:null,preventClick:this.drag.preventClick};}},{key:"touchstartHandler",value:function(e){-1!==["TEXTAREA","OPTION","INPUT","SELECT"].indexOf(e.target.nodeName)||(e.stopPropagation(),this.pointerDown=!0,this.drag.startX=e.touches[0].pageX,this.drag.startY=e.touches[0].pageY);}},{key:"touchendHandler",value:function(e){e.stopPropagation(),this.pointerDown=!1,this.enableTransition(),this.drag.endX&&this.updateAfterDrag(),this.clearDrag();}},{key:"touchmoveHandler",value:function(e){if(e.stopPropagation(),null===this.drag.letItGo&&(this.drag.letItGo=Math.abs(this.drag.startY-e.touches[0].pageY)<Math.abs(this.drag.startX-e.touches[0].pageX)),this.pointerDown&&this.drag.letItGo){e.preventDefault(),this.drag.endX=e.touches[0].pageX,this.sliderFrame.style.webkitTransition="all 0ms "+this.config.easing,this.sliderFrame.style.transition="all 0ms "+this.config.easing;var t=this.config.loop?this.currentSlide+this.perPage:this.currentSlide,i=t*(this.selectorWidth/this.perPage),r=this.drag.endX-this.drag.startX,n=this.config.rtl?i+r:i-r;this.sliderFrame.style[this.transformProperty]="translate3d("+(this.config.rtl?1:-1)*n+"px, 0, 0)";}}},{key:"mousedownHandler",value:function(e){-1!==["TEXTAREA","OPTION","INPUT","SELECT"].indexOf(e.target.nodeName)||(e.preventDefault(),e.stopPropagation(),this.pointerDown=!0,this.drag.startX=e.pageX);}},{key:"mouseupHandler",value:function(e){e.stopPropagation(),this.pointerDown=!1,this.selector.style.cursor="-webkit-grab",this.enableTransition(),this.drag.endX&&this.updateAfterDrag(),this.clearDrag();}},{key:"mousemoveHandler",value:function(e){if(e.preventDefault(),this.pointerDown){"A"===e.target.nodeName&&(this.drag.preventClick=!0),this.drag.endX=e.pageX,this.selector.style.cursor="-webkit-grabbing",this.sliderFrame.style.webkitTransition="all 0ms "+this.config.easing,this.sliderFrame.style.transition="all 0ms "+this.config.easing;var t=this.config.loop?this.currentSlide+this.perPage:this.currentSlide,i=t*(this.selectorWidth/this.perPage),r=this.drag.endX-this.drag.startX,n=this.config.rtl?i+r:i-r;this.sliderFrame.style[this.transformProperty]="translate3d("+(this.config.rtl?1:-1)*n+"px, 0, 0)";}}},{key:"mouseleaveHandler",value:function(e){this.pointerDown&&(this.pointerDown=!1,this.selector.style.cursor="-webkit-grab",this.drag.endX=e.pageX,this.drag.preventClick=!1,this.enableTransition(),this.updateAfterDrag(),this.clearDrag());}},{key:"clickHandler",value:function(e){this.drag.preventClick&&e.preventDefault(),this.drag.preventClick=!1;}},{key:"remove",value:function(e,t){if(e<0||e>=this.innerElements.length)throw new Error("Item to remove doesn't exist 😭");var i=e<this.currentSlide,r=this.currentSlide+this.perPage-1===e;(i||r)&&this.currentSlide--,this.innerElements.splice(e,1),this.buildSliderFrame(),t&&t.call(this);}},{key:"insert",value:function(e,t,i){if(t<0||t>this.innerElements.length+1)throw new Error("Unable to inset it at this index 😭");if(-1!==this.innerElements.indexOf(e))throw new Error("The same item in a carousel? Really? Nope 😭");var r=t<=this.currentSlide>0&&this.innerElements.length;this.currentSlide=r?this.currentSlide+1:this.currentSlide,this.innerElements.splice(t,0,e),this.buildSliderFrame(),i&&i.call(this);}},{key:"prepend",value:function(e,t){this.insert(e,0),t&&t.call(this);}},{key:"append",value:function(e,t){this.insert(e,this.innerElements.length+1),t&&t.call(this);}},{key:"destroy",value:function(){var e=arguments.length>0&&void 0!==arguments[0]&&arguments[0],t=arguments[1];if(this.detachEvents(),this.selector.style.cursor="auto",e){for(var i=document.createDocumentFragment(),r=0;r<this.innerElements.length;r++)i.appendChild(this.innerElements[r]);this.selector.innerHTML="",this.selector.appendChild(i),this.selector.removeAttribute("style");}t&&t.call(this);}}],[{key:"mergeSettings",value:function(e){var t={selector:".siema",duration:200,easing:"ease-out",perPage:1,startIndex:0,draggable:!0,multipleDrag:!0,threshold:20,loop:!1,rtl:!1,onInit:function(){},onChange:function(){}},i=e;for(var r in i)t[r]=i[r];return t}},{key:"webkitOrNot",value:function(){return "string"==typeof document.documentElement.style.transform?"transform":"WebkitTransform"}}]),e}();t.default=l,e.exports=t.default;}])});
    });

    var Siema = unwrapExports(siema_min);
    var siema_min_1 = siema_min.Siema;

    function add(node, event, handler) {
    	node.addEventListener(event, handler);
    	return () => node.removeEventListener(event, handler);
    }

    function dispatch_tap(node, x, y) {
    	node.dispatchEvent(new CustomEvent('tap', {
    		detail: { x, y }
    	}));
    }

    function handle_focus(event) {
    	const remove_keydown_handler = add(event.currentTarget, 'keydown', (event) => {
    		if (event.which === 32) dispatch_tap(event.currentTarget, null, null);
    	});

    	const remove_blur_handler = add(event.currentTarget, 'blur', (event) => {
    		remove_keydown_handler();
    		remove_blur_handler();
    	});
    }

    function is_button(node) {
    	return node.tagName === 'BUTTON' || node.type === 'button';
    }

    function tap_pointer(node) {
    	function handle_pointerdown(event) {
    		if ((node ).disabled) return;
    		const { clientX, clientY } = event;

    		const remove_pointerup_handler = add(node, 'pointerup', (event) => {
    			if (Math.abs(event.clientX - clientX) > 5) return;
    			if (Math.abs(event.clientY - clientY) > 5) return;

    			dispatch_tap(node, event.clientX, event.clientY);
    			remove_pointerup_handler();
    		});

    		setTimeout(remove_pointerup_handler, 300);
    	}

    	const remove_pointerdown_handler = add(node, 'pointerdown', handle_pointerdown);
    	const remove_focus_handler = is_button(node ) && add(node, 'focus', handle_focus);

    	return {
    		destroy() {
    			remove_pointerdown_handler();
    			remove_focus_handler && remove_focus_handler();
    		}
    	};
    }

    function tap_legacy(node) {
    	let mouse_enabled = true;
    	let mouse_timeout;

    	function handle_mousedown(event) {
    		const { clientX, clientY } = event;

    		const remove_mouseup_handler = add(node, 'mouseup', (event) => {
    			if (!mouse_enabled) return;
    			if (Math.abs(event.clientX - clientX) > 5) return;
    			if (Math.abs(event.clientY - clientY) > 5) return;

    			dispatch_tap(node, event.clientX, event.clientY);
    			remove_mouseup_handler();
    		});

    		clearTimeout(mouse_timeout);
    		setTimeout(remove_mouseup_handler, 300);
    	}

    	function handle_touchstart(event) {
    		if (event.changedTouches.length !== 1) return;
    		if ((node ).disabled) return;

    		const touch = event.changedTouches[0];
    		const { identifier, clientX, clientY } = touch;

    		const remove_touchend_handler = add(node, 'touchend', (event) => {
    			const touch = Array.from(event.changedTouches).find(t => t.identifier === identifier);
    			if (!touch) return;

    			if (Math.abs(touch.clientX - clientX) > 5) return;
    			if (Math.abs(touch.clientY - clientY) > 5) return;

    			dispatch_tap(node, touch.clientX, touch.clientY);

    			mouse_enabled = false;
    			mouse_timeout = setTimeout(() => {
    				mouse_enabled = true;
    			}, 350);
    		});

    		setTimeout(remove_touchend_handler, 300);
    	}

    	const remove_mousedown_handler = add(node, 'mousedown', handle_mousedown);
    	const remove_touchstart_handler = add(node, 'touchstart', handle_touchstart);
    	const remove_focus_handler = is_button(node ) && add(node, 'focus', handle_focus);

    	return {
    		destroy() {
    			remove_mousedown_handler();
    			remove_touchstart_handler();
    			remove_focus_handler && remove_focus_handler();
    		}
    	};
    }

    const tap = typeof PointerEvent === 'function'
    	? tap_pointer
    	: tap_legacy;

    /* src/Carousel.svelte generated by Svelte v3.6.1 */
    const { document: document_1 } = globals;

    function add_css() {
    	var style = element("style");
    	style.id = 'svelte-16zwfyy-style';
    	style.textContent = ".carousel.svelte-16zwfyy{position:relative;width:100%;justify-content:center;align-items:center}button.svelte-16zwfyy{position:absolute;width:40px;height:40px;top:50%;z-index:50;margin-top:-20px;border:none;background-color:transparent}button.svelte-16zwfyy:focus{outline:none}.left.svelte-16zwfyy{left:2vw}.right.svelte-16zwfyy{right:2vw}ul.svelte-16zwfyy{list-style-type:none;position:absolute;display:flex;justify-content:center;width:100%;margin:1rem 0;padding:0}ul.svelte-16zwfyy li.svelte-16zwfyy{margin:.5rem;border-radius:100%;background-color:rgba(255,255,255,0.5);transition:background-color 0.4s ease-in-out;height:8px;width:8px}.active.svelte-16zwfyy{background-color:rgba(0,0,0,0.85)}ul.svelte-16zwfyy li.svelte-16zwfyy:hover{background-color:rgba(255,255,255,0.85)}";
    	append(document_1.head, style);
    }

    const get_right_control_slot_changes = ({}) => ({});
    const get_right_control_slot_context = ({}) => ({});

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pip = list[i];
    	child_ctx.i = i;
    	return child_ctx;
    }

    const get_left_control_slot_changes = ({}) => ({});
    const get_left_control_slot_context = ({}) => ({});

    // (164:2) {#each pips as pip, i ("pip_"+id+"_"+i)}
    function create_each_block(key_1, ctx) {
    	var li, li_class_value, tap_action, dispose;

    	function tap_handler() {
    		return ctx.tap_handler(ctx);
    	}

    	return {
    		key: key_1,

    		first: null,

    		c() {
    			li = element("li");
    			attr(li, "class", li_class_value = "" + (ctx.current==ctx.i ? "active" : "") + " svelte-16zwfyy");
    			dispose = listen(li, "tap", tap_handler);
    			this.first = li;
    		},

    		m(target, anchor) {
    			insert(target, li, anchor);
    			tap_action = tap.call(null, li) || {};
    		},

    		p(changed, new_ctx) {
    			ctx = new_ctx;
    			if ((changed.current || changed.pips) && li_class_value !== (li_class_value = "" + (ctx.current==ctx.i ? "active" : "") + " svelte-16zwfyy")) {
    				attr(li, "class", li_class_value);
    			}
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(li);
    			}

    			if (tap_action && typeof tap_action.destroy === 'function') tap_action.destroy();
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	var div1, button0, tap_action, t0, div0, t1, ul, each_blocks = [], each_1_lookup = new Map(), t2, button1, tap_action_1, current_1, dispose;

    	const left_control_slot_1 = ctx.$$slots["left-control"];
    	const left_control_slot = create_slot(left_control_slot_1, ctx, get_left_control_slot_context);

    	const default_slot_1 = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_1, ctx, null);

    	var each_value = ctx.pips;

    	const get_key = ctx => "pip_"+ctx.id+"_"+ctx.i;

    	for (var i_1 = 0; i_1 < each_value.length; i_1 += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i_1);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i_1] = create_each_block(key, child_ctx));
    	}

    	const right_control_slot_1 = ctx.$$slots["right-control"];
    	const right_control_slot = create_slot(right_control_slot_1, ctx, get_right_control_slot_context);

    	return {
    		c() {
    			div1 = element("div");
    			button0 = element("button");

    			if (left_control_slot) left_control_slot.c();
    			t0 = space();
    			div0 = element("div");

    			if (default_slot) default_slot.c();
    			t1 = space();
    			ul = element("ul");

    			for (i_1 = 0; i_1 < each_blocks.length; i_1 += 1) each_blocks[i_1].c();

    			t2 = space();
    			button1 = element("button");

    			if (right_control_slot) right_control_slot.c();

    			attr(button0, "class", "left svelte-16zwfyy");

    			attr(div0, "class", "slides");
    			attr(ul, "class", "svelte-16zwfyy");

    			attr(button1, "class", "right svelte-16zwfyy");
    			attr(div1, "class", "carousel svelte-16zwfyy");

    			dispose = [
    				listen(button0, "tap", ctx.left),
    				listen(button1, "tap", ctx.right)
    			];
    		},

    		l(nodes) {
    			if (left_control_slot) left_control_slot.l(button0_nodes);

    			if (default_slot) default_slot.l(div0_nodes);

    			if (right_control_slot) right_control_slot.l(button1_nodes);
    		},

    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, button0);

    			if (left_control_slot) {
    				left_control_slot.m(button0, null);
    			}

    			tap_action = tap.call(null, button0) || {};
    			append(div1, t0);
    			append(div1, div0);

    			if (default_slot) {
    				default_slot.m(div0, null);
    			}

    			add_binding_callback(() => ctx.div0_binding(div0, null));
    			append(div1, t1);
    			append(div1, ul);

    			for (i_1 = 0; i_1 < each_blocks.length; i_1 += 1) each_blocks[i_1].m(ul, null);

    			append(div1, t2);
    			append(div1, button1);

    			if (right_control_slot) {
    				right_control_slot.m(button1, null);
    			}

    			tap_action_1 = tap.call(null, button1) || {};
    			current_1 = true;
    		},

    		p(changed, ctx) {
    			if (left_control_slot && left_control_slot.p && changed.$$scope) {
    				left_control_slot.p(get_slot_changes(left_control_slot_1, ctx, changed, get_left_control_slot_changes), get_slot_context(left_control_slot_1, ctx, get_left_control_slot_context));
    			}

    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
    			}

    			if (changed.items) {
    				ctx.div0_binding(null, div0);
    				ctx.div0_binding(div0, null);
    			}

    			const each_value = ctx.pips;
    			each_blocks = update_keyed_each(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, ul, destroy_block, create_each_block, null, get_each_context);

    			if (right_control_slot && right_control_slot.p && changed.$$scope) {
    				right_control_slot.p(get_slot_changes(right_control_slot_1, ctx, changed, get_right_control_slot_changes), get_slot_context(right_control_slot_1, ctx, get_right_control_slot_context));
    			}
    		},

    		i(local) {
    			if (current_1) return;
    			transition_in(left_control_slot, local);
    			transition_in(default_slot, local);
    			transition_in(right_control_slot, local);
    			current_1 = true;
    		},

    		o(local) {
    			transition_out(left_control_slot, local);
    			transition_out(default_slot, local);
    			transition_out(right_control_slot, local);
    			current_1 = false;
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(div1);
    			}

    			if (left_control_slot) left_control_slot.d(detaching);
    			if (tap_action && typeof tap_action.destroy === 'function') tap_action.destroy();

    			if (default_slot) default_slot.d(detaching);
    			ctx.div0_binding(null, div0);

    			for (i_1 = 0; i_1 < each_blocks.length; i_1 += 1) each_blocks[i_1].d();

    			if (right_control_slot) right_control_slot.d(detaching);
    			if (tap_action_1 && typeof tap_action_1.destroy === 'function') tap_action_1.destroy();
    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	
    	
    	let { perPage = 3, loop = true, autoplay = 0, go = 0, current = 0 } = $$props;

    	let id;
    	let siema;
    	let controller;
    	let timer;
    	
    	onMount(() => {

    		$$invalidate('id', id = Math.ceil(Math.random() * 300000));
    		const onChange  = () => { $$invalidate('current', current = controller.currentSlide); };
    		$$invalidate('controller', controller = new Siema({
    			selector: siema,
    			perPage,
    			loop,
    			onChange
    		}));

    		 
    	
    			
    		document.addEventListener('keydown', event => {
    	
    			switch(event.keyCode) {
    				case 32:
    					right();
    					break;
    				case 37:
    				case 38:
    					left();
    					break;
    				case 39:
    				case 40:
    					right();
    					break;
    			}
    			
    		
            });


    		autoplay && setInterval(right, autoplay);

    		return () => {
    			autoplay && clearTimeout(timer);
    			controller.destroy();
    		}
    	});
    	
    	function left () {
    		current--; $$invalidate('current', current);
    		$$invalidate('current', current %= pips.length);
    		controller.prev(1,goTo(current));
    	}
    	
    	function right () {
    		current++; $$invalidate('current', current);
    		$$invalidate('current', current %= pips.length);
    		controller.next(1,goTo(current));
    	}

    	function goTo (index) {
    		console.log("go to",index);
    		
    		if(!!controller&&(index===0||index>0)) {
    			controller.goTo(index,()=>{
    				console.log("went to",index);
    				$$invalidate('current', current = index);
    			});
    		}
    		
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function div0_binding($$node, check) {
    		siema = $$node;
    		$$invalidate('siema', siema);
    	}

    	function tap_handler({ i }) {
    		return goTo(i);
    	}

    	$$self.$set = $$props => {
    		if ('perPage' in $$props) $$invalidate('perPage', perPage = $$props.perPage);
    		if ('loop' in $$props) $$invalidate('loop', loop = $$props.loop);
    		if ('autoplay' in $$props) $$invalidate('autoplay', autoplay = $$props.autoplay);
    		if ('go' in $$props) $$invalidate('go', go = $$props.go);
    		if ('current' in $$props) $$invalidate('current', current = $$props.current);
    		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
    	};

    	let pips;

    	$$self.$$.update = ($$dirty = { go: 1, controller: 1 }) => {
    		if ($$dirty.go) { goTo(go); }
    		if ($$dirty.controller) { $$invalidate('pips', pips = controller ? controller.innerElements : []); }
    	};

    	return {
    		perPage,
    		loop,
    		autoplay,
    		go,
    		current,
    		id,
    		siema,
    		left,
    		right,
    		goTo,
    		pips,
    		div0_binding,
    		tap_handler,
    		$$slots,
    		$$scope
    	};
    }

    class Carousel extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1.getElementById("svelte-16zwfyy-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, ["perPage", "loop", "autoplay", "go", "current"]);
    	}
    }

    return Carousel;

}));
