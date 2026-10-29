const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseFlags,targetFor,checkDatabase,validateFixtures,importMissing} = require('../scripts/seed-demo-listings.cjs');
const fixtures = require('../scripts/demo-listings.json');

test('the entire demo manifest satisfies unchanged model and form validation', async()=>{
    assert.equal(await validateFixtures(),32);
    assert.equal(Math.min(...fixtures.map(row=>row.price)),800);
    assert.equal(Math.max(...fixtures.map(row=>row.price)),25000);
    assert.ok(fixtures.every(row=>row.description.startsWith('Demo accommodation')));
    assert.ok(fixtures.every(row=>!Object.hasOwn(row,'rating')&&!Object.hasOwn(row,'category')));
});

test('explicit modes and write confirmation are mandatory, with strict option parsing',()=>{
    for(const args of [['--insert=true'],['--live-demo','--live-demo'],['--unknown'],['--owner-username'],['--insert','--dry-run']])assert.throws(()=>parseFlags(args));
    const env={ATLASDB_URL:'mongodb+srv://example.invalid/wanderlust_live',NODE_ENV:'production'};
    assert.throws(()=>targetFor({'owner-username':'rohit'},env));
    assert.throws(()=>targetFor({'development-only':true,'owner-username':'rohit'},env));
    assert.throws(()=>targetFor({'live-demo':true,'owner-username':'rohit',insert:true},env));
    assert.ok(targetFor({'live-demo':true,'owner-username':'rohit','confirm-database':'wanderlust_live',insert:true},env));
});

test('system databases and mismatched confirmation are refused, with no target override',()=>{
    for(const database of ['admin','local','config'])assert.throws(()=>checkDatabase(database,{'confirm-database':database}));
    assert.throws(()=>checkDatabase('actual_database',{'confirm-database':'different_database'}));
    assert.throws(()=>targetFor({'development-only':true,'owner-username':'rohit'},{ATLASDB_URL:'mongodb+srv://example.invalid/customer_live'}));
    const uri='mongodb://127.0.0.1:27017/wonderlust';
    assert.equal(targetFor({'development-only':true,'owner-username':'rohit'},{ATLASDB_URL:uri}).uri,uri);
});

function modelFor(rows) {
    const data=new Map(rows.map(row=>[row._id,{...row}]));let writes=0;
    return {
        data,get writes(){return writes},
        find(query){return {select(){return this},async lean(){return query._id.$in.filter(id=>data.has(id)).map(_id=>({_id}))}}},
        async create(row){writes++;assert.ok(!data.has(row._id),'never overwrite an existing document');data.set(row._id,{...row})},
        async exists(query){return data.has(query._id)},
    };
}

test('preview performs zero writes and reports only missing stable IDs',async()=>{
    const model=modelFor([{_id:'a',title:'Keep my changes'}]);
    const result=await importMissing(model,[{_id:'a',title:'Different title'},{_id:'b',title:'New'}],false);
    assert.deepEqual(result,{inserted:0,skipped:1,wouldInsert:1});assert.equal(model.writes,0);
    assert.equal(model.data.get('a').title,'Keep my changes');
});

test('real insertion path is idempotent and preserves existing edits and unrelated records',async()=>{
    const model=modelFor([{_id:'a',title:'Existing edited demo'},{_id:'unrelated',title:'Real existing property'}]);
    const rows=[{_id:'a',title:'Fixture title'},{_id:'b',title:'New fixture'}];
    assert.deepEqual(await importMissing(model,rows,true),{inserted:1,skipped:1,wouldInsert:0});
    assert.deepEqual(await importMissing(model,rows,true),{inserted:0,skipped:2,wouldInsert:0});
    assert.equal(model.writes,1);assert.equal(model.data.get('a').title,'Existing edited demo');assert.equal(model.data.get('unrelated').title,'Real existing property');
});

test('concurrent duplicate IDs are skipped and other failures stop safely',async()=>{
    const race=modelFor([]);race.create=async row=>{race.data.set(row._id,row);const error=new Error('duplicate');error.code=11000;throw error};
    assert.deepEqual(await importMissing(race,[{_id:'x'}],true),{inserted:0,skipped:1,wouldInsert:0});
    const failure=modelFor([]);failure.create=async()=>{throw new Error('internal database failure')};
    await assert.rejects(importMissing(failure,[{_id:'x'}],true),error=>error.message.includes('Import stopped after 0 inserts')&&!error.message.includes('internal database failure'));
});
