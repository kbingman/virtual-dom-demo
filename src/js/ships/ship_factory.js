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
    }
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

    fuel += this.ftl * .1 * this.mass;
    fuel += this.reactor * .005 * this.mass;

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

  calculateEP () {
    this.ep = Math.ceil(this.reactor * .005 * this.mass);
  },

  calculateBridge () {
    var bridgeFactor = SHIP_BRIDGE;
    var minBridge = MIN_BRIDGE
    var m;

    if (this.isSmallCraft) {
      bridgeFactor = SMALLCRAFT_BRIDGE;
      minBridge = MIN_SMALLCRAFT_BRIDGE;
    }

    m = this.mass * bridgeFactor;
    return m > minBridge ? m : minBridge;
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

export { shipFactory }
