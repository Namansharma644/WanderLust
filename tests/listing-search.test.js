const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseListingSearch } = require('../util/listingSearch');

test('empty searches preserve the original unfiltered order', () => {
    for (const query of [{}, { q: '', minPrice: '', maxPrice: '', sort: '' }, { q: '   ' }]) {
        const result = parseListingSearch(query);
        assert.deepEqual(result.filter, {});
        assert.equal(result.sort, null);
        assert.equal(result.filters.q, '');
        assert.equal(result.filters.sort, 'default');
    }
});

test('literal search safely matches title, location and country, ignoring case', () => {
    const { filter } = parseListingSearch({ q: '  Cabin.* [Goa]  ' });
    assert.equal(filter.$or.length, 3);
    assert.deepEqual(filter.$or.map(row => Object.keys(row)[0]), ['title', 'location', 'country']);
    for (const row of filter.$or) {
        const regex = Object.values(row)[0];
        assert.ok(regex.test('A CABIN.* [Goa] stay'));
        assert.ok(!regex.test('A cabin near Goa'));
    }
});

test('price bounds include zero, decimals and exact boundaries', () => {
    assert.deepEqual(parseListingSearch({ minPrice: '0', maxPrice: '0' }).filter.price, { $gte: 0, $lte: 0 });
    assert.deepEqual(parseListingSearch({ minPrice: '800' }).filter.price, { $gte: 800 });
    assert.deepEqual(parseListingSearch({ maxPrice: '25000.50' }).filter.price, { $lte: 25000.5 });
    const combined = parseListingSearch({ q: 'Manali', minPrice: '1000', maxPrice: '3000' });
    assert.ok(combined.filter.$or[1].location.test('MANALI'));
    assert.deepEqual(combined.filter.price, { $gte: 1000, $lte: 3000 });
});

test('malformed, repeated, nested and reversed values are refused', () => {
    for (const query of [
        { q: ['a', 'b'] }, { q: { $ne: null } }, { 'q[$ne]': 'x' }, { 'minPrice[]': '1' },
        { minPrice: { $gte: 0 } }, { maxPrice: ['1', '2'] }, { minPrice: '-1' },
        { maxPrice: 'Infinity' }, { maxPrice: 'NaN' }, { minPrice: 'abc' },
        { minPrice: '200', maxPrice: '100' }, { maxPrice: '100000001' },
        { q: 'a'.repeat(101) }, { sort: 'price' }, { sort: { $where: 'x' } },
    ]) assert.throws(() => parseListingSearch(query), error => error.statusCode === 400, JSON.stringify(query));
});

test('sorting is allowlisted and deterministic for tied prices', () => {
    assert.deepEqual(parseListingSearch({ sort: 'price_asc' }).sort, { price: 1, _id: 1 });
    assert.deepEqual(parseListingSearch({ sort: 'price_desc' }).sort, { price: -1, _id: 1 });
    assert.equal(parseListingSearch({ sort: 'default' }).sort, null);
});

test('unknown request operators and inherited fields never enter MongoDB predicates', () => {
    const result = parseListingSearch({ $where: 'unsafe()', owner: { $ne: null }, q: 'Goa' });
    assert.deepEqual(Object.keys(result.filter), ['$or']);
    assert.deepEqual(Object.keys(result.filters).sort(), ['q', 'sort']);
    assert.deepEqual(parseListingSearch(Object.create({ q: 'inherited' })).filter, {});
});
