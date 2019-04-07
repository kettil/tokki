// expand jest config for ci
var jest = {
  roots: ['<rootDir>/tests/integration/'],
};

// export modified jest config
module.exports = Object.assign({}, require('./jest.json'), jest);
