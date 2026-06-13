const User= require("../Models/user.js");

module.exports.renderSingupForm=(req,res)=>{
    res.render("user/singUp.ejs");
};

module.exports.singUp=async (req,res,next)=>{
    try{
        let {username,email,password}=req.body;
        const newUser=new User({username,email});
        let registerUser=await User.register(newUser , password);
        console.log(registerUser);
        req.login(registerUser,(err)=>{
            if(err)
            {
                return next(err);
            }
            req.flash("success","Welcom to WanderLust");
            res.redirect("/listings"); 
        });
    } catch(e){
        req.flash("error","User already Exist");
        res.redirect("/singUp");
    }
};

module.exports.renderLoginForm=(req,res)=>{
    res.render("user/login.ejs");
};

module.exports.login=async(req,res)=>{
    req.flash("success","Welcom Back to WanderLust ");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

module.exports.logout=(req,res,next)=>{
    req.logout((err)=>{
        if(err)
        {
            return next(err);
        }
        req.flash("success","You are Logout");
        res.redirect("/listings");
    });
};
