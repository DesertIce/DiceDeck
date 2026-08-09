const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadVisibilityHelper() {
    const document = {
        hidden: false,
        body: { classList: { add() {} } },
        documentElement: { addEventListener() {} },
        addEventListener() {},
        getElementById() { return null; },
        activeElement: null,
    };
    const window = {
        location: { search: '' },
        addEventListener() {},
    };
    const context = vm.createContext({
        window,
        document,
        navigator: {},
        console: { log() {}, warn() {}, error() {} },
        URLSearchParams,
        setTimeout,
        clearTimeout,
        requestAnimationFrame() {},
        alert() {},
        module: { exports: {} },
    });
    const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
    vm.runInContext(`${source}\nmodule.exports = { shouldStatusBarStayVisible };`, context);
    return context.module.exports.shouldStatusBarStayVisible;
}

const shouldStatusBarStayVisible = loadVisibilityHelper();

test('hides only when stably connected and idle', () => {
    assert.equal(shouldStatusBarStayVisible({
        connected: true,
        editMode: false,
        pointerNearTop: false,
        hoveringBar: false,
        focusWithinBar: false,
    }), false);
});

test('stays visible while disconnected, connecting, or recovering', () => {
    assert.equal(shouldStatusBarStayVisible({
        connected: false,
        editMode: false,
        pointerNearTop: false,
        hoveringBar: false,
        focusWithinBar: false,
    }), true);
});

test('reveals when the pointer nears the top edge', () => {
    assert.equal(shouldStatusBarStayVisible({
        connected: true,
        editMode: false,
        pointerNearTop: true,
        hoveringBar: false,
        focusWithinBar: false,
    }), true);
});

test('stays visible while hovering, focused, or editing', () => {
    assert.equal(shouldStatusBarStayVisible({
        connected: true,
        editMode: true,
        pointerNearTop: false,
        hoveringBar: false,
        focusWithinBar: false,
    }), true);
    assert.equal(shouldStatusBarStayVisible({
        connected: true,
        editMode: false,
        pointerNearTop: false,
        hoveringBar: true,
        focusWithinBar: false,
    }), true);
    assert.equal(shouldStatusBarStayVisible({
        connected: true,
        editMode: false,
        pointerNearTop: false,
        hoveringBar: false,
        focusWithinBar: true,
    }), true);
});
