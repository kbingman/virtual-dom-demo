import flight from 'flightjs';

let baseWeapon = {
  damage: 0,
  mass: 0,
  power: 0
}

let weaponFactory = function weaponFactory(options) {
  var weapon = flight.utils.merge(Object.create(baseWeapon), options);

  return weapon;
};

export { weaponFactory }
