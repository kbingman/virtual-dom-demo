import { ShipActions } from '../../src/js/actions/ship_actions';
import { Dispatcher } from '../../src/js/dispatcher';

describe('Ship Actions', function() {
  var spy;

  beforeEach(function() {
    spy = sinon.spy(Dispatcher, 'dispatch');
  });

  afterEach(function() {
    Dispatcher.dispatch.restore();
  });

  it('should call dispatch on increment', function() {
    ShipActions.increment({});
    expect(spy.called).to.be.true;
  });

  it('should call dispatch on update', function() {
    ShipActions.update({});
    expect(spy.called).to.be.true;
  });

});
