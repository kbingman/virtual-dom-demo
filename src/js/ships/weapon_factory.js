import 'core-js';

import weapons from './presets/weapon_presets';

let baseWeapon = {

  addPrimaryWeapon (id) {
    this.weapons = this.weapons || {};
    this.weapons.primary = weapons.primary[id];
    // use after...
    // this.update();
  },

  calculateAvailableWeapons () {
    return {
      batteries: Math.ceil(this.mass / 1000),
      pointDefense: Math.ceil(this.mass / 100)
    }
  },

  removeWeapon (type, id) {
    this.weapons = this.weapons || {};
    this.weapons[type] = this.weapons[type] || [];

    var t = this.weapons[type].filter(matchID)[0];
    var index = this.weapons[type].indexOf(t);

    function matchID (i) {
      return i.id == id;
    }

    this.weapons[type].splice(index, 1);
    // this.update();
  },

  addWeapon (type, id, count) {
    this.weapons = this.weapons || {};
    this.weapons[type] = this.weapons[type] || [];
    count = count || 1;

    var w = weapons[type].filter(matchID)[0];
    var t = this.weapons[type].filter(matchID)[0];

    if (!t) {
      w.count = count;
      this.weapons[type].push(w);
      return;
    }

    function matchID (i) {
      return i.id == id;
    }

    t.count = count;
    // this.update();
  }
}

export { baseWeapon }
