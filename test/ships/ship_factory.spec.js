import { shipFactory } from '../../src/js/ships/ship_factory';

var mockShip = {
  "mass": 10000,
  "configuration": "Needle",
  "armor": 5,
  "ftl": 3,
  "thrust": 6,
  "reactor": 6,
  "availableWeapons": {
    "batteries": 10,
    "pointDefense": 100
  },
  "isSmallCraft": false,
  "masses": {
    "ftl": 400,
    "thrust": 1700,
    "reactor": 600,
    "bridge": 200,
    "armor": 106,
    "fuel": 3300
  },
  "totalMass": 6306,
  "ep": 300,
  "remainingMass": 3694,
  "weapons": {
    "primary": {
      "id": 3,
      "name": "Railgun",
      "cost": 4200,
      "ep": 500,
      "size": 3000
    }
  }
}

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

  it('should calculate the crew quarters\' mass');

  it('should calculate remaining mass', function() {
    expect(ship.remainingMass).to.equal(3694);
  });

  describe('Weapons Masses', function() {
    // beforeEach(function() {
    //   ship.addPrimaryWeapon(1);
    //   ship.addWeapon('batteries', 3, 8);
    //
    //   ship.update();
    // });
    //
    // afterEach(function() {
    //   ship = undefined;
    // });
    //
    // it('should calculate the primary weapon\'s mass', function() {
    //   expect(ship.masses.primaryWeapon).to.equal(2000);
    // });
    //
    // it('should calculate the battery weapons\' mass', function() {
    //   expect(ship.masses.batteries).to.equal(800);
    // });
  });

});
