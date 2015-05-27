import { Flux } from 'delorean';
import { ShipStore } from './stores/ship_store';

var Dispatcher = Flux.createDispatcher({

  increase: function() {
    this.dispatch('increase');
  },

  getStores: function() {
    return {
      shipStore: ShipStore
    };
  }

});

export { Dispatcher }
