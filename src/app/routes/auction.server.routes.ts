import {Express} from 'express';
import * as auctions from '../controllers/auction.server.controller';
import * as authentication from '../middleware/authentication';

module.exports = (app: Express) => {
    app.route('/api/v1/auctions')
        .get(auctions.getAllAuctionsController)
        .post(authentication.loggedInRequired, auctions.createAuctionController);

    app.route('/api/v1/auctions/categories/')
        .get(auctions.getAllCategoriesController);

    app.route('/api/v1/auctions/:id')
        .get(auctions.getSingleAuctionController)
        .patch(authentication.loggedInRequired, authentication.isSeller, auctions.updateAnAuctionController)
        .delete(authentication.loggedInRequired, authentication.isSeller, auctions.deleteAnAuctionController);

    app.route('/api/v1/auctions/:id/bids')
        .get(auctions.getAllAuctionBidsController)
        .post(authentication.loggedInRequired, auctions.addBidController)

    app.route('/api/v1/auctions/:id/image')
        .get(auctions.getAuctionProfileImageController)
        .put(authentication.loggedInRequired, authentication.isSeller, auctions.setAuctionImage)
}
