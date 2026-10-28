const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePage, listingUrl, paginationFor, summarizeReviews, parseSavedIds, relatedFilter } = require('../util/listingDiscovery');

test('page parameters are bounded positive scalar integers', () => {
    for (const query of [{}, {page:''}, {page:'   '}]) assert.equal(parsePage(query), 1);
    assert.equal(parsePage({page:'6'}), 6);
    assert.equal(parsePage({page:'1000000'}), 1000000);
    for (const page of ['0', '-1', '1.5', '1e2', 'Infinity', '01', '1000001', ['1','2'], {$ne:1}, null]) {
        assert.throws(() => parsePage({page}), error => error.statusCode === 400);
    }
    assert.throws(() => parsePage({'page[$gt]':'1'}), error => error.statusCode === 400);
});

test('pagination URLs preserve only validated filters and encode search text', () => {
    const filters = {q:'A&B / India',minPrice:0,maxPrice:25000,sort:'price_desc',owner:'ignored'};
    const url = new URL(listingUrl(filters, 2), 'https://example.test');
    assert.equal(url.searchParams.get('q'),'A&B / India');
    assert.equal(url.searchParams.get('minPrice'),'0');
    assert.equal(url.searchParams.get('maxPrice'),'25000');
    assert.equal(url.searchParams.get('sort'),'price_desc');
    assert.equal(url.searchParams.get('page'),'2');
    assert.equal(url.searchParams.has('owner'),false);
    assert.equal(listingUrl({q:'',sort:'default'},1),'/listings');
});

test('pagination handles first, last, empty and very distant pages without huge skips', () => {
    const first = paginationFor(61,1,{});
    assert.deepEqual([first.start,first.end,first.totalPages,first.previous],[1,12,6,null]);
    const last = paginationFor(61,1000000,{});
    assert.deepEqual([last.page,last.start,last.end,last.next],[6,61,61,null]);
    const empty = paginationFor(0,5,{});
    assert.deepEqual([empty.page,empty.start,empty.end,empty.totalPages],[1,0,0,1]);
    assert.ok(paginationFor(1200000,50000,{}).pages.length <= 5);
});

test('review summaries use actual valid numeric ratings and count existing reviews', () => {
    assert.deepEqual(summarizeReviews([{rating:5},{rating:4},{rating:3}]),{reviewCount:3,ratingCount:3,averageRating:4});
    assert.deepEqual(summarizeReviews([null,{rating:5},{comment:'No rating'},{rating:'4'},{rating:9},{rating:NaN}]),{reviewCount:5,ratingCount:1,averageRating:5});
    assert.deepEqual(summarizeReviews(null),{reviewCount:0,ratingCount:0,averageRating:null});
    assert.equal(summarizeReviews([{comment:'Unrated'}]).averageRating,null);
});

test('saved IDs are validated, deduplicated and strictly bounded', () => {
    const a = 'a'.repeat(24), b = 'b'.repeat(24);
    assert.deepEqual(parseSavedIds({ids:`${a.toUpperCase()},${b},${a}`}),[a,b]);
    assert.deepEqual(parseSavedIds({}),[]);
    for (const ids of [{$ne:null},['x'], 'bad', a+',', Array(101).fill(a).join(',')]) {
        assert.throws(() => parseSavedIds({ids}), error => error.statusCode === 400);
    }
    assert.throws(() => parseSavedIds({'ids[$in]':a}), error => error.statusCode === 400);
});

test('related stays exclude the current ID and use only existing literal destination fields', () => {
    assert.deepEqual(relatedFilter({_id:'id',location:'Goa',country:'India',owner:'ignored'}),{_id:{$ne:'id'},$or:[{location:'Goa'},{country:'India'}]});
    assert.equal(relatedFilter({_id:'id',location:' ',country:null}),null);
    assert.deepEqual(relatedFilter({_id:'id',location:{$ne:''},country:'India'}).$or,[{country:'India'}]);
});
