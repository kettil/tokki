// expand jest config for ci
var jest = {
  // show every test case
  verbose: true,

  // enabled coverage
  collectCoverage: true,
  // only text coverage
  coverageReporters: ['text-summary'],
  // no output
  coverageDirectory: '',
};

// export modified jest config
module.exports = Object.assign({}, require('./jest.json'), jest);
