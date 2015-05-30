import { weaponFactory } from '../../src/js/ships/weapon_factory';

describe('Weapon Factory', function() {
  var weapon;

  beforeEach(function() {
    weapon = weaponFactory({
      power: 1,
      mass: 1,
      damage: 1
    });
    window.weapon = weapon;
  });

  it('should be defined', function() {
    expect(weapon).to.be.defined;
  });

});
