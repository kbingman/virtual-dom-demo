import { ShipStore } from '../../src/js/stores/ship_store';

describe('Ship Store', function() {
  var spy;

  beforeEach(function() {
    ShipStore.state.ftl = 0;
    ShipStore.state.name = undefined;

    spy = sinon.spy();
    ShipStore.onChange(spy);
  });

  describe('Events', function() {
    it('should fire a change event on update', function() {
      ShipStore.updateAttributes({
        name: 'Me, I\'m Counting'
      });
      expect(spy.called).to.be.true;
    });

    it('should fire a change event on increment', function() {
      ShipStore.increaseAttribute({
        key: 'ftl',
        direction: 'up'
      });
      expect(spy.called).to.be.true;
    });
  });

  describe('Update', function() {
    it('should update the name', function() {
      ShipStore.updateAttributes({
        name: 'I Blame Your Mother'
      });

      expect(ShipStore.state.name).to.equal('I Blame Your Mother');
    });
  });

  describe('Increment', function() {
    it('should increment values up', function() {
      ShipStore.increaseAttribute({
        key: 'ftl',
        direction: 'up'
      });

      expect(ShipStore.state.ftl).to.equal(1);
    });

    it('should increment values down', function() {
      ShipStore.state.ftl = 5;
      ShipStore.increaseAttribute({
        key: 'ftl',
        direction: 'down'
      });

      expect(ShipStore.state.ftl).to.equal(4);
    });

    it('should protect against negative values', function() {
      ShipStore.increaseAttribute({
        key: 'ftl',
        direction: 'down'
      });

      expect(ShipStore.state.ftl).to.equal(0);
    });

  });

});
