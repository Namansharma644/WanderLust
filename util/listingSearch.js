const Joi = require("joi");
const ExpressError = require("./ExpressError");

const fields = ["q", "minPrice", "maxPrice", "sort"];
const searchSchema = Joi.object({
    q: Joi.string().trim().max(100).allow("").default(""),
    minPrice: Joi.number().min(0).max(100000000).empty("").optional(),
    maxPrice: Joi.number().min(0).max(100000000).empty("").optional(),
    sort: Joi.string().valid("default", "price_asc", "price_desc").empty("").default("default"),
});

function parseListingSearch(query) {
    const input = {};
    // Express may expose bracket syntax as raw keys rather than nested objects.
    if (Object.keys(query).some(key => /^(q|minPrice|maxPrice|sort)\[/.test(key))) {
        throw new ExpressError(400, "Search and filter parameters must contain one value each.");
    }
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(query, field)) input[field] = query[field];
    }
    const { value, error } = searchSchema.validate(input);
    if (error) {
        throw new ExpressError(400, "Enter a search of up to 100 characters, non-negative prices, and a supported sort order.");
    }
    if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice) {
        throw new ExpressError(400, "Minimum price must be less than or equal to maximum price.");
    }

    // Build MongoDB predicates explicitly; never forward request objects.
    const filter = {};
    if (value.q) {
        const literal = value.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const search = new RegExp(literal, "i");
        filter.$or = [{ title: search }, { location: search }, { country: search }];
    }
    if (value.minPrice !== undefined || value.maxPrice !== undefined) {
        filter.price = {};
        if (value.minPrice !== undefined) filter.price.$gte = value.minPrice;
        if (value.maxPrice !== undefined) filter.price.$lte = value.maxPrice;
    }
    const sort = value.sort === "price_asc" ? { price: 1, _id: 1 }
        : value.sort === "price_desc" ? { price: -1, _id: 1 } : null;
    return { filters: value, filter, sort };
}

module.exports = { parseListingSearch };
