import h from 'virtual-dom/h';
import diff from 'virtual-dom/diff';
import patch from 'virtual-dom/patch';
import createElement from 'virtual-dom/create-element';

import virtualize from 'vdom-virtualize';
import template from '../templates/index.hogan';

var _vTree;
var _ship = {
    thrust: 0
};

var BuilderUI = {
    /**
     * Calls the Search Action with the current query
     */
    listenForInput: function(e) {
        _ship[e.target.name] = e.target.value;
        this.updateUI.call(this);
    },

    listenForClicks: function(e) {
        if (e.target.dataset.increment == 'up') {
            _ship[e.target.name] += 1;
        }
        else if (e.target.dataset.increment == 'down') {
            _ship[e.target.name] = _ship[e.target.name] == 0 ? 0 : _ship[e.target.name] - 1;
        }
        this.updateUI.call(this);
    },

    /**
     * This is a little verbose and in a real app would probably
     * be replaced with JSX, but it shows how the virtual DOM is
     * built up and can be easily diffed.
     * In addition, this is a pure function, which just transforms
     * the state into a virtual DOM tree.
     */
    render: function(ship) {
        var vdom = virtualize.fromHTML(template.render({
            name: _ship.name || 'Untitled',
            thrust: _ship.thrust
        }));

        console.log(vdom);

        // Add some events to the parent
        // vdom.properties.oninput = this.listenForChange.bind(this);

        return vdom;

        // return h('div#ship', { dataset: { container: '' } }, [
        //     h('h2', { id: 'title' }, ship.name || 'Untitled'),
        //     h('div.field',
        //         h('label', { for: 'shipname' }, 'Name')
        //     ),
        //     h('input#shipname', {
        //         name: 'name',
        //         value: ship.name,
        //         placeholder: 'Please enter a name',
        //         oninput: listener
        //     })
        // ]);
    },

    /**
     * This does the actual diffing and updating
     */
    updateUI: function() {
        var newTree = this.render(_ship);
        var patches = diff(_vTree, newTree);

        console.log('render', +new Date());
        this.node = patch(this.node, patches);
        _vTree = newTree;
    },

    /**
     * Sets up the UI Event Listeners
     * and the the Store to render on change
     */
    initialize: function(parent) {
        _vTree = this.render(_ship);

        this.node = createElement(_vTree);
        this.node.addEventListener('input', this.listenForInput.bind(this));
        this.node.addEventListener('click', this.listenForClicks.bind(this));


        parent.appendChild(this.node);
    }
}

export { BuilderUI }
