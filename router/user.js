const express=require("express");
const router = express.Router();
const User= require("../Models/user.js");
const wrapAsync=require("../util/wrapAsync");
const passport=require("passport");
const {saveUrl}=require("../middleware.js");
const UserControler=require("../controler/user.js");


router
.route("/singUp")
.get(UserControler.renderSingupForm)
.post(wrapAsync (UserControler.singUp))

router
.route("/login")
.get(UserControler.renderLoginForm)
.post(
    saveUrl,
    passport.authenticate("local",
    { 
    failureRedirect: '/login' ,
    failureFlash:true
}),UserControler.login);

router.get("/logout",UserControler.logout);

module.exports=router;