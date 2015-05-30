var utils = {

  round: function(num, places) {
    places = places || 1;
    var factor = Math.pow(10, places);

    return Math.round(num * factor) / factor;
  }

}

export { utils }
