// expand jest config for ci
var jest = {
  roots: ['<rootDir>/tests/integration/'],

  // enabled coverage
  collectCoverage: true,
  // only text coverage
  coverageReporters: ['text-summary'],
  // no output
  coverageDirectory: '',

  coverageThreshold: {
    global: {
      branches: 25,
      functions: 25,
      lines: 25,
      statements: 25,
    },
  },
};

// export modified jest config
module.exports = Object.assign({}, require('./jest.json'), jest);
