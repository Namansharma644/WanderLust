const assert = require('node:assert/strict');
const {startReadOnlyApp} = require('./listing-search.readonly.cjs');

async function runDiscoveryChecks(state) {
    const {url,records} = state;
    const read = async path => {
        const response = await fetch(url + path, {redirect:'manual',signal:AbortSignal.timeout(10000)});
        return {status:response.status,location:response.headers.get('location'),html:await response.text(),headers:response.headers};
    };
    const cards = html => [...html.matchAll(/<a\s+href="\/listings\/([a-f0-9]{24})"\s+class="wl-card"/g)].map(match => match[1]);
    const decode = text => text.replace(/&amp;/g,'&');
    const matches = (row,q) => (!q.q || [row.title,row.location,row.country].some(value=>String(value||'').toLowerCase().includes(q.q.toLowerCase()))) && (q.minPrice === undefined || row.price>=Number(q.minPrice)) && (q.maxPrice === undefined || row.price<=Number(q.maxPrice));
    let pageChecks=0;
    for (const q of [{},{q:'India',minPrice:'800',maxPrice:'10000',sort:'price_desc'},{minPrice:'0',maxPrice:'25000',sort:'price_asc'}]) {
        const expected=records.filter(row=>matches(row,q)).sort((a,b)=>(q.sort==='price_asc'?a.price-b.price:q.sort==='price_desc'?b.price-a.price:0)||String(a._id).localeCompare(String(b._id)));
        const seen=[];
        for(let page=1;page<=Math.max(1,Math.ceil(expected.length/12));page++) {
            const result=await read('/listings?'+new URLSearchParams({...q,page}));
            assert.equal(result.status,200);const ids=cards(result.html);
            assert.deepEqual(ids,expected.slice((page-1)*12,page*12).map(row=>String(row._id)));
            seen.push(...ids);
            const nav=/<nav class="wl-pagination"[\s\S]*?<\/nav>/.exec(result.html)?.[0] || '';
            for(const match of nav.matchAll(/href="([^"]+)"/g)) {
                const link=new URL(decode(match[1]),url);
                for(const [key,value] of Object.entries(q)) assert.equal(link.searchParams.get(key),value,'Pagination preserves '+key);
            }
            pageChecks++;
        }
        assert.equal(new Set(seen).size,seen.length,'No duplicate records between pages');
        assert.equal(seen.length,expected.length,'No records skipped between pages');
    }
    console.log(`PASS: ${pageChecks} exact-ID pages across default and combined search/filter/sort queries; no gaps or duplicates.`);
    const clamp=await read('/listings?q=India&sort=price_desc&page=1000000');assert.equal(clamp.status,302);
    const last=new URL(clamp.location,url);assert.equal(last.searchParams.get('q'),'India');assert.equal(last.searchParams.get('sort'),'price_desc');
    const lastNumber=Math.max(1,Math.ceil(records.filter(r=>matches(r,{q:'India'})).length/12));
    assert.equal(last.searchParams.get('page'),lastNumber>1?String(lastNumber):null);
    const noResults=await read('/listings?q=__no_match_discovery__&page=2');assert.equal(noResults.status,302);assert.equal(new URL(noResults.location,url).searchParams.has('page'),false);
    for(const page of ['0','-1','1.5','1e2','NaN','Infinity','1000001','1&page=2']) assert.equal((await read('/listings?page='+page)).status,400,page);
    assert.equal((await read('/listings?page[$ne]=1')).status,400);
    assert.equal((await read('/listings?page=')).status,200);
    console.log('PASS: out-of-range and empty-result redirects preserve filters; malformed pages return 400 and empty pages default to 1.');

    const absent='ffffffffffffffffffffffff';assert.ok(!records.some(row=>String(row._id)===absent));
    const ids=records.slice(0,2).map(row=>String(row._id));
    const saved=await read('/listings/saved/data?'+new URLSearchParams({ids:[ids[0].toUpperCase(),...ids,absent].join(',')}));
    assert.equal(saved.status,200);assert.equal(saved.headers.get('cache-control'),'private, no-store');
    const payload=JSON.parse(saved.html);assert.deepEqual(payload.listings.map(row=>row.id),ids);assert.deepEqual(payload.missingIds,[absent]);
    const Review=require('../Models/reviews');
    const reviews=await Review.find({}).select('rating').lean();const byId=new Map(reviews.map(row=>[String(row._id),row]));
    for(const listing of payload.listings) {
        const original=records.find(row=>String(row._id)===listing.id);
        const actual=original.reviews.map(id=>byId.get(String(id))).filter(Boolean);
        const valid=actual.filter(row=>typeof row.rating==='number'&&Number.isFinite(row.rating)&&row.rating>=1&&row.rating<=5);
        assert.equal(listing.reviewCount,actual.length);
        assert.equal(listing.ratingCount,valid.length);
        assert.equal(listing.averageRating,valid.length?valid.reduce((sum,row)=>sum+row.rating,0)/valid.length:null);
        assert.deepEqual(Object.keys(listing).sort(),['averageRating','country','id','imageUrl','location','price','ratingCount','reviewCount','title'].sort());
    }
    assert.deepEqual(JSON.parse((await read('/listings/saved/data')).html),{listings:[],missingIds:[]});
    assert.equal((await read('/listings/saved')).status,200);
    for(const query of ['ids=bad','ids=a&ids=b','ids[$ne]=x','ids='+Array(101).fill(ids[0]).join(',')]) assert.equal((await read('/listings/saved/data?'+query)).status,400);
    console.log('PASS: saved routes, ID normalization/deduplication/limits, missing IDs, safe response projection and actual review summaries.');

    for(const listing of [records[0],records.find(row=>row.location==='Manali')].filter(Boolean)) {
        const detail=await read('/listings/'+listing._id);assert.equal(detail.status,200);
        const relatedIds=cards(detail.html);assert.ok(relatedIds.length<=4);assert.ok(!relatedIds.includes(String(listing._id)));
        const expected=records.filter(row=>String(row._id)!==String(listing._id)&&((listing.location&&row.location===listing.location)||(listing.country&&row.country===listing.country))).sort((a,b)=>Number(b.location===listing.location)-Number(a.location===listing.location)||String(a._id).localeCompare(String(b._id))).slice(0,4).map(row=>String(row._id));
        assert.deepEqual(relatedIds,expected);
        const map=/href="(https:\/\/www.google.com\/maps\/search\/[^\"]+)"/.exec(detail.html);assert.ok(map);
        assert.equal(new URL(decode(map[1])).searchParams.get('query'),[listing.location,listing.country].filter(Boolean).map(v=>v.trim()).join(', '));
        assert.ok(detail.html.includes('not a precise property address'));
    }
    assert.equal((await read('/listings/'+absent)).status,404);assert.equal((await read('/listings/not-an-id')).status,404);
    console.log('PASS: bounded related stays exclude the current property and match location/country; map queries are encoded; missing details return 404.');

    // Observe the real database query so browser-only pagination cannot pass this check.
    const mongoose=require('mongoose');const original=mongoose.Query.prototype.exec;const observed=[];
    mongoose.Query.prototype.exec=function(...args){if(this.model?.modelName==='Listing'&&this.op==='find')observed.push(this.getOptions());return original.apply(this,args)};
    const observedPage=records.length>12?2:1;
    try{assert.equal((await read('/listings?page='+observedPage)).status,200)}finally{mongoose.Query.prototype.exec=original}
    assert.ok(observed.some(options=>options.limit===12&&options.skip===(observedPage-1)*12));
    console.log('PASS: actual MongoDB listing query uses limit(12) and the correct page offset.');
}
module.exports={runDiscoveryChecks};
if(require.main===module){
    if(!process.argv.includes('--development-only')){console.error('Run with --development-only against an already populated local development database.');process.exitCode=1;}
    else{let state;(async()=>{state=await startReadOnlyApp();await runDiscoveryChecks(state)})().catch(error=>{console.error(error.name==='AssertionError'?error.message:'Read-only discovery verification failed. Check your local development setup.');process.exitCode=1}).finally(async()=>{if(state)await state.close();else await require('mongoose').disconnect()});}
}
