const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../Models/listing.js");
const MONGO_URL = "mongodb://127.0.0.1:27017/wonderlust";

//connect to mongodb
async function main() {
    await mongoose.connect(MONGO_URL);
}

main()
  .then(async () => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

//instilized listing model
const initDB = async () => {
  await Listing.deleteMany({});
  initData.data = initData.data.map(function(obj){
    return {
        ...obj,
        owner: "6a27df995e61f1c7149567ff"
    };
});
  await Listing.insertMany(initData.data);
  console.log("data was initialized");
};

initDB();
