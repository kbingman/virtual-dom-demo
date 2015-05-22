// Karma configuration
// Generated on Sun Nov 09 2014 12:02:11 GMT-0800 (PST)

module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'browserify', 'chai', 'sinon'],
    // list of files / patterns to load in the browser
    files: [
        'test/**/*.spec.js'
    ],
    exclude: [],
    // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
    reporters: ['spec'],
    port: 9876,
    colors: true,
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,
    autoWatch: true,
    client: {
      mocha: {
        ui: 'bdd',
        reporter: 'html'
      }
    },
    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: ['Chrome'],
    preprocessors: {
      'test/**/*.js': [ 'browserify' ]
    },
    browserify: {
      debug: true,
      transform: [ 'babelify', 'hoganify' ]
    },
    captureTimeout: 60000,
    singleRun: false
  });
};
