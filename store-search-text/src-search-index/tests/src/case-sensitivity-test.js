import test from 'tape';

import si from '../..';

const sandbox = 'tests/sandbox/';
const caseSensitivityTest = sandbox + 'caseSensitivityTest';
const caseInsensitivityTest = sandbox + 'caseInsensitivityTest';

const data = [
  {
    _id: 0,
    make: 'Tesla',
    manufacturer: 'Volvo',
    brand: 'Volvo',
  },
  {
    _id: 1,
    make: 'BMW',
    manufacturer: 'Volvo',
    brand: 'Volvo',
  },
  {
    _id: 2,
    make: 'Tesla',
    manufacturer: 'Tesla',
    brand: 'Volvo',
  },
  {
    _id: 3,
    make: 'Tesla',
    manufacturer: 'Volvo',
    brand: 'BMW',
  },
  {
    _id: 4,
    make: 'Volvo',
    manufacturer: 'Volvo',
    brand: 'Volvo',
  },
  {
    _id: 5,
    make: 'Volvo',
    manufacturer: 'Tesla',
    brand: 'Volvo',
  },
  {
    _id: 6,
    make: 'Tesla',
    manufacturer: 'Tesla',
    brand: 'BMW',
  },
  {
    _id: 7,
    make: 'BMW',
    manufacturer: 'Tesla',
    brand: 'Tesla',
  },
  {
    _id: 8,
    make: 'Volvo',
    manufacturer: 'BMW',
    brand: 'Tesla',
  },
  {
    _id: 9,
    maKE: 'BMW',
    manufacturer: 'Tesla',
    brand: 'Volvo',
  },
];

test('create a case sensitive search index', (t) => {
  t.plan(1);
  si({
    name: caseSensitivityTest,
    caseSensitive: true,
  }).then((db) => {
    global[caseSensitivityTest] = db;
    t.pass('ok');
  });
});

test('can add data to case sensitive index', (t) => {
  t.plan(1);
  global[caseSensitivityTest].PUT(data).then(t.pass);
});

test('Match maKE:BMW', (t) => {
  t.plan(1);
  global[caseSensitivityTest]
    .QUERY({
      AND: ['maKE:BMW'],
    })
    .then((res) => {
      t.deepEqual(res, {
        RESULT: [
          { _id: 9, _match: [{ FIELD: 'maKE', VALUE: 'BMW', SCORE: '1.00' }] },
        ],
        RESULT_LENGTH: 1,
      });
    });
});

test('Match make:bmw', (t) => {
  t.plan(1);
  global[caseSensitivityTest]
    .QUERY({
      AND: ['make:bmw'],
    })
    .then((res) => {
      t.deepEqual(res, {
        RESULT: [],
        RESULT_LENGTH: 0,
      });
    });
});

test('Match make:BMW', (t) => {
  t.plan(1);
  global[caseSensitivityTest]
    .QUERY({
      AND: ['make:BMW'],
    })
    .then((res) => {
      t.deepEqual(res, {
        RESULT: [
          { _id: 1, _match: [{ FIELD: 'make', VALUE: 'BMW', SCORE: '1.00' }] },
          { _id: 7, _match: [{ FIELD: 'make', VALUE: 'BMW', SCORE: '1.00' }] },
        ],
        RESULT_LENGTH: 2,
      });
    });
});

test('create a case insensitive search index', (t) => {
  t.plan(1);
  si({
    name: caseInsensitivityTest,
    caseSensitive: false,
  }).then((db) => {
    global[caseInsensitivityTest] = db;
    t.pass('ok');
  });
});

test('can add data to case insensitive index', (t) => {
  t.plan(1);
  global[caseInsensitivityTest].PUT(data).then(t.pass);
});

test('Match maKE:BMW', (t) => {
  t.plan(1);
  global[caseInsensitivityTest]
    .QUERY({
      AND: ['maKE:BMW'],
    })
    .then((res) => {
      t.deepEqual(res, {
        RESULT: [
          {
            _id: 1,
            _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }],
          },
          {
            _id: 7,
            _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }],
          },
          { _id: 9, _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }] },
        ],
        RESULT_LENGTH: 3,
      });
    });
});

test('Match make:bmw', (t) => {
  t.plan(1);
  global[caseInsensitivityTest]
    .QUERY({
      AND: ['make:bmw'],
    })
    .then((res) => {
      t.deepEqual(res, {
        RESULT: [
          {
            _id: 1,
            _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }],
          },
          {
            _id: 7,
            _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }],
          },
          { _id: 9, _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }] },
        ],
        RESULT_LENGTH: 3,
      });
    });
});

test('Match make:BMW', (t) => {
  t.plan(1);
  global[caseInsensitivityTest]
    .QUERY({
      AND: ['make:BMW'],
    })
    .then((res) => {
      t.deepEqual(res, {
        RESULT: [
          {
            _id: 1,
            _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }],
          },
          {
            _id: 7,
            _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }],
          },
          { _id: 9, _match: [{ FIELD: 'make', VALUE: 'bmw', SCORE: '1.00' }] },
        ],
        RESULT_LENGTH: 3,
      });
    });
});
