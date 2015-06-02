import { Flux } from 'delorean';
import { ShipStore } from './stores/ship_store';

var Dispatcher = Flux.createDispatcher({

  getStores () {
    return {
      shipStore: ShipStore
    };
  }

});

export { Dispatcher };
