const Listing=require("../Models/listing.js");
const {parseListingSearch}=require("../util/listingSearch.js");
const { PAGE_SIZE, parsePage, listingUrl, paginationFor, withReviewSummary, summarizeReviews, parseSavedIds, relatedFilter } = require('../util/listingDiscovery');
const ExpressError = require('../util/ExpressError');
const mongoose = require('mongoose');

module.exports.index= async (req,res) => { 
    const {filters,filter,sort}=parseListingSearch(req.query);
    const requestedPage = parsePage(req.query);
    const total = await Listing.countDocuments(filter);
    const pagination = paginationFor(total, requestedPage, filters);
    if (requestedPage !== pagination.page) return res.redirect(listingUrl(filters, pagination.page));
    const records = await Listing.find(filter).sort(sort || { _id: 1 })
        .skip((pagination.page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        .populate('reviews', 'rating').lean();
    const allListing = withReviewSummary(records);
    res.render("listings/index.ejs",{allListing,filters,pagination});
};

module.exports.savedPage = (req, res) => res.render('listings/saved.ejs');

module.exports.savedData = async (req, res) => {
    const ids = parseSavedIds(req.query);
    const records = ids.length ? await Listing.find({ _id: { $in: ids } })
        .select('title image price location country reviews').limit(100)
        .populate('reviews', 'rating').lean() : [];
    const byId = new Map(withReviewSummary(records).map(listing => [String(listing._id), listing]));
    const listings = ids.filter(id => byId.has(id)).map(id => {
        const listing = byId.get(id);
        return { id, title: listing.title, imageUrl: listing.image?.url || '', price: listing.price,
            location: listing.location || '', country: listing.country || '', ...listing.reviewSummary };
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({ listings, missingIds: ids.filter(id => !byId.has(id)) });
};

module.exports.renderListing=(req,res)=>{
    res.render("listings/new.ejs");
};

module.exports.createListing=async (req,res,next)=>{
        
        let url=req.file.path;
        let filename=req.file.filename;
       
        let newListing=new Listing(req.body.listing);
        newListing.owner=req.user._id;
        newListing.image={url,filename};
        await newListing.save();
        req.flash("success","New Listing created");
        res.redirect("/listings");
};

module.exports.destroyListing=async (req,res)=> {
    let {id}=req.params;
    let deletedListing=await Listing.findByIdAndDelete(id);
    req.flash("success","Listing deleted");
    console.log(deletedListing);
    res.redirect("/listings");
};

module.exports.renderEditform=async (req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id);

    let originalImgUrl=listing.image.url;
    originalImgUrl=originalImgUrl.replace("/upload","/upload/w_250")
    res.render("listings/edit.ejs",{listing,originalImgUrl});
};

module.exports.updateListing=async (req,res)=>{
    if(!req.body.listing)
    {
      throw new ExpressError(400,"Send vaild data");
    }
    let {id}=req.params;
    let listing=await Listing.findByIdAndUpdate(id,{...req.body.listing});
      
    if(typeof req.file != "undefined"){
        let url=req.file.path;
        let filename=req.file.filename;
        listing.image={url,filename};
        await listing.save();
    }
    
    if(!listing)
    {
        req.flash("error","Listing you requested for does not exist");
        res.redirect("/listing");
    }
    req.flash("success","Listing updated");
    res.redirect(`/listings/${id}`);
};

module.exports.showListing=async (req,res)=>{
    let {id}=req.params;
    if (!mongoose.isObjectIdOrHexString(id)) throw new ExpressError(404, 'This stay is no longer available.');
    const listing=await Listing.findById(id)
    .populate({path : "reviews",
        populate : {
            path : "author",
        }
    })
    .populate("owner");
    if(!listing)
    {
        throw new ExpressError(404, 'This stay is no longer available.');
    }
    const filter = relatedFilter(listing);
    const relatedRecords = [];
    // Prefer the same city; fill any remaining places from the same country.
    for (const destination of filter?.$or || []) {
        if (relatedRecords.length === 4) break;
        const excluded = [listing._id, ...relatedRecords.map(record => record._id)];
        relatedRecords.push(...await Listing.find({ _id: { $nin: excluded }, ...destination })
            .sort({ _id: 1 }).limit(4 - relatedRecords.length).populate('reviews', 'rating').lean());
    }
    const relatedListings = withReviewSummary(relatedRecords);
    res.render("listings/show.ejs",{listing,reviewSummary: summarizeReviews(listing.reviews),relatedListings});
};
