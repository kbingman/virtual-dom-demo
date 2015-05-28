import h from 'virtual-dom/h';
import diff from 'virtual-dom/diff';
import patch from 'virtual-dom/patch';
import createElement from 'virtual-dom/create-element';

import virtualize from 'vdom-virtualize';

'use strict';

function withVDOM() {

  this.attributes({
    vTree: undefined
  });

  /**
   * Initialize the DOM tree
   */
  this.after('initialize', function() {
    this.attr.vTree = virtualize.fromHTML(this.render());
    this.node = createElement(this.attr.vTree);

    document.body.appendChild(this.node);
  });

  /**
   * This does the actual diffing and updating
   */
  this.updateUI = function(html) {
    var newTree = virtualize.fromHTML(html);
    var patches = diff(this.attr.vTree, newTree);

    this.node = patch(this.node, patches);
    this.attr.vTree = newTree;
  };

}

export { withVDOM }
