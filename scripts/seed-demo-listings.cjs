#!/usr/bin/env node
// Explicit, add-only demo import. Never run by application startup or deployment.
const path = require('node:path');
const mongoose = require('mongoose');
const fixtures = require('./demo-listings.json');
const Listing = require('../Models/listing');
const User = require('../Models/user');
const {listingJoiSchema} = require('../schema');
class SeedError extends Error {}

function parseFlags(argv = process.argv.slice(2)) {
    const booleans = new Set(['live-demo','development-only','insert','dry-run','validate-only','help']);
    const strings = new Set(['owner-username','confirm-database']);
    const flags = {};
    for (const argument of argv) {
        const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argument);
        if (!match || Object.hasOwn(flags,match[1]) || (!booleans.has(match[1]) && !strings.has(match[1]))) throw new SeedError('Unknown or repeated option. Use --help.');
        if (booleans.has(match[1])) {
            if (match[2] !== undefined) throw new SeedError('Boolean options do not take a value.');
            flags[match[1]] = true;
        } else {
            if (!match[2]?.trim()) throw new SeedError('Supply a value for each named option.');
            flags[match[1]] = match[2].trim();
        }
    }
    if (flags.insert && flags['dry-run']) throw new SeedError('Choose preview or --insert, not both.');
    return flags;
}

function targetFor(flags, env = process.env) {
    if (Boolean(flags['live-demo']) === Boolean(flags['development-only'])) throw new SeedError('Choose exactly one mode: --live-demo or --development-only.');
    if (flags['development-only'] && env.NODE_ENV === 'production') throw new SeedError('Development-only mode refuses a production environment.');
    if (!flags['owner-username'] || flags['owner-username'].length > 100) throw new SeedError('Supply the username of an existing owner with --owner-username.');
    if (flags['confirm-database'] && !/^[a-zA-Z0-9_-]+$/.test(flags['confirm-database'])) throw new SeedError('Use a plain database name for --confirm-database, not a connection string.');
    if (flags.insert && !flags['confirm-database']) throw new SeedError('Run the preview first, then repeat with --insert and --confirm-database=THE_PREVIEWED_NAME.');
    let uri;
    try { uri = new URL(env.ATLASDB_URL); } catch { throw new SeedError('ATLASDB_URL is missing or invalid. Use the project’s existing private environment configuration.'); }
    if (!['mongodb:','mongodb+srv:'].includes(uri.protocol)) throw new SeedError('Unsupported database connection protocol.');
    let database;
    try { database = decodeURIComponent(uri.pathname.slice(1)); } catch { throw new SeedError('Cannot identify the configured database safely.'); }
    const local = uri.protocol === 'mongodb:' && ['127.0.0.1','localhost','[::1]'].includes(uri.hostname);
    if (flags['development-only'] && !local && !/(^|[_-])(dev|development|test|testing|sandbox)($|[_-])/i.test(database)) throw new SeedError('A remote development target must have a dev/test/sandbox database name. Live imports require explicit --live-demo authorization.');
    if (database) checkDatabase(database,flags);
    return {uri:env.ATLASDB_URL};
}

function checkDatabase(database, flags) {
    if (!/^[a-zA-Z0-9_-]+$/.test(database) || ['admin','local','config'].includes(database.toLowerCase())) throw new SeedError('System or unidentified databases are refused.');
    if (flags['development-only'] && /(^|[_-])(prod|production|live)($|[_-])/i.test(database)) throw new SeedError('Development-only mode refuses a production-labelled database.');
    if (flags['confirm-database'] && database !== flags['confirm-database']) throw new SeedError('The connected database does not match --confirm-database. Nothing was inserted.');
}

async function validateFixtures() {
    const ids = new Set();
    for (const fixture of fixtures) {
        if (!mongoose.isObjectIdOrHexString(fixture._id) || ids.has(fixture._id)) throw new SeedError('The external demo manifest has invalid or repeated identifiers.');
        ids.add(fixture._id);
        const {title,description,price,location,country,image} = fixture;
        const {error} = listingJoiSchema.validate({listing:{title,description,price,location,country,image}});
        if (error) throw new SeedError('A fixture does not satisfy the existing listing form rules.');
        let url;
        try { url = new URL(image.url); } catch { throw new SeedError('A fixture photo URL is invalid.'); }
        if (url.protocol !== 'https:') throw new SeedError('Demo photographs must use HTTPS.');
        try { await new Listing(fixture).validate(); } catch { throw new SeedError('A fixture does not satisfy the unchanged Listing model.'); }
    }
    return fixtures.length;
}

async function importMissing(model, records, insert) {
    const existing = new Set((await model.find({_id:{$in:records.map(row=>row._id)}}).select('_id').lean()).map(row=>String(row._id)));
    const missing = records.filter(row=>!existing.has(String(row._id)));
    if (!insert) return {inserted:0,skipped:existing.size,wouldInsert:missing.length};
    let inserted = 0, skipped = existing.size;
    for (const record of missing) {
        try { await model.create(record); inserted++; }
        catch (error) {
            if (error.code === 11000 && await model.exists({_id:record._id})) skipped++;
            else throw new SeedError(`Import stopped after ${inserted} inserts. Existing records were not overwritten. Rerun the same command after resolving the issue; stable IDs prevent duplicates.`);
        }
    }
    return {inserted,skipped,wouldInsert:0};
}

async function main() {
    const flags = parseFlags();
    if (flags.help) {
        console.log('Validate offline: node scripts/seed-demo-listings.cjs --validate-only');
        console.log('Preview: node scripts/seed-demo-listings.cjs --live-demo --owner-username=YOUR_USERNAME');
        console.log('Insert after reviewing preview: repeat with --confirm-database=THE_PREVIEWED_NAME --insert');
        console.log('For development, substitute --development-only. No writes occur without --insert. Reads the existing ATLASDB_URL; never prints it.');
        return;
    }
    const count = await validateFixtures();
    if (flags['validate-only']) { console.log(`${count} demo listings pass the existing model and form rules. No connection or database writes performed.`); return; }
    require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});
    const target = targetFor(flags);
    try { await mongoose.connect(target.uri,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:8000}); }
    catch { throw new SeedError('Cannot connect to the configured database. Check connectivity privately; no credentials were printed.'); }
    checkDatabase(mongoose.connection.name,flags);
    const owner = await User.findOne({username:flags['owner-username']}).select('_id username').lean();
    if (!owner) throw new SeedError('That username does not exist in the configured database. Register on the correct site first. Nothing was inserted.');
    const records = fixtures.map(row=>({...row,owner:owner._id}));
    const result = await importMissing(Listing,records,flags.insert === true);
    console.log(`Database: ${mongoose.connection.name}; owner: ${owner.username}; mode: ${flags['live-demo']?'explicit live demo':'development'}. Connection credentials are hidden.`);
    console.log(flags.insert ? `Inserted ${result.inserted} demo listings; preserved/skipped ${result.skipped} existing IDs. No updates, deletes, users or reviews were created.` : `PREVIEW ONLY: ${result.wouldInsert} would be inserted; ${result.skipped} existing IDs would be kept. No writes performed.`);
}

module.exports = {SeedError,parseFlags,targetFor,checkDatabase,validateFixtures,importMissing};
if (require.main === module) {
    main().catch(error=>{console.error(error instanceof SeedError ? error.message : 'Demo import could not complete. Check your private configuration; connection details were not printed.');process.exitCode=1;}).finally(()=>mongoose.disconnect());
}
