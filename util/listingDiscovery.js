const ExpressError = require('./ExpressError');

const PAGE_SIZE = 12;
const MAX_SAVED = 100;
const ID_PATTERN = /^[a-f\d]{24}$/i;

function parsePage(query) {
    if (Object.keys(query).some(key => /^page\[/.test(key))) {
        throw new ExpressError(400, 'Page must contain one positive whole number.');
    }
    const raw = Object.prototype.hasOwnProperty.call(query, 'page') ? query.page : '';
    if (typeof raw !== 'string') throw new ExpressError(400, 'Page must contain one positive whole number.');
    if (!raw.trim()) return 1;
    if (!/^[1-9]\d{0,6}$/.test(raw) || Number(raw) > 1000000) {
        throw new ExpressError(400, 'Choose a page between 1 and 1000000.');
    }
    return Number(raw);
}

function listingUrl(filters, page = 1) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
    if (filters.sort && filters.sort !== 'default') params.set('sort', filters.sort);
    if (page > 1) params.set('page', String(page));
    const search = params.toString();
    return '/listings' + (search ? '?' + search : '');
}

function paginationFor(total, requestedPage, filters) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const numbers = [...new Set([1, page - 1, page, page + 1, totalPages])]
        .filter(number => number >= 1 && number <= totalPages).sort((a, b) => a - b);
    return {
        page, total, totalPages, pageSize: PAGE_SIZE,
        start: total ? (page - 1) * PAGE_SIZE + 1 : 0,
        end: Math.min(page * PAGE_SIZE, total),
        previous: page > 1 ? listingUrl(filters, page - 1) : null,
        next: page < totalPages ? listingUrl(filters, page + 1) : null,
        pages: numbers.map(number => ({ number, url: listingUrl(filters, number) })),
    };
}

function summarizeReviews(reviews = []) {
    const existing = (Array.isArray(reviews) ? reviews : []).filter(review => review && typeof review === 'object');
    const ratings = existing.map(review => review.rating)
        .filter(rating => typeof rating === 'number' && Number.isFinite(rating) && rating >= 1 && rating <= 5);
    return {
        reviewCount: existing.length,
        ratingCount: ratings.length,
        averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    };
}

function withReviewSummary(listings) {
    return listings.map(listing => ({ ...listing, reviewSummary: summarizeReviews(listing.reviews) }));
}

function parseSavedIds(query) {
    if (Object.keys(query).some(key => /^ids\[/.test(key))) {
        throw new ExpressError(400, 'Saved stays must be a comma-separated list of listing IDs.');
    }
    const raw = Object.prototype.hasOwnProperty.call(query, 'ids') ? query.ids : '';
    if (typeof raw !== 'string' || raw.length > MAX_SAVED * 25) {
        throw new ExpressError(400, 'Choose up to 100 saved stays.');
    }
    if (!raw) return [];
    const ids = raw.split(',');
    if (ids.length > MAX_SAVED || ids.some(id => !ID_PATTERN.test(id))) {
        throw new ExpressError(400, 'Choose up to 100 valid saved stays.');
    }
    return [...new Set(ids.map(id => id.toLowerCase()))];
}

function relatedFilter(listing) {
    const destinations = ['location', 'country']
        .filter(field => typeof listing[field] === 'string' && listing[field].trim())
        .map(field => ({ [field]: listing[field] }));
    return destinations.length ? { _id: { $ne: listing._id }, $or: destinations } : null;
}

module.exports = { PAGE_SIZE, MAX_SAVED, parsePage, listingUrl, paginationFor, summarizeReviews, withReviewSummary, parseSavedIds, relatedFilter };
