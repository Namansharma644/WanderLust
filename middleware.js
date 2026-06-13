const Listing=require("./Models/listing.js");
const ExpressError=require("./util/ExpressError");
const {listingJoiSchema}=require("./schema.js");
const {reviewJoiSchema}=require("./schema.js");
const Review=require("./Models/reviews.js");

module.exports.isLoggedIn = (req,res,next)=>{
    if(!req.isAuthenticated())
    {
        req.session.redirectUrl=req.originalUrl;
        req.flash("error","You must be login to create listing");
        return res.redirect("/login");
    }
    next();
}

module.exports.saveUrl=(req,res,next)=>{
    if( req.session.redirectUrl)
    {
        res.locals.redirectUrl= req.session.redirectUrl;
    }
    next();
}

module.exports.isOwner=async (req,res,next)=>{
    let {id}=req.params;
    let newListing=await Listing.findById(id);
    if(!newListing.owner._id.equals(res.locals.currUser._id))
    {
        req.flash("error","You are not the owner of this Listing");
        return res.redirect(`/listings/${id}`);
    }
    next();
}

module.exports.validateListing =(req,res,next)=>{
    

     let {error}=listingJoiSchema.validate(req.body);
    if(error){
        let errMsg=error.details.map((el)=>el.message).join(",");
        throw new ExpressError(400,errMsg);
    }
    else
    {
        next();
    }
}

module.exports.validateReview =(req,res,next)=>{
    let {error}=reviewJoiSchema.validate(req.body);
    if(error)
    {
        let errMsg=error.details.map((el)=>el.message).join(",");
        throw new ExpressError(400,errMsg);
    }
    else
    {
        next();
    }
}

module.exports.isAuthor=async (req,res,next)=>{
    let {id,reviewId}=req.params;
    let newReview=await Review.findById(reviewId);
    if(!newReview.author._id.equals(res.locals.currUser._id))
    {
        req.flash("error","You are not the author of this Review");
        return res.redirect(`/listings/${id}`);
    }
    next();
}
