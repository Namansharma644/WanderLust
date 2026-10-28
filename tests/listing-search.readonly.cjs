const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const mongoose = require('mongoose');

async function startReadOnlyApp() {
    if (process.env.NODE_ENV === 'production') throw new Error('Read-only integration verification requires a local development database.');
    require('dotenv').config({ quiet: true });
    let target;
    try { target = new URL(process.env.ATLASDB_URL); } catch { throw new Error('Set ATLASDB_URL privately to your existing local development database.'); }
    if (target.protocol !== 'mongodb:' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw new Error('This verifier refuses remote databases.');
    process.env.NODE_ENV = 'test';
    process.env.SECRET = crypto.randomBytes(32).toString('hex'); // Ephemeral test-only session secret, never printed.
    let writes = 0;
    for (const method of ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'bulkWrite']) {
        mongoose.Collection.prototype[method] = function () {
            writes++;
            throw new Error('Database writes are prohibited during search verification.');
        };
    }
    const originalConnect = mongoose.connect.bind(mongoose);
    mongoose.connect = (uri, options) => originalConnect(uri, { ...options, autoCreate: false, autoIndex: false });
    const session = require('express-session');
    const memory = new session.MemoryStore();
    require('connect-mongo').default.create = () => memory;
    const express = require('express');
    const listen = express.application.listen;
    let app, server;
    express.application.listen = function () {
        app = this;
        server = listen.call(this, 0, '127.0.0.1');
        return server;
    };
    require('../app'); // Unchanged application, routes, templates and controllers.
    express.application.listen = listen;
    if (!server.listening) await once(server, 'listening');
    await mongoose.connection.asPromise();
    const Listing = require('../Models/listing');
    const User = require('../Models/user');
    const records = await Listing.find({}).lean();
    assert.ok(records.length, 'Use an existing populated local development database; this test never seeds it.');
    const before = new Map(records.map(row => [String(row._id), crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex')]));
    let ownedListing, owner;
    for (const row of records) {
        if (row.owner) {
            owner = await User.findById(row.owner).select('username').lean();
            if (owner) { ownedListing = row; break; }
        }
    }
    let ownerCookie;
    if (owner) {
        const id = crypto.randomBytes(24).toString('hex');
        await new Promise((resolve, reject) => memory.set(id, {
            cookie: { originalMaxAge: 3600000, expires: new Date(Date.now() + 3600000).toISOString(), httpOnly: true, path: '/' },
            passport: { user: owner.username },
        }, error => error ? reject(error) : resolve()));
        ownerCookie = 'connect.sid=' + encodeURIComponent('s:' + require('cookie-signature').sign(id, process.env.SECRET));
    }
    const url = `http://127.0.0.1:${server.address().port}`;
    return {
        app, server, url, records, ownedListing, ownerCookie,
        async close() {
            try {
                const after = await Listing.find({}).lean();
                assert.equal(after.length, before.size, 'Listing count must not change.');
                for (const row of after) assert.equal(crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex'), before.get(String(row._id)), 'Existing listing documents must remain unchanged.');
                assert.equal(writes, 0, 'No database write was attempted.');
            } finally {
                await new Promise(resolve => server.close(resolve));
                memory.clear();
                await mongoose.disconnect();
            }
        },
    };
}

async function runHttpChecks(state) {
    const { url, records, ownedListing, ownerCookie } = state;
    const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const get = async (path, cookie) => {
        const response = await fetch(url + path, { redirect: 'manual', headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(10000) });
        return { status: response.status, location: response.headers.get('location'), html: await response.text() };
    };
    const expect = (row, query) => {
        const term = (query.q || '').trim().toLowerCase();
        return (!term || [row.title, row.location, row.country].some(value => String(value || '').toLowerCase().includes(term)))
            && (query.minPrice === undefined || query.minPrice === '' || row.price >= Number(query.minPrice))
            && (query.maxPrice === undefined || query.maxPrice === '' || row.price <= Number(query.maxPrice));
    };
    const min = Math.min(...records.map(row => row.price).filter(Number.isFinite));
    const max = Math.max(...records.map(row => row.price).filter(Number.isFinite));
    const cases = [
        ['Complete title', { q: records[0].title }],
        ['Partial title', { q: records[0].title.split(/\s+/).slice(0, 2).join(' ') }],
        ['Location', { q: records[0].location }],
        ['Country', { q: records[0].country }],
        ['Case-insensitive search', { q: records[0].title.toUpperCase() }],
        ['No results', { q: '__no_match_' + crypto.randomBytes(8).toString('hex') }],
        ['Minimum price', { minPrice: '5000' }],
        ['Maximum price', { maxPrice: '1500' }],
        ['Combined search and prices', { q: 'Manali', minPrice: '1000', maxPrice: '3000' }],
        ['Inclusive lower boundary', { minPrice: String(min), maxPrice: String(min) }],
        ['Inclusive upper boundary', { minPrice: String(max), maxPrice: String(max) }],
        ['Missing parameters', {}],
        ['Empty parameters', { q: '', minPrice: '', maxPrice: '', sort: '' }],
        ['Whitespace search', { q: '   ' }],
        ['Literal regex characters', { q: '.*' }],
        ['Price ascending', { sort: 'price_asc' }],
        ['Price descending', { sort: 'price_desc' }],
    ];
    for (const [name, query] of cases) {
        const result = await get('/listings?' + new URLSearchParams(query));
        assert.equal(result.status, 200, name);
        const cards = [...result.html.matchAll(/<a\s+href="\/listings\/([a-f0-9]{24})"\s+class="wl-card"/g)].map(match => match[1]);
        const expected = records.filter(row => expect(row, query));
        const ordered = [...expected].sort((a, b) => (query.sort === 'price_asc' ? a.price - b.price : query.sort === 'price_desc' ? b.price - a.price : 0) || String(a._id).localeCompare(String(b._id)));
        assert.deepEqual(cards, ordered.slice(0,12).map(row => String(row._id)), name + ': exact first page');
        assert.ok(cards.length <= 12, 'Database pagination returns at most 12 listings.');
        if (!expected.length) assert.match(result.html, /No listings found/);
        console.log(`PASS: ${name} (${cards.length} matches)`);
    }
    for (const query of ['q=a&q=b', 'q[$ne]=x', 'minPrice[]=-1', 'minPrice=-1', 'maxPrice=Infinity', 'maxPrice=NaN', 'minPrice=abc', 'minPrice=3000&maxPrice=1000', 'sort=not-allowed', 'q=' + 'x'.repeat(101)]) {
        assert.equal((await get('/listings?' + query)).status, 400, query);
    }
    console.log('PASS: 10 malformed, repeated, nested, negative or reversed query cases return HTTP 400.');
    const escaped = await get('/listings?q=' + encodeURIComponent('<script>alert(1)</script>'));
    assert.ok(!escaped.html.includes('<script>alert(1)</script>'));
    const combined = await get('/listings?q=Manali&minPrice=1000&maxPrice=3000&sort=price_asc');
    assert.match(combined.html, /name="q"\s+value="Manali"/);
    assert.match(combined.html, /id="minPrice"[\s\S]*?value="1000"/);
    assert.match(combined.html, /value="price_asc"\s+selected/);
    const clear = /href="([^"]+)">Clear filters/.exec(combined.html);
    assert.ok(clear);
    assert.equal((await get(decode(clear[1]))).status, 200);
    console.log('PASS: escaped output, preserved values and clear-filters link.');
    for (const path of ['/login', '/singUp', '/css/style.css', '/js/script.js', '/listings/' + records[0]._id]) assert.equal((await get(path)).status, 200, path);
    const home = await get('/');
    assert.equal(home.status, 302); assert.equal(home.location, '/listings');
    assert.equal((await get('/listings/new')).location, '/login');
    if (ownerCookie) {
        assert.equal((await get('/listings/new', ownerCookie)).status, 200);
        assert.equal((await get(`/listings/${ownedListing._id}/edit`, ownerCookie)).status, 200);
        console.log('PASS: listing details, login/signup pages, authentication guard, and authenticated create/edit form rendering.');
    } else console.log('NOT RUN: authenticated form rendering (no existing owner available).');
    console.log('Read-only HTTP verification complete. No create/edit/delete submissions or account changes were made.');
}

module.exports = { startReadOnlyApp, runHttpChecks };
if (require.main === module) {
    if (!process.argv.includes('--development-only')) {
        console.error('Run explicitly with --development-only against an existing local development database.');
        process.exitCode = 1;
    } else {
        let state;
        (async () => { state = await startReadOnlyApp(); await runHttpChecks(state); })()
            .catch(error => { console.error(error.name === 'AssertionError' ? error.message : 'Read-only verification could not complete. Check the local development environment.'); process.exitCode = 1; })
            .finally(async () => { if (state) await state.close(); else await mongoose.disconnect(); });
    }
}
