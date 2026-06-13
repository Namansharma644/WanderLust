const express=require("express");
//router package for destructruing code
const router=express.Router();
const ExpressError=require("../util/ExpressError");
const wrapAsync=require("../util/wrapAsync");
const {isLoggedIn,isOwner,validateListing}=require("../middleware.js");
const ListingControler=require("../controler/listing.js");
const multer  = require('multer')
const {storage}= require("../coludeConfig.js");
const upload = multer({storage});

router
.route("/")
.get(wrapAsync(ListingControler.index))
.post(
    isLoggedIn,
    validateListing,
    upload.single('listing[image][url]'),
    wrapAsync(ListingControler.createListing)
);


router.get(
    "/new",
    isLoggedIn,
    (ListingControler.renderListing)
);

router
.route("/:id")
.delete(
    isOwner,
    isLoggedIn,
    wrapAsync(ListingControler.destroyListing)
)
.put(
    isLoggedIn,
    isOwner,
    upload.single('listing[image][url]'),
    validateListing,
    wrapAsync(ListingControler.updateListing)
)
.get(wrapAsync(ListingControler.showListing));

router.get("/:id/edit",isLoggedIn,isOwner,wrapAsync(ListingControler.renderEditform));


module.exports=router;
