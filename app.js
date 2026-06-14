 if(process.env.NODE_ENV!="production")
 {
     require('dotenv').config();
 }


 
 //express set up 
const express=require("express");
const app=express();
//mongoose set up
const mongoose=require("mongoose");
const MONGOURL='mongodb://127.0.0.1:27017/wonderlust';
//path set up
const path=require("path");
//package thats let you use DELETE,PATCH,PUT
const methodOverride = require('method-override');
//package thats lets you define bolerplate file 
const ejsMate = require('ejs-mate');
const ExpressError=require("./util/ExpressError");
const listingRouter=require("./router/listing.js");
const reviewRouter=require("./router/review.js");
const userRouter=require("./router/user.js");
//to make statefull protocall
const session=require("express-session");
const MongoStore = require("connect-mongo").default;
const flash=require("connect-flash");
//Authentication 
const passport=require("passport");
const LocalStrategy=require("passport-local");
const User=require("./Models/user.js");


//This line tells Express which Template Engine you want to use to generate your HTML.
app.set("view engine","ejs");
//This line tells Express where to find your template files (the .ejs files).
app.set("views",path.join(__dirname, "views"));
//This line sets up a Middleware to serve static files.
app.use(express.static(path.join(__dirname, "/public")));

app.use(express.json())
app.use(express.urlencoded({extended : true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);

 

// Connect application with MongoDB database
async function main(){
    await mongoose.connect(process.env.ATLASDB_URL);
}

main().then((res)=>{
    console.log("connecte to DB");
}).catch((err)=>{
    console.log(err);
});


//home route 
app.get("/",(req,res)=>{
    res.redirect("/listings");
});

const store=MongoStore.create({
      mongoUrl:process.env.ATLASDB_URL,
      crypto:{
        secret:process.env.SECRET,
      },
      touchAfter: 24*3600,
});

store.on("err",()=>{
    console.log("something went wrong !!!",err);
})

const sessionOption={
    store,
    secret:process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie :{
        expires:Date.now()+7*24*60*60*1000,
        maxAge:7*24*60*60*1000,
        httpOnly: true,
    },
};


app.use(session(sessionOption));
app.use(flash());

//Authentication
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
    res.locals.success=req.flash("success");
    res.locals.error=req.flash("error");
    res.locals.currUser=req.user;
    next();
});

/* app.get("/register", async (req,res)=>{
    let fakeUser= new User({
        email : "smaple940@gmail.com",
        username : "demo user"
    });

    let registerUser=await User.register(fakeUser,"helloworld");
    res.send(registerUser);
})*/

// All listing related routes
app.use("/listings/:id/reviews",reviewRouter);
app.use("/listings",listingRouter);
app.use("/",userRouter);

app.use((req,res,next)=>{
    next(new ExpressError(404,"page not found"));
});

//middleware 
app.use((err,req,res,next)=>{
    let {statusCode=500,message="something went wrong"}=err;
     if(res.headersSent){
        return next(err);   
    }

    res.status(statusCode).render("listings/err.ejs",{err});
});


//server set up using express 
app.listen(8080,()=>{
   console.log("server is workng");
});