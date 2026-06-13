const Listing=require("../Models/listing.js");

module.exports.index= async (req,res) => { 
    let allListing=await Listing.find({});
    res.render("listings/index.ejs",{allListing});
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
    const listing=await Listing.findById(id)
    .populate({path : "reviews",
        populate : {
            path : "author",
        }
    })
    .populate("owner");
    if(!listing)
    {
        req.flash("error","Listing you requested for does not exist");
        res.redirect("/listing");
    }
    res.render("listings/show.ejs",{listing});
};