var utils = {

  round (num, places) {
    places = places || 1;
    var factor = Math.pow(10, places);

    return Math.round(num * factor) / factor;
  },

  aggregate (memo, item) {
    memo += item.count * item.mass;
    return memo;
  },

  aggregateCost (memo, item) {
    memo += item.count * item.cost;
    return memo;
  }

};

export { utils };
