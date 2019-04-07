// expand jest config for ci
var jest = {
  roots: ['<rootDir>/tests/functional/'],
};

// export modified jest config
module.exports = Object.assign({}, require('./jest.json'), jest);
