import 'core-js';
import cuid from 'cuid';

import presets from './presets/ship_presets';

import { utils } from '../utils';
import { baseWeapon } from './weapon_factory';

const SHIP_BRIDGE = 0.02;
const MIN_BRIDGE = 20;
const SMALLCRAFT_BRIDGE = 0.2;
const MIN_SMALLCRAFT_BRIDGE = 4;

let baseShip = {
  mass: 0,
  thrust: 0,
  reactor: 0,
  ftl: 0,
  crew: 0,
  officers: 0,
  passengers: 0,
  cuid: cuid(),

  init () {
    this.weapons = {
      primary: undefined,
      batteries: [],
      pointDefense: []
    };
    this.update();
  },

  calculateMass () {
    var ftl = presets.ftl[this.ftl] * 0.01 * this.mass;
    var thrust = presets.thrust[this.thrust] * 0.01 * this.mass;
    var reactor = this.reactor * presets.reactor * 0.01 * this.mass;
    var armor = this.armor + presets.armor + 0.01 * this.mass;

    var batteries = this.weapons.batteries.reduce(utils.aggregate, 0);
    var pointDefense = this.weapons.pointDefense.reduce(utils.aggregate, 0);

    var fuel = 0;

    fuel += this.ftl * 0.1 * this.mass;
    fuel += this.reactor * 0.005 * this.mass;

    return  {
      ftl: utils.round(ftl),
      thrust: utils.round(thrust),
      reactor: utils.round(reactor),
      bridge: utils.round(this.calculateBridge(), 0),
      armor: utils.round(armor),
      fuel: utils.round(fuel),
      primaryWeapon: this.weapons.primary && this.weapons.primary.mass ?
        this.weapons.primary.mass : 0,
      batteries: batteries || 0,
      pointDefense: pointDefense || 0
    };
  },

  calculatePrice () {
    var masses = this.masses;

    var configuration = presets[this.configuration];
    var hull = this.mass * 0.01 * configuration;
    var armor = 0;
    var ftl = masses.ftl * 4;
    var thrust = masses.thrust * 0.5;
    var reactor = masses.reactor * 3;
    // var quarters = masses.quarters * 0.125;
    var bridge = masses.bridge * 0.5;

    var batteries = this.weapons.batteries.reduce(utils.aggregateCost, 0);
    var pointDefense = this.weapons.pointDefense.reduce(utils.aggregateCost, 0);

    return  {
      ftl: utils.round(ftl),
      thrust: utils.round(thrust),
      reactor: utils.round(reactor),
      hull: utils.round(hull),
      bridge: utils.round(bridge),
      armor: utils.round(armor),
      primaryWeapon: this.weapons.primary && this.weapons.primary.cost ?
        this.weapons.primary.cost : 0,
      batteries: batteries || 0,
      pointDefense: pointDefense || 0
    };
  },

  calculateEP () {
    this.ep = Math.ceil(this.reactor * 0.005 * this.mass);
  },

  calculateBridge () {
    var bridgeFactor = SHIP_BRIDGE;
    var minBridge = MIN_BRIDGE;
    var m;

    if (this.isSmallCraft) {
      bridgeFactor = SMALLCRAFT_BRIDGE;
      minBridge = MIN_SMALLCRAFT_BRIDGE;
    }

    m = this.mass * bridgeFactor;
    return m > minBridge ? m : minBridge;
  },

  calculateCrew() {
    var crew = {
      officers: 0,
      ratings: 0
    };
    if (this.mass <= 300) {
      crew.officers += 2; // Base command crew
    } else if (this.mass > 300 && this.mass < 5000) {
      crew.officers += 7; // Base command crew
    } else {
      crew.officers += 14;
    }

    // Basic support crew for command section
    if (this.mass >= 20000) {
      crew.command = Math.round(this.mass / 10000) * 5;
    } else {
      crew.command = Math.floor(crew.officers / 2);
    }
    crew.ratings += crew.command;
    // crew.officers += Math.floor(crew.command / 5);

    // Engineering
    crew.engineering = Math.round((this.masses.ftl + this.masses.reactor + this.masses.thrust) / 100);
    crew.ratings += crew.engineering;
    crew.officers += Math.floor(crew.engineering / 5); // add more for bigger ships?

    // Service
    crew.service = Math.round(this.mass / 1000) * 3;
    crew.ratings += crew.service;
    crew.officers += Math.floor(crew.service / 5);

    // Weapons
    crew.weapons = 0;
    // if (this.weapons.primary) {
    //   return memo += this.weapons.primary.mass / 100;
    // }
    // if (this.weapons.batteries) {
    //   crew.weapons += this.weapons.batteries.reduce(function(memo, w) {
    //     return memo += w.count * 2;
    //   }, 0);
    // }
    // if (this.weapons.pointDefense) {
    //   crew.weapons += this.weapons.batteries.reduce(function(memo, w) {
    //     return memo += w.count / 100;
    //   }, 1);
    // }
    crew.ratings += Math.ceil(crew.weapons);
    crew.officers += Math.floor(crew.weapons / 5);

    // Flight crews

    return crew;
  },

  calculateTotal () {
    var masses = this.calculateMass();

    var total = Object.keys(masses).reduce(function(memo, key) {
      memo += masses[key];
      return memo;
    }, 0);

    return utils.round(total);
  },

  update (options) {
    options = options || {};

    Object.keys(options).forEach(function(key) {
      this[key] = options[key];
    }, this);

    this.availableWeapons = this.calculateAvailableWeapons();
    this.validate();

    this.isSmallCraft = this.mass < 100;
    this.masses = this.calculateMass();
    this.totalMass = this.calculateTotal();
    this.calculateEP();
    this.remainingMass = utils.round(this.mass - this.totalMass);
  },

  validate () {
    if (this.ftl > this.reactor) {
      this.reactor = this.ftl;
    }
    if (this.thrust > this.reactor) {
      this.reactor = this.thrust;
    }
  }

};

let shipFactory = function shipFactory(options) {
  var ship = Object.assign(Object.create(baseShip), baseWeapon, options);
  ship.init();

  return ship;
};

window.shipFactory = shipFactory;

export { shipFactory };
