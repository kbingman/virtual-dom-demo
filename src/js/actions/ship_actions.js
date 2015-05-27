import { Dispatcher } from '../dispatcher';

var ShipActions = {

  increment: function(payload) {
    Dispatcher.dispatch('increment', payload);
  },

  update: function(payload) {
    Dispatcher.dispatch('update', payload);
  }

};

export { ShipActions }
