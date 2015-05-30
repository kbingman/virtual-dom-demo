import { shipFactory } from '../../src/js/ships/ship_factory';

describe('Ship Factory', function() {
  var ship;

  beforeEach(function() {
    ship = shipFactory({
      mass: 10000,
      configuration: 'Needle',
      armor: 5,
      ftl: 3,
      thrust: 6,
      reactor: 2
    });
    window.ship = ship;
  });

  it('should return the correct thrust', function() {
    expect(ship.thrust).to.be.equal(6);
  });

  it('should return a cuid', function() {
    expect(ship.cuid.length).to.equal(25);
  });

  it('should calculate the correct reactor mass', function() {
    expect(ship.masses.reactor).to.equal(600);
  });

  it('should calculate the reaction drive mass', function() {
    expect(ship.masses.thrust).to.equal(1700);
  });

  it('should calculate the ftl drive mass', function() {
    expect(ship.masses.ftl).to.equal(400);
  });

  it('should calculate the required fuel', function() {
    expect(ship.masses.fuel).to.equal(3300);
  });

  it('should return false for isSmallCraft for large ships', function() {
    expect(ship.isSmallCraft).to.equal(false);
  });

  it('should return false for isSmallCraft for small ships', function() {
    ship.update({ mass: 10 });
    expect(ship.isSmallCraft).to.equal(true);
  });

  it('should calculate the weapons mass');

  it('should calculate the crew quarters\' mass');

  it('should calculate remaining mass', function() {
    expect(ship.remainingMass).to.equal(3694);
  });

});
