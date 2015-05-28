import { Flux } from 'delorean';

var ShipStore = Flux.createStore({

  actions: {
    'increment': 'increaseAttribute',
    'update': 'updateAttributes'
  },

  scheme: {
    name: undefined,
    tonnage: 0,
    ftl: 0,
    thrust: 0,
    reactor: 0
  },

  increaseAttribute: function(payload) {
    var increment = payload.direction == 'up' ? 1 : -1;
    this.set(payload.key, this.state[payload.key] + increment);
    this.validate();
  },

  updateAttributes: function(payload) {
    Object.keys(payload).forEach(function(key) {
      this.set(key, payload[key]);
    }, this);
    this.validate();
  },

  validate: function() {
    Object.keys(this.state).forEach(function(key) {
      if (!isNaN(this.state[key]) && this.state[key] < 0) {
        this.set(key, 0);
      }
    }, this);
  }

});

export { ShipStore }
