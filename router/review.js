const express=require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync=require("../util/wrapAsync");
const {validateReview,isLoggedIn,isAuthor}=require("../middleware.js");
const ReviewControler=require("../controler/review.js");

//reviews
//post route
router.post("/",isLoggedIn,validateReview,wrapAsync(ReviewControler.createReview));
//delete route for reviews
router.delete("/:reviewId",isLoggedIn,isAuthor,wrapAsync(ReviewControler.destroyReview));

module.exports=router;