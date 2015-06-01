import { baseWeapon } from '../../src/js/ships/weapon_factory';

describe('Weapon Factory', function() {

  beforeEach(function() {
    this.ship = Object.assign(Object.create({ mass: 10000 }), baseWeapon);
  });

  afterEach(function() {
    this.ship = undefined;
  });

  describe('Add / remove weapons', function() {

    it('should add a primary weapon', function() {
      this.ship.addPrimaryWeapon(1);
      expect(this.ship.weapons.primary.name).to.equal('Railgun');
      expect(this.ship.weapons.primary.cost).to.equal(2500);
    });

    it('should remove a primary weapon', function() {
      this.ship.addPrimaryWeapon();
      expect(this.ship.weapons.primary).to.be.undefined;
    });

    it('should add a battery weapon', function() {
      this.ship.addWeapon('batteries', 1);
      expect(this.ship.weapons.batteries[0].name).to.equal('Missile Tubes');
    });

    it('should remove a battery weapon', function() {
      this.ship.removeWeapon('batteries', 1);
      expect(this.ship.weapons.batteries.length).to.equal(0);
    });

    it('should update a battery\'s count', function() {
      this.ship.addWeapon('batteries', 1, 5);
      expect(this.ship.weapons.batteries[0].count).to.equal(5);
    });

  });

  describe('Available weapons', function() {
    var availableWeapons;

    beforeEach(function() {
      availableWeapons = this.ship.calculateAvailableWeapons();
    });

    it('should calculate available batteries', function() {
      expect(availableWeapons.batteries).to.equal(10);
    });

    it('should calculate available point defense hardpoints', function() {
      expect(availableWeapons.pointDefense).to.equal(100);
    });

  });

});
