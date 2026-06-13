const Joi = require('joi');

const listingJoiSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        price: Joi.number().required().min(0),
        image: Joi.object({
            url: Joi.string().required(),
        }).optional(),
        country: Joi.string().required(),
        location: Joi.string().required(),
    }).required()
});

const reviewJoiSchema= Joi.object({
    review: Joi.object({
        rating: Joi.number().required().max(5).min(1),
        comment: Joi.string().required(),
    }).required()
});

module.exports={listingJoiSchema,reviewJoiSchema};