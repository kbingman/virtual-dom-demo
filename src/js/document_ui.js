import flight from 'flightjs';
import { withVDOM } from './mixin/with_vdom';

// Flux
import { Dispatcher } from './dispatcher';
import { ShipActions } from './actions/ship_actions';

// Templates and partials
import template from '../templates/index.hogan';
import fieldPartial from '../templates/_field.hogan';
import incrementPartial from '../templates/_increment.hogan';

var documentUI = flight.component(withVDOM, function() {
  this.attributes({
    'incrementByOne': '[data-increment]',
    'inputField': '[type="text"]',
  });

  this.updateAttributes = function(e) {
    var attr = {}
    attr[e.target.name] = e.target.value;

    ShipActions.update(attr);
  };

  this.increment = function(e) {
    ShipActions.increment({
      key: e.target.name,
      direction: e.target.dataset.increment
    });
  };

  this.render = function(ship) {
    var ship = Dispatcher.getStore('shipStore');
    var partials = {
      field: fieldPartial,
      increment: incrementPartial
    };

    return template.render({
        name: ship.name || 'Untitled',
        ship: ship,
        attributes: Object.keys(ship).reduce(function(memo, key) {
          if (!isNaN(ship[key])) {
            memo.push({
              key: key,
              value: ship[key]
            });
          }

          return memo;
        }, [])
    }, partials);
  };

  this.update = function(e) {
    var html = this.render();
    var vTree = this.virtualize(html);

    this.updateUI(vTree);
  };

  this.after('initialize', function() {
    // UI Events
    this.on('click', {
      'incrementByOne': this.increment
    });
    this.on('input', {
      'inputField': this.updateAttributes
    });

    // Document Events
    Dispatcher.on('change:all', this.update.bind(this));
  });
});

export { documentUI }
